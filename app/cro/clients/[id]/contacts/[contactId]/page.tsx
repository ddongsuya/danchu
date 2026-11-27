import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { isUuid } from "@/lib/crm-shape";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { ContactView } from "@/components/cro/crm/ContactView";
import { loadCtx } from "@/components/cro/crm/load";

export const dynamic = "force-dynamic";

/** 고객사 담당자 한 명 (와이어프레임 v7 c-contact). 다른 고객사·다른 기관의 담당자는 찾지 못한 것으로 */
export default async function CroContact({ params }: { params: Promise<{ id: string; contactId: string }> }) {
  const s = await requireSession("cro");
  const { id, contactId } = await params;
  if (!isUuid(id) || !isUuid(contactId)) notFound();
  const got = await loadCtx(s);
  if (!got) return <PendingOrg org={s.org} pendingOrg={s.pendingOrg} />;
  return <ContactView c={got.c} companyId={id} contactId={contactId} />;
}
