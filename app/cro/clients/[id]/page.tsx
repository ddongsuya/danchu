import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { isUuid } from "@/lib/crm-shape";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { CompanyView } from "@/components/cro/crm/CompaniesView";
import { loadCtx } from "@/components/cro/crm/load";

export const dynamic = "force-dynamic";

/** 고객사 화면. ?tab=people|acts 탭, ?t=meeting|call 기록 거르기, ?p= 담당자 한 명의 기록 */
export default async function CroClient({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; p?: string; tab?: string }> }) {
  const s = await requireSession("cro");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const got = await loadCtx(s);
  if (!got) return <PendingOrg org={s.org} pendingOrg={s.pendingOrg} />;
  const sp = await searchParams;
  return <CompanyView c={got.c} id={id} t={sp.t} p={isUuid(sp.p) ? sp.p : undefined} v={sp.tab} />;
}
