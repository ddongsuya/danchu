import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { isUuid } from "@/lib/crm-shape";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { CompanyView } from "@/components/cro/crm/CompaniesView";
import { loadCtx } from "@/components/cro/crm/load";

export const dynamic = "force-dynamic";

/** 고객사 화면 (시안 v5 5번). ?t=email|meeting|call 기록 거르기 */
export default async function CroClient({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const s = await requireSession("cro");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const got = await loadCtx(s);
  if (!got) return <PendingOrg org={s.org} pendingOrg={s.pendingOrg} />;
  return <CompanyView c={got.c} id={id} t={(await searchParams).t} />;
}
