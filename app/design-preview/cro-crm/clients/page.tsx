import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompaniesView, parseCompaniesQuery } from "@/components/cro/crm/CompaniesView";
import { Frame } from "../frame";
import { previewCtx, previewEnabled } from "../fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "고객사 검토 · 단추", robots: { index: false, follow: false } };

export default async function CrmClientsPreview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!previewEnabled()) notFound();
  return <Frame><CompaniesView c={previewCtx()} q={parseCompaniesQuery(await searchParams)} /></Frame>;
}
