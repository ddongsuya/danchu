import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyView } from "@/components/cro/crm/CompaniesView";
import { Frame } from "../../frame";
import { previewCtx, previewEnabled } from "../../fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "고객사 화면 검토 · 단추", robots: { index: false, follow: false } };

/** 예: /design-preview/cro-crm/clients/00000000-0000-4000-8000-000000000001 (가람바이오) */
export default async function CrmClientPreview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  if (!previewEnabled()) notFound();
  return <Frame><CompanyView c={previewCtx()} id={(await params).id} t={(await searchParams).t} /></Frame>;
}
