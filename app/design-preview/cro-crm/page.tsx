import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TodayView } from "@/components/cro/crm/TodayView";
import { Frame } from "./frame";
import { previewCtx, previewEnabled } from "./fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "오늘 검토 · 단추", robots: { index: false, follow: false } };

/** CRM 오늘 검토용. Vercel 미리보기 배포에서만 열린다 */
export default function CrmTodayPreview() {
  if (!previewEnabled()) notFound();
  const c = previewCtx();
  return <Frame><TodayView c={c} undecided={[...c.danchu.values()]} /></Frame>;
}
