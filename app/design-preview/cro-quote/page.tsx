import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReplyDone } from "@/components/cro/ReplyDone";
import { Frame } from "../cro-crm/frame";
import { previewEnabled } from "../cro-crm/fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "제출 완료 검토 · 단추", robots: { index: false, follow: false } };

/** 제출 완료 화면 배치 검토. 수주는 받은 요청의 "선정" 탭으로 옮겨 여기서 보지 않는다. 예시 값만 쓰고 저장하지 않는다 */
export default async function CroQuotePreview() {
  if (!previewEnabled()) notFound();
  return <Frame><ReplyDone no="R-2611-013" replyBy="2026-12-08" total={168_000_000} weeks="20" editHref="/design-preview/cro-quote" backHref="/design-preview/cro-crm/requests" backLabel="받은 요청" /></Frame>;
}
