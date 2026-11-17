import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { Crumb } from "@/components/app/ui";
import { CompareBoard } from "@/components/CompareBoard";
import { CompareReport } from "@/components/app/CompareReport";
import { md } from "@/lib/format";
import { comparisonOpened, pendingInvites, repliesClosed } from "@/lib/reply-window";
import { occupiesSeat } from "@/lib/request-policy";
import { captureError } from "@/lib/observe";
import { loadCompare } from "@/lib/compare-data";

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
    const joined = d.invites.filter((i) => occupiesSeat(i)).length;
    const submittedCount = d.invites.filter((i) => occupiesSeat(i) && i.status === "submitted").length;
    const ended = ["closed", "cancelled"].includes(rfq.status);
    return (
      <>
        <Crumb href={`/app/r/${rfq.rfq_no}`} label={rfq.rfq_no} />
        <div className="ph">
          <div>
            <h1>비교 보고서</h1>
            <p>{rfq.substance}</p>
          </div>
        </div>
        <dl className="compare-status" aria-label="회신 현황">
          <div><dt>참여</dt><dd className="tnum">{joined}곳</dd></div>
          <div><dt>제출</dt><dd className="tnum">{submittedCount}곳</dd></div>
          <div><dt>회신 기한</dt><dd className="tnum">{rfq.reply_by ? md(rfq.reply_by) : "미정"}</dd></div>
        </dl>
        <div className="empty">
          <b>{ended ? "보고서가 열리기 전에 마무리한 요청이에요" : "비교 보고서가 아직 열리지 않았어요"}</b>
          {ended
            ? "보고서가 열리지 않아 기관 이름과 견적은 공개되지 않아요."
            : `비교 보고서는 ${rfq.reply_by ? `회신 기한(${md(rfq.reply_by)}) 다음 날 오전 9시에 열리고, ` : ""}참여 결정이 끝난 뒤 참여한 기관이 모두 내면 더 빨리 열려요. 열리면 기관 이름과 견적을 함께 보여 주고 알림을 보내요.`}
          <div style={{ marginTop: 14 }}>
            <Link href={`/app/r/${rfq.rfq_no}`} className="b2">요청으로 돌아가기</Link>
          </div>
        </div>
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

  const { cols, rows, authorities, detail } = await loadCompare(rfq, d);

  const canSelect = comparisonOpened(rfq) && !rfq.selected_quote_id && !["closed", "cancelled"].includes(rfq.status);
  const board = (
    <>
      {rfq.selected_quote_id ? null : comparisonOpened(rfq) ? (
        <p className="note" style={{ marginBottom: 16 }}>회신이 마감되어 견적은 더 바뀌지 않아요. 비교한 뒤 진행할 기관을 선택해 주세요.</p>
      ) : (
        <p className="note note--warn" style={{ marginBottom: 16 }}>운영자 보기예요. 비교표가 열리기 전이라 의뢰자에게는 이 표가 보이지 않고, 기관은 아직 견적을 고칠 수 있어요.{open ? ` 참여했지만 아직 내지 않은 기관 ${pending}곳.` : ""}</p>
      )}
      {detail ? (
        <div className="cmp-detail">
          <b>상세 견적</b>
          <span className="tnum">2차 회신 기한 {md(detail.replyBy)} · 답한 곳 {detail.targets.filter((t) => t.status !== "sent").length}/{detail.targets.length}</span>
        </div>
      ) : canSelect && cols.length > 0 ? (
        <div className="cmp-detail">
          <b>상세 견적</b>
          <span>1차 견적 기관 중 최대 3곳 · 요청마다 한 번</span>
          <Link href={`/app/r/${rfq.rfq_no}/detail`} className="b2">상세 조건 보내기</Link>
        </div>
      ) : null}
      <CompareBoard no={rfq.rfq_no} cols={cols} rows={rows} canSelect={canSelect} />
    </>
  );

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
          no={rfq.rfq_no}
          substance={rfq.substance}
          comparedAt={rfq.compared_at}
          cols={cols}
          rows={rows}
          vat={`금액은 VAT 별도예요${authorities.length ? `, 제출처 ${authorities.join(", ")}` : ""}.`}
          board={board}
          xlsxHref={`/api/rfq/${rfq.rfq_no}/compare/xlsx`}
        />
      )}
    </>
  );
}
