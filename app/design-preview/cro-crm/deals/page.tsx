import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DealsView, parseDealsQuery } from "@/components/cro/crm/DealsView";
import { Frame } from "../frame";
import { previewCtx, previewEnabled } from "../fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "안건 검토 · 단추", robots: { index: false, follow: false } };

export default async function CrmDealsPreview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!previewEnabled()) notFound();
  return <Frame><DealsView c={previewCtx()} q={parseDealsQuery(await searchParams)} /></Frame>;
}
