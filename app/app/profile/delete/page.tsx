import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CONTRACT_STATUSES, OPEN_STATUSES } from "@/lib/account";
import { likeExact, orValue } from "@/lib/sql";
import { DeleteAccountForm } from "@/components/app/DeleteAccountForm";

export const dynamic = "force-dynamic";

/**
 * 회원 탈퇴. 지워지는 것과 남는 것을 먼저 보여 주고, 아래 폼에서 확인을 받는다.
 * 운영자 계정과 계약 진행 중인 의뢰자는 여기서 막는다 (API 도 같은 규칙).
 */
export default async function DeleteAccountPage() {
  const s = await requireSession();
  const base = s.profile.role === "cro" ? "/cro" : "/app";
  const isAdmin = s.profile.role === "admin";

  let open = 0;
  let contracting: string[] = [];
  if (dbReady() && !isAdmin) {
    const sb = getSupabaseAdmin()!;
    const { data } = await sb.from("rfq_requests").select("rfq_no, status").or(`user_id.eq.${s.userId},email.ilike.${orValue(likeExact(s.email.toLowerCase()))}`);
    open = (data ?? []).filter((r) => (OPEN_STATUSES as readonly string[]).includes(r.status)).length;
    contracting = (data ?? []).filter((r) => (CONTRACT_STATUSES as readonly string[]).includes(r.status)).map((r) => r.rfq_no);
  }

  return (
    <>
      <div className="ph">
        <div>
          <h1>회원 탈퇴</h1>
          <p>{s.email}</p>
        </div>
      </div>
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card card--pad stack" style={{ gap: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>탈퇴하면</h2>
          <ul style={{ paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: "var(--muted)" }}>
            <li>계정, 프로필, 알림이 바로 삭제됩니다. 되돌릴 수 없습니다.</li>
            <li>보낸 요청서에서 담당자 이름·이메일·전화·접속 기록이 지워집니다. 회사명과 시험 내용은 회신 기관의 기록 근거로 남습니다.</li>
            <li>기관을 선정하지 않은 요청의 첨부파일은 삭제됩니다. 선정한 요청의 첨부는 계약 근거로 보관합니다.</li>
            {s.profile.role === "cro" ? <li>기관과 다른 담당자의 정보는 그대로입니다. 기관이 제출한 견적은 기관 기록으로 남습니다.</li> : null}
          </ul>
          {open > 0 && <p className="note note--warn" style={{ fontSize: 14 }}>진행 중인 요청 {open}건이 취소되고 회신 중인 기관에 안내됩니다.</p>}
          {contracting.length > 0 && (
            <p className="note note--warn" style={{ fontSize: 14 }}>
              기관을 선정한 요청({contracting.join(", ")})이 진행 중이라 지금은 탈퇴할 수 없습니다. 계약이 끝나거나 운영자가 종료 처리한 뒤 다시 시도해 주세요. 문의: <a href="mailto:hello@danchu.kr">hello@danchu.kr</a>
            </p>
          )}
          {isAdmin && <p className="note note--warn" style={{ fontSize: 14 }}>운영자 계정은 탈퇴할 수 없습니다. 먼저 다른 운영자에게 역할 변경을 요청해 주세요.</p>}
        </div>
        <div className="card card--pad">
          {isAdmin || contracting.length > 0 ? (
            <Link href={`${base}/profile`} className="b2">프로필로 돌아가기</Link>
          ) : (
            <DeleteAccountForm email={s.email} />
          )}
        </div>
      </div>
    </>
  );
}
