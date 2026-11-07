import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pipeline } from "@/components/cro/Pipeline";
import { buildPipeline } from "@/lib/pipeline";
import { Frame } from "../frame";
import { PATHS, previewEnabled, sample } from "../fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "받은 요청 검토 · 단추", robots: { index: false, follow: false } };

export default async function CrmRequestsPreview({ searchParams }: { searchParams: Promise<{ sel?: string }> }) {
  if (!previewEnabled()) notFound();
  const { sel } = await searchParams;
  const { invites, awards } = sample();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = buildPipeline(invites as any, awards as any);
  return <Frame><Pipeline items={items} sel={sel ?? null} paths={PATHS} companyOf={{ u5: "00000000-0000-4000-8000-000000000001" }} /></Frame>;
}
