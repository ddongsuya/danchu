import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { Crumb } from "@/components/app/ui";
import { SelectCroForm } from "@/components/SelectCroForm";
import { md, won } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SelectCro({ params }: { params: Promise<{ no: string; quoteId: string }> }) {
  const s = await requireSession("requester");
  const { no, quoteId } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin")) notFound();
  const d = await getRfqDetail(rfq);
  const q = d.quotes.find((x) => x.id === quoteId && x.status === "submitted");
  if (!q || !rfq.compared_at) notFound();
  if (rfq.selected_quote_id) {
    return (
      <>
        <Crumb href={`/app/r/${rfq.rfq_no}`} label={rfq.rfq_no} />
        <div className="note note--ok">이미 CRO를 선택한 요청입니다. 진행 상태는 요청 상세에서 확인하세요.</div>
      </>
    );
  }
  const others = d.quotes.filter((x) => x.status === "submitted" && x.id !== q.id);
  const min = Math.min(...d.quotes.filter((x) => x.status === "submitted").map((x) => x.total_amount ?? 0).filter((t) => t > 0));

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
        croName={q.cro_name}
        summary={[
          ["총 견적액", won(q.total_amount ?? 0)],
          ["최저가 대비", (q.total_amount ?? 0) === min ? "최저가" : `+${won((q.total_amount ?? 0) - min)}`],
          ["착수 · 기간", `${md(q.start_date)} · ${q.total_weeks ? `${q.total_weeks}주` : "—"}`],
          ["유효기간", md(q.valid_until)],
        ]}
        others={others.map((o) => ({ name: o.cro_name, total: won(o.total_amount ?? 0) }))}
        contact={`${rfq.company} · ${rfq.contact_name} · ${rfq.email}${rfq.phone ? ` · ${rfq.phone}` : ""}`}
      />
    </>
  );
}
