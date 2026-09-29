import { requireSession } from "@/lib/auth";
import { dbReady, listRequestsForUser } from "@/lib/data";
import { Crumb } from "@/components/app/ui";
import { SupportForm } from "@/components/SupportForm";

export const dynamic = "force-dynamic";

export default async function Support({ searchParams }: { searchParams: Promise<{ rfq?: string }> }) {
  const { rfq } = await searchParams;
  const s = await requireSession();
  const reqs = dbReady() && s.profile.role === "requester" ? await listRequestsForUser(s.userId, s.email) : [];
  return (
    <>
      <Crumb href="/app/profile" label="프로필" />
      <div className="ph">
        <div>
          <h1>무엇을 도와드릴까요?</h1>
          <p>문의 내용을 확인하고 이메일로 답변합니다. 관련 요청이 있으면 함께 선택해 주세요.</p>
        </div>
      </div>
      <SupportForm initialRfq={rfq} email={s.email} requests={reqs.map((r) => ({ no: r.rfq_no, substance: r.substance }))} />
    </>
  );
}
