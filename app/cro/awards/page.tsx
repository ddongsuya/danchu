import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listAwardsForOrg } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { AwardCard } from "@/components/cro/AwardCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function CroAwards() {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  const list = dbReady() ? await listAwardsForOrg(org.id) : [];

  return (
    <>
      <div className="ph">
        <div>
          <h1>수주</h1>
          <p>의뢰자가 우리 기관을 고른 요청이에요. 의뢰자 연락처가 열려 있어요.</p>
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState title="아직 수주가 없어요" action={<Link href="/cro/requests" className="b2 bsm">받은 요청 보기</Link>}>
          의뢰자가 우리 기관을 고르면 알림으로 알려요.
        </EmptyState>
      ) : (
        <div className="lq-aws">
          {list.map((a) => <AwardCard key={a.id} a={a} />)}
        </div>
      )}
    </>
  );
}
