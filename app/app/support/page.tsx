import { requireSession } from "@/lib/auth";
import { dbReady, listRequestsForUser } from "@/lib/data";
import { Crumb } from "@/components/app/ui";
import { SupportForm } from "@/components/SupportForm";

export const dynamic = "force-dynamic";

export default async function Support({ searchParams }: { searchParams: Promise<{ rfq?: string; type?: string }> }) {
  const { rfq, type } = await searchParams;
  const s = await requireSession();
  const reqs = dbReady() && s.profile.role === "requester" ? await listRequestsForUser(s.userId) : [];
  return (
    <>
      <Crumb href={s.profile.role === "cro" ? "/cro/profile" : "/app/profile"} label="프로필" />
      <div className="ph">
        <div>
          <h1>문의하기</h1>
        </div>
      </div>
      <SupportForm initialRfq={rfq} initialType={type} email={s.email} requests={reqs.map((r) => ({ no: r.rfq_no, substance: r.substance }))} />
    </>
  );
}
