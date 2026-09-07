import Link from "next/link";
import { CheckDisc } from "@/components/app/ui";
import { won, md } from "@/lib/app-data";
import { loadQuote } from "@/lib/quote-load";

/** 제출 완료 — 실제 CRO가 보는 화면이므로 데모 마감 목록은 넣지 않는다 */
export default async function ReplyDone({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ t?: string; w?: string }> }) {
  const { token } = await params;
  const { t, w } = await searchParams;
  const got = await loadQuote(token);
  const no = got?.rfq.no ?? "";
  const replyBy = got?.rfq.replyBy;
  const total = Number(t || 0);

  return (
    <div className="scr scr--sf">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "calc(var(--top) + 40px) 20px 40px" }}>
        <div className="card" style={{ padding: "32px 24px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
          <CheckDisc size={52} />
          <h1 style={{ marginTop: 6, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>견적을 제출했습니다</h1>
          <p className="tnum" style={{ fontSize: 14, color: "var(--body)" }}>
            {no}{total ? ` · 총 ${won(total)}` : ""}{w ? ` · ${w}주` : ""}
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            {replyBy ? `회신 기한(${md(replyBy)})까지는 수정할 수 있습니다. ` : ""}비교표는 의뢰자에게만 전달되며 타사 견적은 열람할 수 없습니다.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <Link href={`/app/cro/r/${token}/reply`} className="b2" style={{ height: 40, padding: "0 16px", borderRadius: 10, fontSize: 14, width: "auto" }}>수정하기</Link>
            <Link href={`/app/cro/r/${token}`} className="b2" style={{ height: 40, padding: "0 16px", borderRadius: 10, fontSize: 14, width: "auto" }}>요청서 보기</Link>
          </div>
        </div>
        <p style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>문의 hello@danchu.kr</p>
      </div>
    </div>
  );
}
