import Link from "next/link";
import { CheckDisc } from "@/components/app/ui";
import { won } from "@/lib/format";
import "./layout-quote.css";

/** 제출 완료 화면. closed 면(마지막 제출로 비교표가 열렸거나 회신이 닫혔다) 수정하기를 숨기고 수정할 수 없다고 안내한다 */
export function ReplyDone({ no, replyBy, total, weeks, editHref, backHref, backLabel, closed = false }: { no: string; replyBy?: string; total: number; weeks?: string; editHref: string; backHref: string; backLabel: string; closed?: boolean }) {
  const hasWeeks = !!weeks && weeks !== "0";
  return (
    <div className="lq-done">
      <div className="lq-done__hero">
        <CheckDisc size={52} />
        <h1>견적을 제출했어요</h1>
        <p className="tnum">{no}</p>
      </div>
      {(total > 0 || hasWeeks || replyBy) && (
        <dl className="lq-done__kv">
          {total > 0 && <div><dt>총액</dt><dd className="tnum">{won(total)}</dd></div>}
          {hasWeeks && <div><dt>최종보고서</dt><dd className="tnum">{weeks}주차</dd></div>}
          {replyBy && <div><dt>회신 기한</dt><dd className="tnum">{replyBy}</dd></div>}
        </dl>
      )}
      <p className="lq-done__note">
        {closed ? "회신이 닫혀 더 고칠 수 없어요." : "비교표가 열리기 전까지 고칠 수 있어요. 열린 뒤에는 고치거나 다시 제출할 수 없어요."} 다른 기관은 볼 수 없어요.
      </p>
      <div className="lq-done__acts">
        {!closed && <Link href={editHref} className="b2">수정하기</Link>}
        <Link href={backHref} className="b1">{backLabel}</Link>
      </div>
      <p className="lq-done__foot">문의 support@danchu.kr</p>
    </div>
  );
}
