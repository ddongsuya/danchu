import { requireSession } from "@/lib/auth";
import { dbReady, listRequestsForUser } from "@/lib/data";
import { Crumb } from "@/components/app/ui";
import { SupportForm } from "@/components/SupportForm";

export const dynamic = "force-dynamic";

export default async function Support() {
  const s = await requireSession();
  const reqs = dbReady() && s.profile.role === "requester" ? await listRequestsForUser(s.userId, s.email) : [];
  return (
    <>
      <Crumb href="/app/profile" label="프로필" />
      <div className="ph">
        <div>
          <h1>무엇을 도와드릴까요?</h1>
          <p>영업일 기준 1일 내 이메일로 답변합니다. 요청 건과 관련되면 번호를 선택해 주세요.</p>
        </div>
      </div>
      <SupportForm email={s.email} requests={reqs.map((r) => ({ no: r.rfq_no, substance: r.substance }))} />
    </>
  );
}
