import Link from "next/link";
import { qnaWindow } from "@/lib/qna";
import { maskedText } from "@/lib/contact-guard";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { glpCoverage } from "@/lib/quote-items";
import { designOfStored, explainOf } from "@/lib/catalog";
import { Crumb } from "@/components/app/ui";
import { CompareBoard, type CompareCol } from "@/components/CompareBoard";
import { SelectedBanner } from "@/components/app/SelectedBanner";
import { ComparePending } from "@/components/app/ComparePending";
import { funnel } from "@/lib/request-story";
import { quoteSelectable } from "@/lib/quote-policy";
import { submittedDoc } from "@/lib/quote-doc-db";
import { contractReportDue } from "@/lib/contract-reminder";
import { eulReul } from "@/lib/josa";
import { dday } from "@/lib/format";
import { CompareReport } from "@/components/app/CompareReport";
import { md } from "@/lib/format";
import { comparisonOpened, pendingInvites, repliesClosed } from "@/lib/reply-window";
import { captureError } from "@/lib/observe";
import { hasSchedule } from "@/lib/quote-schedule";
import { loadDetail } from "@/lib/detail-data";
import { arrivalOrder, inclOf } from "@/lib/compare-view";

export const dynamic = "force-dynamic";

export default async function Compare({ params }: { params: Promise<{ no: string }> }) {
  const s = await requireSession("requester");
  const { no } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) notFound();
  const d = await getRfqDetail(rfq);
  // 비교표 공개 전 (2026-10-20 결정 1): 의뢰자에게는 진행 숫자만 보인다. 기관명·금액·견적은 열릴 때 함께 공개한다
  const open = !repliesClosed(rfq);
  // 참여한 기관 중 아직 제출하지 않은 곳만 센다 (0023). 참여 결정 전 안내는 의뢰자에게 보이지 않는다
  const pending = pendingInvites(d.invites);
  if (!comparisonOpened(rfq) && s.profile.role !== "admin") {
    const f = funnel(d.invites);
    return (
      <>
        <Crumb href={`/app/r/${rfq.rfq_no}`} label={rfq.rfq_no} />
        <ComparePending replyBy={rfq.reply_by} f={f} ended={["closed", "cancelled"].includes(rfq.status)} />
      </>
    );
  }

  // 의뢰자 본인이 열린 비교표를 연 기록 (0028). 운영자가 연 것은 세지 않는다. 기록이 실패해도 화면은 그대로 보여 준다
  if (s.profile.role !== "admin") {
    const rfqId = rfq.id;
    after(async () => {
      const { error } = await getSupabaseAdmin()!.rpc("record_compare_view", { p_rfq: rfqId });
      if (error) captureError(error, "compare.record_view", { rfq: rfq.rfq_no });
    });
  }

  // 회신 도착 순(처음 제출한 때), 같으면 기관명 순. 단추는 기관 순서를 매기지 않으므로 금액·기간 순은 사용자가 고를 때만
  const quotes = arrivalOrder(d.quotes);
  const orgIds = quotes.map((q) => q.cro_org_id).filter((x): x is string => !!x);
  const sb = getSupabaseAdmin()!;
  const { data: orgs } = orgIds.length ? await sb.from("cro_orgs").select("id, glp_certs, aaalac").in("id", orgIds) : { data: [] };
  const certsOf = new Map((orgs ?? []).map((o) => [o.id as string, (o.glp_certs ?? []) as string[]]));
  const authorities = Array.isArray(rfq.payload.authority) ? (rfq.payload.authority as string[]) : [];
  // 행은 첫 견적이 아니라 모든 견적의 항목 합집합 (어느 기관이 항목을 빠뜨려도 행이 사라지지 않게)
  const rowMap = new Map<number, { seq: number; name: string; category: string }>();
  for (const q of quotes) for (const it of q.cro_quote_items ?? []) if (!rowMap.has(it.seq)) rowMap.set(it.seq, { seq: it.seq, name: it.name, category: it.category });
  const rows = [...rowMap.values()].sort((a, b) => a.seq - b.seq);

  // 2차 상세 견적 (0042): 요청한 기관의 열에 1차와 나란히 보인다
  const detail = await loadDetail(rfq.id);
  // 기관 견적서 툴로 만든 견적서가 제출한 견적과 같은지 (패널의 "기관 견적서" 링크)
  const docs = await Promise.all(quotes.map((q) => submittedDoc(q).then((x) => !!x, () => false)));
  const cols: CompareCol[] = quotes.map((q, qi) => {
    const dt = detail?.targets.find((t) => t.quoteId === q.id);
    const cov = glpCoverage(authorities, certsOf.get(q.cro_org_id ?? "") ?? []);
    const items = q.cro_quote_items ?? [];
    const unavailable = items.filter((i) => i.avail === "불가").map((i) => i.name);
    return {
      id: q.id,
      name: q.cro_name,
      total: q.total_amount ?? 0,
      weeks: q.total_weeks ?? 0,
      final: hasSchedule(q) ? q.final_weeks : null,
      finalReport: hasSchedule(q) ? (q.final_report_weeks ?? q.final_weeks) : null,
      start: q.start_date,
      valid: q.valid_until,
      pay: q.pay_terms,
      includes: q.includes ?? [],
      // 선정 전 자유 입력란의 연락처는 가린다 (lib/contact-guard.ts). 선정한 기관 것만 그대로
      note: rfq.selected_quote_id === q.id ? q.note : maskedText(q.note),
      glpOk: cov.ok,
      glpMissing: cov.missing,
      glp: certsOf.get(q.cro_org_id ?? "") ?? [],
      unavailable,
      conditional: items.filter((i) => i.avail === "조건부 가능").length,
      items: items.map((i) => ({ seq: i.seq, avail: i.avail ?? "", amount: i.amount, weeks: i.weeks, design: designOfStored(i.design), note: (() => { const t = [i.reason, i.design && typeof i.design.note === "string" ? i.design.note : ""].filter(Boolean).join(" · "); return (rfq.selected_quote_id === q.id ? t : maskedText(t)) || undefined; })(), explain: explainOf(rows.find((r) => r.seq === i.seq)?.category ?? "", i.design?.extra), includes: inclOf(i.design) })),
      hasPdf: !!q.pdf_path,
      hasDoc: docs[qi],
      arrivedAt: q.first_submitted_at ?? q.submitted_at,
      revision: q.revision,
      blocked: quoteSelectable(q) ? null : q.valid_until && dday(q.valid_until).n < 0 ? "견적 유효기간이 지나 바로 선정할 수 없어요." : "정식 견적서와 착수일이 확인되면 선정할 수 있어요.",
      askHref: qnaWindow(rfq).sponsorAsk ? `/app/r/${rfq.rfq_no}/qna?to=${q.invite_id}` : null,
      selected: rfq.selected_quote_id === q.id,
      auto: !!q.auto,
      operator: q.entry_source === "operator",
      detail: dt ? { at: dt.respondedAt, status: dt.status, total: dt.total, weeks: dt.weeks, note: (rfq.selected_quote_id === q.id ? dt.note : maskedText(dt.note)) || null, items: dt.items.map((i) => ({ ...i, reason: rfq.selected_quote_id === q.id ? i.reason : maskedText(i.reason) })) } : null,
    };
  });

  const canSelect = comparisonOpened(rfq) && !rfq.selected_quote_id && !["closed", "cancelled"].includes(rfq.status);
  const board = (
    <>
      {!comparisonOpened(rfq) && (
        <p className="note note--warn" style={{ marginBottom: 16 }}>운영자 보기예요. 비교표가 열리기 전이라 의뢰자에게는 이 표가 보이지 않고, 기관은 아직 견적을 고칠 수 있어요.{open ? ` 참여했지만 아직 내지 않은 기관 ${pending}곳.` : ""}</p>
      )}
      {detail && <p className="cmp-msg tnum">2차 회신 기한 {md(detail.replyBy)} · 답한 곳 {detail.targets.filter((t) => t.status !== "sent").length}/{detail.targets.length}</p>}
      <CompareBoard no={rfq.rfq_no} cols={cols} rows={rows} canSelect={canSelect} />
    </>
  );
  // 선정 결과 배너: 선정한 뒤 계약 보고 전까지 (선정 취소는 정하지 않은 정책이라 없다)
  const award = rfq.status === "selected" ? d.award : null;
  const banner = award ? <SelectedBanner no={rfq.rfq_no} text={`${md(award.awarded_at)} ${eulReul(award.cro_name)} 선정했어요 · 계약 결과 보고 기한 ${md(contractReportDue(award.awarded_at))}`} /> : null;

  return (
    <>
      <Crumb href={`/app/r/${rfq.rfq_no}`} label={rfq.rfq_no} />
      {cols.length === 0 ? (
        <>
          <div className="ph">
            <div>
              <h1>비교 보고서</h1>
              <p>{rfq.substance}</p>
            </div>
          </div>
          <div className="empty">
            <b>도착한 견적이 없어요</b>
            기한을 늘리거나 다른 기관에 안내하는 일은 운영자가 도와요.
            <div style={{ marginTop: 14 }}><Link href={`/app/support?rfq=${rfq.rfq_no}`} className="b2 bsm">이 요청 문의하기</Link></div>
          </div>
        </>
      ) : (
        <CompareReport
          comparedAt={rfq.compared_at}
          cols={cols}
          rows={rows}
          board={board}
          banner={banner}
          detailHref={!detail && canSelect && cols.length > 0 ? `/app/r/${rfq.rfq_no}/detail` : null}
        />
      )}
    </>
  );
}
