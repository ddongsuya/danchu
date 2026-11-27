import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { AdminSection, FilterChips } from "@/components/admin/Blocks";
import { mdhm } from "@/lib/format";
import {
  EARLY_DELETE_AFTER, EARLY_GLP, EARLY_OPEN_DATE, EARLY_KIND_LABEL, EARLY_KINDS, EARLY_MONTHLY, EARLY_ORG_TYPES, EARLY_QUOTE_COUNT, EARLY_WHEN, EARLY_YEARLY,
} from "@/lib/early";

export const dynamic = "force-dynamic";

const ROLE_KO = { req: "의뢰자", cro: "기관" } as const;

/** 연간 의뢰 건수 구간의 보수적인 값 (기관 설득용 추정 하한). 11건 이상은 11로 센다 */
const YEARLY_LOW: Record<string, number> = { "1~2건": 1, "3~5건": 3, "6~10건": 6, "11건 이상": 11 };

/** 사전예약 기간 끝 (lib/prereg.ts: 시범 운영 시작 EARLY_OPEN_DATE 전날까지. 시작일은 정해 둔 게이트가 없다) */
const LAST_DAY = (() => { const d = new Date(`${EARLY_OPEN_DATE}T12:00:00+09:00`); d.setUTCDate(d.getUTCDate() - 1); return d; })();
const PERIOD = `${LAST_DAY.getUTCFullYear()}년 ${LAST_DAY.getUTCMonth() + 1}월 ${LAST_DAY.getUTCDate()}일까지`;

/**
 * 사전예약 (/early) 집계. 의뢰자 설문(소속·분야·시기·연간 건수·견적 받는 곳 수)과 기관 설문(분야·GLP·월 견적서 수)을 세고 목록을 본다.
 * 기관 설득에 쓰는 숫자다. 휴대폰 번호는 가려서 보여 준다.
 */
export default async function AdminEarly({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  await requireSession("admin");
  const { role: roleQ } = await searchParams;
  const role = roleQ === "req" || roleQ === "cro" ? roleQ : "";
  const sb = dbReady() ? getSupabaseAdmin() : null;
  if (!sb) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const { data, error } = await sb.from("early_signups").select("*").order("created_at", { ascending: false }).limit(2000);
  if (error) return <ErrorState title="사전예약을 불러오지 못했어요">{error.message}</ErrorState>;
  const rows = data ?? [];
  const req = rows.filter((r) => r.role === "req");
  const cro = rows.filter((r) => r.role === "cro");
  type R = (typeof rows)[number];
  const count = (list: R[], f: (r: R) => boolean) => list.filter(f).length;
  const yearlyLow = req.reduce((n, r) => n + (r.yearly ? YEARLY_LOW[r.yearly] ?? 0 : 0), 0);
  const smsDone = count(rows, (r) => !!r.done_sms_at);
  const adAgreed = count(rows, (r) => !!r.ad_agreed_at);
  const shown = role ? rows.filter((r) => r.role === role) : rows;
  const tabs = [["", "전체"], ["req", "의뢰자"], ["cro", "기관"]].map(([k, label]) => ({ href: k ? `/admin/early?role=${k}` : "/admin/early", label, on: role === k }));

  const Dist = ({ title, list, opts, get }: { title: string; list: R[]; opts: readonly string[]; get: (r: R) => string | null }) => (
    <div className="card tbl-wrap">
      <table className="tbl">
        <thead><tr><th>{title}</th><th className="num">건</th></tr></thead>
        <tbody>
          {opts.map((o) => <tr key={o}><td>{o}</td><td className="num tnum">{count(list, (r) => get(r) === o)}</td></tr>)}
          {count(list, (r) => !get(r)) > 0 && <tr><td className="adm-muted">답 없음 (옛 양식)</td><td className="num tnum">{count(list, (r) => !get(r))}</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="ph">
        <div>
          <h1>사전예약</h1>
          <p title={`${EARLY_DELETE_AFTER}에 모두 지움`}>{PERIOD}</p>
        </div>
      </div>
      <div className="adm-bar"><FilterChips label="갈래" items={tabs} /></div>
      {rows.length === 0 ? (
        <EmptyState title="사전예약이 없어요" />
      ) : shown.length === 0 ? (
        <EmptyState kind="filtered" title={`${ROLE_KO[role as "req" | "cro"]} 사전예약이 없어요`} action={<a href="/admin/early" className="b2 bsm">전체 보기</a>} />
      ) : (
        <>
          <AdminSection id="list" title="예약 목록" count={shown.length}>
          <div className="card tbl-wrap">
            <table className="tbl">
              <thead><tr><th>시각</th><th>갈래</th><th>이름</th><th>이메일</th><th>기관명·소속</th><th>설문</th><th>완료 문자</th><th>유입</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className="tnum nowrap">{mdhm(r.updated_at)}</td>
                    <td>{ROLE_KO[r.role]}</td>
                    <td style={{ fontSize: 13 }}>{r.name ?? "-"}</td>
                    <td style={{ fontSize: 13 }}>{r.email}</td>
                    <td style={{ fontSize: 13 }}>{r.org ?? r.org_type ?? "-"}</td>
                    <td>{(r.role === "req" ? [r.timing, r.yearly, r.quote_count] : [r.glp[0], r.monthly]).some(Boolean) ? <span className="pill pill--ok">완료</span> : "-"}</td>
                    <td>{r.done_sms_at ? <span className="pill pill--ok">보냄</span> : "-"}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.source ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </AdminSection>
          <details className="cat-more" style={{ marginTop: 16 }}>
            <summary>설문 집계</summary>
            <p className="adm-small adm-muted" style={{ margin: "8px 0" }}>의뢰자 {req.length}건 · 기관 {cro.length}건 · 완료 문자 {smsDone}건 · 광고성 정보 동의 {adAgreed}건 · 연간 의뢰 건수 하한 합 <b className="tnum adm-ink">{yearlyLow.toLocaleString("ko-KR")}건</b></p>
            <div className="card tbl-wrap" style={{ marginBottom: 16 }}>
              <table className="tbl">
                <thead><tr><th>분야</th><th className="num">의뢰자</th><th className="num">기관</th></tr></thead>
                <tbody>
                  {EARLY_KINDS.map((k) => (
                    <tr key={k}><td>{EARLY_KIND_LABEL[k]} {k}</td><td className="num tnum">{count(req, (r) => r.kinds.includes(k))}</td><td className="num tnum">{count(cro, (r) => r.kinds.includes(k))}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="adm-grid">
              <Dist title="의뢰자 소속" list={req} opts={EARLY_ORG_TYPES} get={(r) => r.org_type} />
              <Dist title="첫 의뢰 시기" list={req} opts={EARLY_WHEN} get={(r) => r.timing} />
              <Dist title="1년 의뢰 건수" list={req} opts={EARLY_YEARLY} get={(r) => r.yearly} />
              <Dist title="견적 받는 곳 수" list={req} opts={EARLY_QUOTE_COUNT} get={(r) => r.quote_count} />
              <Dist title="기관 GLP 인증" list={cro} opts={EARLY_GLP} get={(r) => r.glp[0] ?? null} />
              <Dist title="기관 월 견적서 수" list={cro} opts={EARLY_MONTHLY} get={(r) => r.monthly} />
            </div>
          </details>
        </>
      )}
    </>
  );
}
