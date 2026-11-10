import { requireSession } from "@/lib/auth";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { ReportsView, parseReportsQuery } from "@/components/cro/crm/ReportsView";
import { loadCtx } from "@/components/cro/crm/load";

export const dynamic = "force-dynamic";

/** 보고서 (시안 v5 7번). ?tab=w|f|a ?p=m1|m3|y ?owner= */
export default async function CroReports({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession("cro");
  const got = await loadCtx(s);
  if (!got) return <><div className="ph"><div><h1>보고서</h1></div></div><PendingOrg org={s.org} pendingOrg={s.pendingOrg} /></>;
  return <ReportsView c={got.c} q={parseReportsQuery(await searchParams)} />;
}
