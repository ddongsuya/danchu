import { requireSession } from "@/lib/auth";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { DealsView, parseDealsQuery } from "@/components/cro/crm/DealsView";
import { loadCtx } from "@/components/cro/crm/load";

export const dynamic = "force-dynamic";

/** 안건 보드·목록 (시안 v5 2번). ?v=list ?f=mine|need|nonext ?kind= ?src=danchu|direct ?s=won|lost|all ?q= ?st=(휴대폰 단계) */
export default async function CroDeals({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession("cro");
  const got = await loadCtx(s);
  if (!got) return <><div className="ph"><div><h1>안건</h1></div></div><PendingOrg org={s.org} pendingOrg={s.pendingOrg} /></>;
  return <DealsView c={got.c} q={parseDealsQuery(await searchParams)} />;
}
