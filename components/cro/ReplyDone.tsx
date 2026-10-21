import Link from "next/link";
import { CheckDisc } from "@/components/app/ui";
import { won, md } from "@/lib/format";

/** 제출 완료 화면. closed 면(마지막 제출로 비교표가 열렸거나 회신이 닫혔다) 수정하기를 숨기고 수정할 수 없다고 안내한다 */
export function ReplyDone({ no, replyBy, total, weeks, editHref, backHref, backLabel, closed = false }: { no: string; replyBy?: string; total: number; weeks?: string; editHref: string; backHref: string; backLabel: string; closed?: boolean }) {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: 16 }}>
      <div className="card" style={{ padding: "32px 24px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
        <CheckDisc size={52} />
        <h1 style={{ marginTop: 6, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>견적을 제출했습니다</h1>
        <p className="tnum" style={{ fontSize: 14, color: "var(--body)" }}>
          {no}{total ? ` · 총 ${won(total)}` : ""}{weeks ? ` · ${weeks}주` : ""}
        </p>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          {closed ? "이 요청은 회신이 닫혀 제출한 견적을 수정하거나 다시 제출할 수 없습니다. 비교표가 열렸으면 의뢰자에게 견적이 보입니다. " : <>제출한 견적은 비교표가 열릴 때 의뢰자에게 보입니다. {replyBy ? `비교표가 열리기 전이면 회신 기한(${md(replyBy)})까지 수정할 수 있고, 열린 뒤에는 수정하거나 다시 제출할 수 없습니다. ` : "비교표가 열리기 전까지 수정할 수 있고, 열린 뒤에는 수정하거나 다시 제출할 수 없습니다. "}</>}다른 기관은 귀 기관의 견적을 볼 수 없습니다.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
          {!closed && <Link href={editHref} className="b2 bsm">수정하기</Link>}
          <Link href={backHref} className="b2 bsm">{backLabel}</Link>
        </div>
      </div>
      <p style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>문의 hello@danchu.kr</p>
    </div>
  );
}
