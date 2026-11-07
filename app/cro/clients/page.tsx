import { requireSession } from "@/lib/auth";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { CompaniesView, parseCompaniesQuery } from "@/components/cro/crm/CompaniesView";
import { loadCtx } from "@/components/cro/crm/load";

export const dynamic = "force-dynamic";

/** 고객사 (CRM 1단계). ?f=open|danchu|quiet ?q= */
export default async function CroClients({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession("cro");
  const got = await loadCtx(s);
  if (!got) return <><div className="ph"><div><h1>고객사</h1></div></div><PendingOrg org={s.org} pendingOrg={s.pendingOrg} /></>;
  return <CompaniesView c={got.c} q={parseCompaniesQuery(await searchParams)} />;
}
