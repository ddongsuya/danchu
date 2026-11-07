import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DealView, dealTab } from "@/components/cro/crm/DealView";
import { Frame } from "../../frame";
import { previewCtx, previewEnabled } from "../../fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "안건 화면 검토 · 단추", robots: { index: false, follow: false } };

/** 예: /design-preview/cro-crm/deals/00000000-0000-4000-8000-000000001003 (가람바이오 협의) */
export default async function CrmDealPreview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  if (!previewEnabled()) notFound();
  return <Frame><DealView c={previewCtx()} id={(await params).id} m={dealTab((await searchParams).m)} /></Frame>;
}
