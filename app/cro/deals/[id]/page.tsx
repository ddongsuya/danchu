import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { isUuid } from "@/lib/crm-shape";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { DealView, dealTab } from "@/components/cro/crm/DealView";
import { loadCtx } from "@/components/cro/crm/load";

export const dynamic = "force-dynamic";

/** 안건 화면 (시안 v5 3번) */
export default async function CroDeal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const s = await requireSession("cro");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const got = await loadCtx(s);
  if (!got) return <PendingOrg org={s.org} pendingOrg={s.pendingOrg} />;
  return <DealView c={got.c} id={id} m={dealTab((await searchParams).m)} />;
}
