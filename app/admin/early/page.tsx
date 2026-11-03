import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { mdhm } from "@/lib/format";
import { EARLY_DELETE_AFTER, EARLY_INTENT, EARLY_KIND_LABEL, EARLY_KINDS, EARLY_WHEN, type EarlyKind } from "@/lib/early";

export const dynamic = "force-dynamic";

const ROLE_KO = { req: "의뢰자", cro: "기관" } as const;

/** 사전예약 (/early). 갈래·분야·예정 시기·참여 생각을 세고, 예약 목록을 본다. 기관 설득에 쓰는 숫자 */
export default async function AdminEarly() {
  await requireSession("admin");
  const sb = dbReady() ? getSupabaseAdmin() : null;
  if (!sb) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const { data, error } = await sb.from("early_signups").select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) return <div className="empty"><b>예약을 읽지 못했습니다</b><p>마이그레이션 0030을 적용했는지 확인해 주세요. ({error.message})</p></div>;
  const rows = data ?? [];
  const req = rows.filter((r) => r.role === "req");
  const cro = rows.filter((r) => r.role === "cro");
  const count = (list: typeof rows, f: (r: (typeof rows)[number]) => boolean) => list.filter(f).length;

  return (
    <>
      <div className="ph">
        <div>
          <h1>사전예약</h1>
          <p>의뢰자 {req.length}건 · 기관 {cro.length}건 · {EARLY_DELETE_AFTER} 뒤 정리 작업이 모두 지웁니다</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty"><b>아직 예약이 없습니다</b><p>danchu.kr/early 에서 예약하면 여기에 쌓입니다.</p></div>
      ) : (
        <>
          <div className="card tbl-wrap">
            <table className="tbl">
              <thead><tr><th>분야</th><th className="num">의뢰자</th><th className="num">기관</th></tr></thead>
              <tbody>
                {EARLY_KINDS.map((k: EarlyKind) => (
                  <tr key={k}><td>{EARLY_KIND_LABEL[k]} {k}</td><td className="num tnum">{count(req, (r) => r.kinds.includes(k))}</td><td className="num tnum">{count(cro, (r) => r.kinds.includes(k))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card tbl-wrap">
            <table className="tbl">
              <thead><tr><th>의뢰자 예정 시기</th><th className="num">건</th><th>기관 참여 생각</th><th className="num">건</th></tr></thead>
              <tbody>
                {EARLY_INTENT.map((t, i) => (
                  <tr key={t}>
                    <td>{EARLY_WHEN[i] ?? ""}</td><td className="num tnum">{EARLY_WHEN[i] ? count(req, (r) => r.timing === EARLY_WHEN[i]) : ""}</td>
                    <td>{t}</td><td className="num tnum">{count(cro, (r) => r.intent === t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card tbl-wrap">
            <table className="tbl">
              <thead><tr><th>시각</th><th>갈래</th><th>이메일</th><th>기관명·유형</th><th>분야</th><th>시기·참여 생각</th><th>GLP</th><th>확인하고 싶은 점</th><th>유입</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="tnum" style={{ whiteSpace: "nowrap" }}>{mdhm(r.updated_at)}</td>
                    <td>{ROLE_KO[r.role]}</td>
                    <td style={{ fontSize: 13 }}>{r.email}</td>
                    <td style={{ fontSize: 13 }}>{r.org ?? r.org_type ?? "-"}</td>
                    <td style={{ fontSize: 13 }}>{r.kinds.join(" · ")}</td>
                    <td style={{ fontSize: 13 }}>{r.timing ?? r.intent ?? "-"}</td>
                    <td style={{ fontSize: 12 }}>{r.glp.length ? r.glp.join(" · ") : "-"}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)", maxWidth: 280 }}>{r.ask ?? "-"}</td>
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
