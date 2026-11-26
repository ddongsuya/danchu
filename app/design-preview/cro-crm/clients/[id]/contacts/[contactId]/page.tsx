import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactView } from "@/components/cro/crm/ContactView";
import { Frame } from "../../../../frame";
import { previewCtx, previewEnabled } from "../../../../fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "담당자 화면 검토 · 단추", robots: { index: false, follow: false } };

/** 예: /design-preview/cro-crm/clients/00000000-0000-4000-8000-000000000001/contacts/00000000-0000-4000-8000-000000000101 (가람바이오 박 팀장) */
export default async function CrmContactPreview({ params }: { params: Promise<{ id: string; contactId: string }> }) {
  if (!previewEnabled()) notFound();
  const { id, contactId } = await params;
  return <Frame><ContactView c={previewCtx()} companyId={id} contactId={contactId} /></Frame>;
}
