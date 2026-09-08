import Link from "next/link";
import { CheckDisc } from "@/components/app/ui";
import { won, md } from "@/lib/format";

export function ReplyDone({ no, replyBy, total, weeks, editHref, backHref, backLabel }: { no: string; replyBy?: string; total: number; weeks?: string; editHref: string; backHref: string; backLabel: string }) {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: 16 }}>
      <div className="card" style={{ padding: "32px 24px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
        <CheckDisc size={52} />
        <h1 style={{ marginTop: 6, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>견적을 제출했습니다</h1>
        <p className="tnum" style={{ fontSize: 14, color: "var(--body)" }}>
          {no}{total ? ` · 총 ${won(total)}` : ""}{weeks ? ` · ${weeks}주` : ""}
        </p>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          {replyBy ? `회신 기한(${md(replyBy)})까지는 수정할 수 있습니다. ` : ""}비교표는 의뢰자에게만 전달되며 타사 견적은 열람할 수 없습니다.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href={editHref} className="b2 bsm">수정하기</Link>
          <Link href={backHref} className="b2 bsm">{backLabel}</Link>
        </div>
      </div>
      <p style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>문의 hello@danchu.kr</p>
    </div>
  );
}
