import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportsView, parseReportsQuery } from "@/components/cro/crm/ReportsView";
import { Frame } from "../frame";
import { previewCtx, previewEnabled } from "../fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "보고서 검토 · 단추", robots: { index: false, follow: false } };

export default async function CrmReportsPreview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!previewEnabled()) notFound();
  return <Frame><ReportsView c={previewCtx()} q={parseReportsQuery(await searchParams)} /></Frame>;
}
