import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, SubHeader } from "@/components/app/ui";
import { loadQuote } from "@/lib/quote-load";

export default async function CroRequest({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const got = await loadQuote(token);
  if (!got) notFound();
  const { rfq, draft } = got;
  const submitted = draft?.status === "submitted";

  return (
    <div className="scr scr--sf">
      <SubHeader sheet back="/app/cro" backLabel="받은 요청" title={rfq.no}>
        <div style={{ padding: "8px 0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{rfq.substance}</span>
              <span style={{ fontSize: 14, color: "var(--muted)" }}>
                {rfq.client}{rfq.masked && " (CDA 체결 전 마스킹)"}
              </span>
            </div>
            <span className={`pill ${submitted ? "pill--ok" : rfq.urgent ? "pill--err" : "pill--sf"}`} style={{ marginTop: 4 }}>
              {submitted ? "제출 완료" : rfq.ddayLabel}
            </span>
          </div>
          {rfq.masked && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", background: "var(--tint)", border: "1px solid var(--bline)", borderRadius: 12, fontSize: 13, color: "var(--body)", lineHeight: 1.5 }}>
              <Lock />
              <span>
                기밀 등급 <b style={{ fontWeight: 600 }}>CDA 필요</b>. 단추 표준 CDA에 서명하면 회사명과 첨부 자료(COA)가 열립니다.{" "}
                <a href="mailto:hello@danchu.kr?subject=CDA 서명 요청">CDA 서명 →</a>
              </span>
            </div>
          )}
        </div>
      </SubHeader>

      <div className="pad" style={{ paddingTop: 16 }}>
        <div className="card" style={{ padding: "6px 18px" }}>
          <div style={{ padding: "12px 0 6px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>의뢰 개요</div>
          {rfq.overview.map(([k, v]) => (
            <div key={k} className="kv" style={{ padding: "10px 0", borderTop: "1px solid var(--track)", fontSize: 14 }}>
              <span className="kv__k" style={{ flex: "none" }}>{k}</span>
              <span className="kv__v">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pad" style={{ paddingTop: 12 }}>
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>요청 시험 항목</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>회신 표의 행이 됩니다</span>
          </div>
          {rfq.rows.map((r) => (
            <div key={r.seq} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", background: "var(--sf)", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</span>
                <span style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600, whiteSpace: "nowrap" }}>{r.category}</span>
              </div>
              {r.cond && <span style={{ fontSize: 13, color: "var(--body)", lineHeight: 1.5 }}>{r.cond}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="pad" style={{ padding: "12px 20px 24px" }}>
        <div className="card" style={{ padding: "6px 18px" }}>
          <div style={{ padding: "12px 0 6px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>공통 조건</div>
          {rfq.common.map(([k, v]) => (
            <div key={k} className="kv" style={{ padding: "10px 0", borderTop: "1px solid var(--track)", fontSize: 14 }}>
              <span className="kv__k" style={{ flex: "none" }}>{k}</span>
              <span className="kv__v">{v}</span>
            </div>
          ))}
          <div className="kv" style={{ padding: "12px 0", borderTop: "1px solid var(--track)", fontSize: 14 }}>
            <span className="kv__k">첨부</span>
            <span style={{ color: "var(--ph)", textAlign: "right" }}>{rfq.attachments}</span>
          </div>
        </div>
      </div>

      <div className="cta cta--sf">
        <Link href={`/app/cro/r/${token}/reply`} className="b1">
          {submitted ? "제출한 회신 수정" : draft ? "이어서 작성" : "견적 회신 작성"}
        </Link>
        {!submitted && (
          <Link href="/app/cro" className="btxt" style={{ textAlign: "center", fontWeight: 600 }}>이번 요청은 회신하지 않음</Link>
        )}
      </div>
    </div>
  );
}
