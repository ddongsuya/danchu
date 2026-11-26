import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AwardCard, type AwardItem } from "@/components/cro/AwardCard";
import { ReplyDone } from "@/components/cro/ReplyDone";
import { Frame } from "../cro-crm/frame";
import { previewEnabled, sample } from "../cro-crm/fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "수주·제출 완료 검토 · 단추", robots: { index: false, follow: false } };

/** 기관 수주(/cro/awards)와 제출 완료 화면의 배치 검토. ?view=done 은 제출 완료. 예시 값만 쓰고 저장하지 않는다 */
export default async function CroQuotePreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!previewEnabled()) notFound();
  const { view } = await searchParams;
  if (view === "done") {
    return <Frame><ReplyDone no="R-2611-013" replyBy="2026-12-08" total={168_000_000} weeks="20" editHref="/design-preview/cro-quote?view=done" backHref="/design-preview/cro-quote" backLabel="제출한 견적" /></Frame>;
  }
  const { awards } = sample();
  const list = awards.map((a) => ({ ...a, contract_date: a.contract_reported_at ? String(a.contract_reported_at).slice(0, 10) : null })) as unknown as AwardItem[];
  return (
    <Frame>
      <div className="ph"><div><h1>수주</h1><p>의뢰자가 우리 기관을 고른 요청이에요. 의뢰자 연락처가 열려 있어요.</p></div></div>
      <div className="lq-aws">{list.map((a) => <AwardCard key={a.id} a={a} />)}</div>
    </Frame>
  );
}
