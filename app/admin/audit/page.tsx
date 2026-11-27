import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listAudit } from "@/lib/data";
import { mdhm } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchBox } from "@/components/admin/SearchBox";
import { ErrorState } from "@/components/ui/ErrorState";
import { particle } from "@/components/admin/act";
import { captureError } from "@/lib/observe";

export const dynamic = "force-dynamic";

const ACTION_KO: Record<string, string> = {
  "org.approve": "기관 승인", "org.reject": "기관 반려", "org.suspend": "기관 중지", "org.terms": "기관 약정·설정 변경",
  "org.create": "기관 추가(운영자 관리)", "org.optout": "수신 거부 처리",
  "user.role": "역할·기관 연결 변경", "user.delete": "계정 삭제",
  "invite.billing": "청구 제외·복원", "billing.close": "청구 월 마감", "billing.adjust": "청구 조정 항목 추가", "invite.decline_proxy": "불참 대리 기록", "invite.withdraw_proxy": "참여 철회 대리 기록",
  "rfq.deadline": "회신 기한 변경", "rfq.join_by": "참여 결정 기한 연장", "rfq.distribute_override": "지명 기관 밖 참여 안내(의뢰자 요청)", "rfq.opt_in_transition": "참여 선택형 전환",
  "rfq.close_replies": "회신 마감",
  "quote.proxy": "견적 대리 입력", "qna.view": "질의응답 기록 열람",
  "award.contract": "계약 체결 기록·정정", "award.contract_status": "계약 상태 기록",
};
/** 대상 라벨이 "요청번호 · 기관명" 인 행은 요청 화면으로 보낸다 */
const rfqOf = (label: string | null) => (label ? label.split(" · ")[0] || null : null);
const TARGET_HREF: Record<string, (id: string, label: string | null) => string | null> = {
  cro_org: (id) => `/admin/cros/${id}`,
  profile: () => "/admin/users",
  rfq_request: (id, label) => (id && label ? `/admin/r/${label}` : null),
  rfq_invite: () => "/admin/billing",
  cro_quote: (_id, label) => (rfqOf(label) ? `/admin/r/${rfqOf(label)}` : null),
  rfq_award: () => "/admin/awards",
  billing_period: (_id, label) => (label && /^\d{4}-\d{2}$/.test(label) ? `/admin/billing?month=${label}` : "/admin/billing"),
};

/** 운영자 행위 기록. 요청 단위 이력(각 요청의 "이력")에 없는 기관·사용자·청구 변경을 본다 */
export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSession("admin");
  if (!dbReady()) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const all = await listAudit(200).catch((e: unknown) => { captureError(e, "admin:audit"); return null; });
  // 검색은 최근 200건 안에서 대상 이름과 동작 이름으로 거른다
  const rows = (all ?? []).filter((r) => !q || [r.target_label ?? "", ACTION_KO[r.action] ?? r.action].some((t) => t.includes(q)));
  return (
    <>
      <div className="ph">
        <div>
          <h1>운영 기록</h1>
        </div>
        <div className="ph__actions"><SearchBox q={q} placeholder="대상 · 동작" /></div>
      </div>
      {!all ? (
        <ErrorState title="운영 기록을 불러오지 못했어요" />
      ) : rows.length === 0 ? (
        q
          ? <EmptyState kind="filtered" title={`'${q}'${particle(q, "과", "와")} 맞는 기록이 없어요`} action={<Link href="/admin/audit" className="b2 bsm">검색 지우기</Link>} />
          : <EmptyState title="기록이 없어요" />
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
                    <td className="tnum nowrap">{mdhm(r.created_at)}</td>
                    <td style={{ fontSize: 13 }}>{r.actor_email ?? "운영자"}</td>
                    <td>{ACTION_KO[r.action] ?? r.action}</td>
                    <td style={{ fontSize: 13 }}>{href ? <Link href={href}>{r.target_label ?? r.target_type}</Link> : (r.target_label ?? r.target_type)}</td>
                    <td className="adm-small adm-muted adm-wrap">
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
