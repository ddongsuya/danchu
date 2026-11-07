import { requireSession } from "@/lib/auth";
import { dbReady, listAwardsForOrg, listInvitesForOrg } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { Pipeline } from "@/components/cro/Pipeline";
import { buildPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

/**
 * 견적 진행 (2026-11-07). 받은 요청 · 제출한 견적 · 수주를 요청 하나의 흐름으로 본다.
 * ?sel=<초대 id> 는 오른쪽(휴대폰은 다음 화면) 상세. 빠진 배포는 승인·분야 변경 시점과 매일 크론이 채운다.
 */
export default async function CroPipeline({ searchParams }: { searchParams: Promise<{ sel?: string }> }) {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") {
    return (
      <>
        <div className="ph"><div><h1>견적 진행</h1></div></div>
        <PendingOrg org={org} pendingOrg={s.pendingOrg} />
      </>
    );
  }
  const { sel } = await searchParams;
  const [invites, awards] = dbReady() ? await Promise.all([listInvitesForOrg(org.id), listAwardsForOrg(org.id)]) : [[], []];
  const items = buildPipeline(invites, awards);
  return <Pipeline items={items} sel={sel && /^[0-9a-f-]{36}$/.test(sel) ? sel : null} />;
}
