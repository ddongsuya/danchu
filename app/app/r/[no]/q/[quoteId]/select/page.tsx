import Link from "next/link";
import { quoteSelectable } from "@/lib/quote-policy";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { Crumb } from "@/components/app/ui";
import { SelectCroForm } from "@/components/SelectCroForm";
import { md, won } from "@/lib/format";
import { comparisonOpened } from "@/lib/reply-window";
import { QUOTE_CHANGED_MESSAGE } from "@/lib/rpc";

export const dynamic = "force-dynamic";

export default async function SelectCro({ params, searchParams }: { params: Promise<{ no: string; quoteId: string }>; searchParams: Promise<{ rev?: string }> }) {
  const s = await requireSession("requester");
  const { no, quoteId } = await params;
  // 의뢰자가 견적 상세에서 확인한 판. 상세의 선택 버튼이 ?rev= 로 넘긴다
  const { rev } = await searchParams;
  const seenRevision = rev && /^\d{1,9}$/.test(rev) ? Number(rev) : 0;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) notFound();
  // 선정은 비교표가 열린 뒤에만 (2026-10-20 결정 1, 0025 select_quote not_compared). 열리기 전에는 비교표 화면이 진행 숫자를 보여 준다
  if (!comparisonOpened(rfq)) redirect(`/app/r/${rfq.rfq_no}/compare`);
  const d = await getRfqDetail(rfq);
  const q = d.quotes.find((x) => x.id === quoteId && x.status === "submitted");
  if (!q || ["closed", "cancelled"].includes(rfq.status)) notFound();
  if (rfq.selected_quote_id) {
    return (
      <>
        <Crumb href={`/app/r/${rfq.rfq_no}`} label={rfq.rfq_no} />
        <div className="note note--ok">이미 CRO를 선택한 요청입니다. 진행 상태는 요청 상세에서 확인하세요.</div>
      </>
    );
  }
  // 상세에서 본 뒤 기관이 견적(항목·조건·PDF 포함)을 고쳤으면 여기서 선택하지 않고 상세를 다시 보게 한다
  if (!seenRevision || seenRevision !== q.revision) {
    return (
      <>
        <Crumb href={`/app/r/${rfq.rfq_no}/q/${q.id}`} label="견적서" />
        <div className="note note--warn">{QUOTE_CHANGED_MESSAGE} <Link href={`/app/r/${no}/q/${quoteId}`}>견적 상세 다시 보기</Link></div>
      </>
    );
  }
  if (!quoteSelectable(q)) return <div className="note note--warn">정식 견적서와 유효기간을 확인한 뒤 기관을 선택해 주세요. <Link href={`/app/r/${no}/q/${quoteId}`}>견적 상세로 돌아가기</Link></div>;
  const others = d.quotes.filter((x) => x.status === "submitted" && x.id !== q.id);

  return (
    <>
      <Crumb href={`/app/r/${rfq.rfq_no}/q/${q.id}`} label="견적서" />
      <div className="ph">
        <div>
          <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>{rfq.rfq_no}</span>
          <h1>이 기관과 진행할까요?</h1>
          <p>선택하면 이 기관과 서로 연락처를 주고받습니다. 계약은 기관과 직접 맺고, 단추는 조건에 관여하지 않습니다.</p>
        </div>
      </div>
      <SelectCroForm
        no={rfq.rfq_no}
        quoteId={q.id}
        revision={seenRevision}
        croName={q.cro_name}
        summary={[
          ["총 견적액", won(q.total_amount ?? 0)],
          ["착수 · 기간", `${md(q.start_date)} · ${q.total_weeks ? `${q.total_weeks}주` : "-"}`],
          ["유효기간", md(q.valid_until)],
        ]}
        others={others.map((o) => ({ name: o.cro_name, total: won(o.total_amount ?? 0) }))}
        contact={`${rfq.company} · ${rfq.contact_name} · ${rfq.email}${rfq.phone ? ` · ${rfq.phone}` : ""}`}
      />
    </>
  );
}
