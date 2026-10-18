import Link from "next/link";
import { quoteSelectable } from "@/lib/quote-policy";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { Crumb } from "@/components/app/ui";
import { SelectCroForm } from "@/components/SelectCroForm";
import { md, won } from "@/lib/format";
import { selectionCaution } from "@/lib/reply-window";
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
  // 기한 전이거나 아직 회신하지 않은 기관이 있으면 선정 전에 한 번 더 확인한다. 선정하면 남은 회신 링크가 닫힌다
  const caution = selectionCaution(rfq, d.invites);

  return (
    <>
      <Crumb href={`/app/r/${rfq.rfq_no}/q/${q.id}`} label="견적서" />
      <div className="ph">
        <div>
          <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>{rfq.rfq_no}</span>
          <h1>{q.cro_name}과 진행할까요?</h1>
          <p>선택하면 CRO에 회사명과 담당자 연락처가 공개되고 계약은 직접 진행합니다. 단추는 조건에 관여하지 않습니다.</p>
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
        caution={caution.needed ? { early: caution.early, pending: caution.pending, replyBy: caution.replyBy ? md(caution.replyBy) : null } : null}
      />
    </>
  );
}
