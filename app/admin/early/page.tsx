import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { mdhm } from "@/lib/format";
import {
  EARLY_DELETE_AFTER, EARLY_GLP, EARLY_KIND_LABEL, EARLY_KINDS, EARLY_MONTHLY, EARLY_ORG_TYPES, EARLY_QUOTE_COUNT, EARLY_WHEN, EARLY_YEARLY,
} from "@/lib/early";

export const dynamic = "force-dynamic";

const ROLE_KO = { req: "의뢰자", cro: "기관" } as const;

/** 연간 의뢰 건수 구간의 보수적인 값 (기관 설득용 추정 하한). 11건 이상은 11로 센다 */
const YEARLY_LOW: Record<string, number> = { "1~2건": 1, "3~5건": 3, "6~10건": 6, "11건 이상": 11 };

/** 010-****-5678 */
function maskPhone(p: string | null): string {
  if (!p) return "-";
  return p.length >= 10 ? `${p.slice(0, 3)}-****-${p.slice(-4)}` : "****";
}

/**
 * 사전예약 (/early) 집계. 의뢰자 설문(소속·분야·시기·연간 건수·견적 받는 곳 수)과 기관 설문(분야·GLP·월 견적서 수)을 세고 목록을 본다.
 * 기관 설득에 쓰는 숫자다. 휴대폰 번호는 가려서 보여 준다.
 */
export default async function AdminEarly() {
  await requireSession("admin");
  const sb = dbReady() ? getSupabaseAdmin() : null;
  if (!sb) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const { data, error } = await sb.from("early_signups").select("*").order("created_at", { ascending: false }).limit(2000);
  if (error) return <div className="empty"><b>예약을 읽지 못했습니다</b><p>마이그레이션 0035를 적용했는지 확인해 주세요. ({error.message})</p></div>;
  const rows = data ?? [];
  const req = rows.filter((r) => r.role === "req");
  const cro = rows.filter((r) => r.role === "cro");
  type R = (typeof rows)[number];
  const count = (list: R[], f: (r: R) => boolean) => list.filter(f).length;
  const yearlyLow = req.reduce((n, r) => n + (r.yearly ? YEARLY_LOW[r.yearly] ?? 0 : 0), 0);
  const smsDone = count(rows, (r) => !!r.done_sms_at);
  const adAgreed = count(rows, (r) => !!r.ad_agreed_at);

  const Dist = ({ title, list, opts, get }: { title: string; list: R[]; opts: readonly string[]; get: (r: R) => string | null }) => (
    <div className="card tbl-wrap">
      <table className="tbl">
        <thead><tr><th>{title}</th><th className="num">건</th></tr></thead>
        <tbody>
          {opts.map((o) => <tr key={o}><td>{o}</td><td className="num tnum">{count(list, (r) => get(r) === o)}</td></tr>)}
          {count(list, (r) => !get(r)) > 0 && <tr><td style={{ color: "var(--muted)" }}>답 없음 (옛 양식)</td><td className="num tnum">{count(list, (r) => !get(r))}</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="ph">
        <div>
          <h1>사전예약</h1>
          <p>의뢰자 {req.length}건 · 기관 {cro.length}건 · 예약 완료 문자 {smsDone}건 · 광고성 정보 동의 {adAgreed}건 · {EARLY_DELETE_AFTER} 뒤 정리 작업이 모두 지웁니다</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty"><b>아직 예약이 없습니다</b><p>danchu.kr/early 에서 예약하면 여기에 쌓입니다.</p></div>
      ) : (
        <>
          <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 14 }}>
            의뢰자가 답한 연간 의뢰 건수를 구간의 아래 값으로 더하면 <b className="tnum" style={{ color: "var(--ink)" }}>{yearlyLow.toLocaleString("ko-KR")}건</b>입니다. 기관에 설명할 때는 &ldquo;최소 이 정도&rdquo;로만 씁니다.
          </p>
          <div className="card tbl-wrap">
            <table className="tbl">
              <thead><tr><th>분야</th><th className="num">의뢰자</th><th className="num">기관</th></tr></thead>
              <tbody>
                {EARLY_KINDS.map((k) => (
                  <tr key={k}><td>{EARLY_KIND_LABEL[k]} {k}</td><td className="num tnum">{count(req, (r) => r.kinds.includes(k))}</td><td className="num tnum">{count(cro, (r) => r.kinds.includes(k))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <Dist title="의뢰자 소속" list={req} opts={EARLY_ORG_TYPES} get={(r) => r.org_type} />
            <Dist title="첫 의뢰 시기" list={req} opts={EARLY_WHEN} get={(r) => r.timing} />
            <Dist title="1년 의뢰 건수" list={req} opts={EARLY_YEARLY} get={(r) => r.yearly} />
            <Dist title="견적 받는 곳 수" list={req} opts={EARLY_QUOTE_COUNT} get={(r) => r.quote_count} />
            <Dist title="기관 GLP 인증" list={cro} opts={EARLY_GLP} get={(r) => r.glp[0] ?? null} />
            <Dist title="기관 월 견적서 수" list={cro} opts={EARLY_MONTHLY} get={(r) => r.monthly} />
          </div>
          <div className="card tbl-wrap">
            <table className="tbl">
              <thead><tr><th>시각</th><th>갈래</th><th>이름</th><th>휴대폰</th><th>이메일</th><th>기관명·소속</th><th>분야</th><th>설문</th><th>광고</th><th>완료 문자</th><th>유입</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="tnum" style={{ whiteSpace: "nowrap" }}>{mdhm(r.updated_at)}</td>
                    <td>{ROLE_KO[r.role]}</td>
                    <td style={{ fontSize: 13 }}>{r.name ?? "-"}</td>
                    <td className="tnum" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{maskPhone(r.phone)}</td>
                    <td style={{ fontSize: 13 }}>{r.email}</td>
                    <td style={{ fontSize: 13 }}>{r.org ?? r.org_type ?? "-"}</td>
                    <td style={{ fontSize: 13 }}>{r.kinds.join(" · ")}</td>
                    <td style={{ fontSize: 12 }}>{(r.role === "req" ? [r.timing, r.yearly, r.quote_count] : [r.glp[0] ? `GLP ${r.glp[0]}` : null, r.monthly]).filter(Boolean).join(" · ") || "-"}</td>
                    <td style={{ fontSize: 12 }}>{r.ad_agreed_at ? "동의" : "-"}</td>
                    <td style={{ fontSize: 12 }}>{r.done_sms_at ? "보냄" : "-"}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.source ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
