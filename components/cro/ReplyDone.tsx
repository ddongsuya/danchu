import Link from "next/link";
import { CheckDisc } from "@/components/app/ui";
import { md, mdhm, nextDay } from "@/lib/format";
import "./layout-quote.css";

/**
 * 회신 제출 완료 (시안 검토판 c-reply-done · q-done). 제출한 내용 요약과 다음 일정(회신 기한 · 비교표 공개).
 * 비교표는 회신 기한 다음 날 오전 9시에 열리고, 참여한 곳이 모두 내면 더 빨리 열린다.
 * closed 면(마지막 제출로 비교표가 열렸거나 회신이 닫혔다) 고치기를 숨긴다.
 */
export function ReplyDone({ no, title, replyBy, total, weeks, files, submittedAt, editHref, backHref, backLabel, closed = false }: { no: string; title?: string; replyBy?: string; total: number; weeks?: string; files?: number; submittedAt?: string; editHref: string; backHref?: string; backLabel?: string; closed?: boolean }) {
  const hasWeeks = !!weeks && weeks !== "0";
  return (
    <div className="lq-done">
      <div className="lq-done__hero">
        <CheckDisc size={52} />
        <h1>회신을 제출했어요</h1>
        <p className="tnum">{[no, title].filter(Boolean).join(" · ")}</p>
      </div>
      <dl className="lq-done__kv">
        {total > 0 && <div><dt>총액</dt><dd className="tnum">{total.toLocaleString("ko-KR")}</dd></div>}
        {hasWeeks && <div><dt>기간</dt><dd className="tnum">{weeks}주</dd></div>}
        {files != null && <div><dt>견적서 PDF</dt><dd className="tnum">{files ? `${files}개` : "없음"}</dd></div>}
        {submittedAt && <div><dt>제출</dt><dd className="tnum">{mdhm(submittedAt)}</dd></div>}
      </dl>
      {replyBy && !closed && (
        <section className="lq-done__next" aria-labelledby="lq-next-title">
          <h2 id="lq-next-title">다음 일정</h2>
          <ol>
            <li><b className="tnum">{md(replyBy)}</b><span>회신 기한 · 비교표가 열리기 전까지 고칠 수 있음</span></li>
            <li><b className="tnum">{md(nextDay(replyBy))} 오전 9시</b><span>비교표 공개 · 참여한 곳이 모두 내면 더 빨리</span></li>
          </ol>
        </section>
      )}
      {closed && <p className="lq-done__note">회신이 닫혀 더 고칠 수 없어요.</p>}
      <div className="lq-done__acts">
        {!closed && <Link href={editHref} className={backHref ? "b2" : "b1"}>회신 고치기</Link>}
        {backHref && backLabel && <Link href={backHref} className="b1">{backLabel}</Link>}
      </div>
    </div>
  );
}
