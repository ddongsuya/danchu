import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listAudit } from "@/lib/data";
import { mdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTION_KO: Record<string, string> = {
  "org.approve": "기관 승인", "org.reject": "기관 반려", "org.suspend": "기관 중지", "org.terms": "기관 약정·설정 변경",
  "user.role": "역할·기관 연결 변경", "user.delete": "계정 삭제",
  "invite.billing": "청구 제외·복원",
  "rfq.deadline": "회신 기한 변경",
};
const TARGET_HREF: Record<string, (id: string, label: string | null) => string | null> = {
  cro_org: (id) => `/admin/cros/${id}`,
  profile: () => "/admin/users",
  rfq_request: (_id, label) => (label ? `/admin/r/${label}` : null),
  rfq_invite: () => "/admin/billing",
};

/** 운영자 행위 기록. 요청 단위 이력(각 요청의 "이력")에 없는 기관·사용자·청구 변경을 본다 */
export default async function AdminAudit() {
  await requireSession("admin");
  if (!dbReady()) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const rows = await listAudit(200);
  return (
    <>
      <div className="ph">
        <div>
          <h1>운영 기록</h1>
          <p>기관 승인·반려·중지, 약정 변경, 역할·기관 연결, 계정 삭제, 청구 제외, 기한 변경 · 최근 200건</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty"><b>기록이 없습니다</b></div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead><tr><th>시각</th><th>운영자</th><th>동작</th><th>대상</th><th>변경</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const href = TARGET_HREF[r.target_type]?.(r.target_id ?? "", r.target_label);
                const after = r.after && typeof r.after === "object" ? Object.entries(r.after as Record<string, unknown>) : [];
                return (
                  <tr key={r.id}>
                    <td className="tnum" style={{ whiteSpace: "nowrap" }}>{mdhm(r.created_at)}</td>
                    <td style={{ fontSize: 13 }}>{r.actor_email ?? "-"}</td>
                    <td>{ACTION_KO[r.action] ?? r.action}</td>
                    <td style={{ fontSize: 13 }}>{href ? <Link href={href}>{r.target_label ?? r.target_type}</Link> : (r.target_label ?? r.target_type)}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>
                      {after.length ? after.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(" · ") : r.note ?? "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
