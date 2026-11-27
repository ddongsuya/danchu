import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { isUuid } from "@/lib/crm-shape";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { DealView, dealPane, dealTab } from "@/components/cro/crm/DealView";
import { loadCtx } from "@/components/cro/crm/load";

export const dynamic = "force-dynamic";

/** 안건 화면 (시안 v5 3번). ?m= 휴대폰 칸 나누기, ?v=quotes 견적·계약 */
export default async function CroDeal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string; v?: string }> }) {
  const s = await requireSession("cro");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const got = await loadCtx(s);
  if (!got) return <PendingOrg org={s.org} pendingOrg={s.pendingOrg} />;
  const sp = await searchParams;
  return <DealView c={got.c} id={id} m={dealTab(sp.m)} v={dealPane(sp.v)} />;
}
