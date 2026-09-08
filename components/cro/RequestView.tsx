import Link from "next/link";
import type { Loaded } from "@/lib/quote-load";
import { Lock, StatusPill } from "@/components/app/ui";
import { won } from "@/lib/format";

/**
 * CRO가 보는 요청서 — 의뢰 개요 · 요청 시험 항목(회신 표의 행) · 공통 조건 · 첨부.
 * 토큰 링크(/q)와 CRO 포털(/cro/r) 양쪽에서 쓴다.
 */
export function RequestView({ got, replyHref, declineHref, fileToken }: { got: Loaded; replyHref: string; declineHref?: string; fileToken?: string }) {
  const { rfq, draft } = got;
  const submitted = draft?.status === "submitted";
  const total = draft?.items.reduce((a, it) => a + (it.avail !== "불가" && it.amount ? Number(it.amount) : 0), 0) ?? 0;
  const state = got.closed
    ? { tone: "sf" as const, label: "회신 마감" }
    : got.declined
      ? { tone: "sf" as const, label: "회신 안 함" }
      : submitted
        ? { tone: "ok" as const, label: "제출 완료" }
        : got.expired
          ? { tone: "err" as const, label: "만료" }
          : { tone: rfq.urgent ? ("err" as const) : ("sf" as const), label: rfq.ddayLabel };

  return (
    <>
      <div className="ph">
        <div>
          <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", letterSpacing: ".04em" }}>{rfq.no}</span>
          <h1>{rfq.substance}</h1>
          <p>
            {rfq.client}
            {rfq.masked && " · CDA 체결 전 마스킹"}
          </p>
          <div style={{ marginTop: 10 }}>
            <StatusPill tone={state.tone}>{state.label}</StatusPill>
          </div>
        </div>
        <div className="ph__actions">
          {!got.closed && !got.declined && !got.expired && (
            <Link href={replyHref} className="b1">{submitted ? (got.locked ? "제출한 회신 보기" : "제출한 회신 수정") : draft ? "이어서 작성" : "견적 회신 작성"}</Link>
          )}
        </div>
      </div>

      {rfq.masked && (
        <div className="note note--tint" style={{ marginBottom: 16 }}>
          <Lock />
          <span>
            기밀 등급 <b style={{ fontWeight: 600 }}>CDA 필요</b>. 단추 표준 CDA에 서명하면 회사명과 첨부 자료가 열립니다.{" "}
            <a href={`mailto:hello@danchu.kr?subject=${encodeURIComponent(`[${rfq.no}] CDA 서명 요청`)}`}>CDA 서명 요청 →</a>
          </span>
        </div>
      )}
      {got.closed && <div className="note note--warn" style={{ marginBottom: 16 }}>의뢰자가 CRO 선택을 마쳐 이 요청의 회신이 닫혔습니다.</div>}

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="card" style={{ padding: "6px 18px" }}>
            <div style={{ padding: "12px 0 6px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>의뢰 개요</div>
            {rfq.overview.map(([k, v]) => (
              <div key={k} className="kv" style={{ borderTop: "1px solid var(--track)" }}>
                <span className="kv__k">{k}</span>
                <span className="kv__v">{v}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: "6px 18px" }}>
            <div style={{ padding: "12px 0 6px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>공통 조건</div>
            {rfq.common.length === 0 && <p style={{ padding: "6px 0 12px", fontSize: 14, color: "var(--muted)" }}>의뢰자가 상세 조건을 입력하지 않았습니다. 표준 설계로 견적해 주세요.</p>}
            {rfq.common.map(([k, v]) => (
              <div key={k} className="kv" style={{ borderTop: "1px solid var(--track)" }}>
                <span className="kv__k">{k}</span>
                <span className="kv__v" style={{ whiteSpace: "pre-wrap" }}>{v}</span>
              </div>
            ))}
            <div className="kv" style={{ borderTop: "1px solid var(--track)", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <span className="kv__k">첨부 · {rfq.attachments}</span>
              {rfq.files.map((f) => (
                <a key={f.id} href={`/api/files/${f.id}${fileToken ? `?token=${fileToken}` : ""}`} style={{ fontSize: 14 }}>
                  {f.name} <span style={{ color: "var(--muted)" }}>· {(f.size / 1024 / 1024).toFixed(1)}MB</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>요청 시험 항목 {rfq.rows.length}</h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>회신 표의 행이 됩니다</span>
            </div>
            {rfq.rows.map((r) => {
              const it = draft?.items.find((x) => x.seq === r.seq);
              return (
                <div key={r.seq} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", background: "var(--sf)", borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</span>
                    <span style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600, whiteSpace: "nowrap" }}>{r.category}</span>
                  </div>
                  {r.cond && <span style={{ fontSize: 13, color: "var(--body)", lineHeight: 1.5 }}>{r.cond}</span>}
                  {it?.avail && (
                    <span className="tnum" style={{ fontSize: 13, color: "var(--muted)" }}>
                      내 회신 · {it.avail}{it.amount ? ` · ${Number(it.amount).toLocaleString("ko-KR")}원` : ""}{it.weeks ? ` · ${it.weeks}주` : ""}
                    </span>
                  )}
                </div>
              );
            })}
            {submitted && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "1px solid var(--track)", fontSize: 14 }}>
                <span style={{ color: "var(--muted)" }}>제출 총액 · VAT 별도</span>
                <span className="tnum" style={{ fontWeight: 700 }}>{won(total)}</span>
              </div>
            )}
          </div>

          {!submitted && !got.closed && !got.declined && !got.expired && declineHref && (
            <div style={{ textAlign: "center" }}>
              <Link href={declineHref} className="btxt">이번 요청은 회신하지 않음</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
