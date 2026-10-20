import Link from "next/link";
import type { Loaded } from "@/lib/quote-load";
import { Lock, StatusPill } from "@/components/app/ui";
import { won } from "@/lib/format";
import { seatsLabel } from "@/lib/request-policy";
import { JoinPanel } from "./JoinPanel";

/**
 * CRO가 보는 요청서. 토큰 링크(/q)와 CRO 포털(/cro/r) 양쪽에서 쓴다.
 * 참여 전(got.joined false, 0023): 요약(설계 규칙표 "참여 전에 보이는 것")과 참여 결정(JoinPanel)만 보인다.
 * 참여 뒤: 의뢰 개요 · 요청 시험 항목(회신 표의 행) · 공통 조건 · 첨부와 회신 작성, 제출 전 참여 철회.
 */
export function RequestView({ got, replyHref, withdrawHref, fileToken, afterDeclineHref, declineEndpoint }: { got: Loaded; replyHref: string; withdrawHref?: string; fileToken?: string; afterDeclineHref: string; declineEndpoint?: string }) {
  const { rfq, draft } = got;
  const submitted = draft?.status === "submitted";
  const total = draft?.items.reduce((a, it) => a + (it.avail !== "불가" && it.amount ? Number(it.amount) : 0), 0) ?? 0;
  const summary = !rfq.full;
  const state = got.closed
    ? { tone: "sf" as const, label: "회신 마감" }
    : got.withdrawn
      ? { tone: "sf" as const, label: "철회" }
      : got.declined
        ? { tone: "sf" as const, label: "불참" }
        : submitted
          ? { tone: "ok" as const, label: "제출 완료" }
          : got.expired
            ? { tone: "err" as const, label: "만료" }
            : summary
              ? { tone: "sf" as const, label: "참여 결정 전" }
              : { tone: rfq.urgent ? ("err" as const) : ("sf" as const), label: rfq.ddayLabel };
  // 참여 결정을 받을 수 있는 상태: 참여 전이고 닫히지 않음
  const deciding = summary && !got.closed && !got.declined && !got.expired;
  const title = summary ? `${rfq.categories.join(" · ") || "비임상 시험"} 견적 요청` : rfq.substance;

  return (
    <>
      <div className="ph">
        <div>
          <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", letterSpacing: ".04em" }}>{rfq.no}</span>
          <h1>{title}</h1>
          <p>
            {rfq.client}
            {summary ? " · 시험물질명과 상세 내용은 참여 뒤에 열립니다" : rfq.masked && " · 첨부는 CDA 체결 확인 후"}
          </p>
          <div style={{ marginTop: 10 }}>
            <StatusPill tone={state.tone}>{state.label}</StatusPill>
          </div>
        </div>
        <div className="ph__actions">
          {!summary && !got.closed && !got.declined && !got.expired && (
            <Link href={replyHref} className="b1">{submitted ? (got.locked ? "제출한 회신 보기" : "제출한 회신 수정") : draft ? "이어서 작성" : "견적 회신 작성"}</Link>
          )}
        </div>
      </div>

      {deciding && <JoinPanel token={got.token} seats={seatsLabel(got.seats)} afterDeclineHref={afterDeclineHref} operator={got.operator} declineEndpoint={declineEndpoint} />}
      {summary && got.declined && !got.closed && <div className="note note--tint" style={{ marginBottom: 16 }}>이 요청에는 불참으로 처리했습니다. 다시 참여하려면 단추(hello@danchu.kr)에 문의해 주세요.</div>}
      {got.withdrawn && !got.closed && <div className="note note--tint" style={{ marginBottom: 16 }}>이 요청의 참여를 철회했습니다. 청구하지 않으며, 작성 중이던 내용은 의뢰자에게 보이지 않습니다.</div>}

      {!summary && rfq.identityMasked && !rfq.masked && (
        <div className="note note--tint" style={{ marginBottom: 16 }}>
          <Lock />
          <span>의뢰자 회사명과 담당자 연락처는 의뢰자가 비교표에서 이 기관을 선정하면 공개됩니다. 요청 내용에 대한 질문은 회신의 문의 항목으로 남겨 주세요. 요청서 내용은 이 요청의 견적 산출과 회신에만 써 주시고, 다른 목적으로 쓰거나 다른 곳에 공개하지 말아 주십시오.</span>
        </div>
      )}
      {!summary && rfq.masked && (
        <div className="note note--tint" style={{ marginBottom: 16 }}>
          <Lock />
          <span>
            기밀 등급 <b style={{ fontWeight: 600 }}>CDA 필요</b>. 요청에 맞는 CDA를 양측이 체결하고 운영자가 확인한 뒤 첨부 자료가 열립니다. 단추 화면의 회사명과 연락처는 선정 시 공개되며, CDA 문서에 당사자로 적힌 정보는 체결 과정에서 알게 될 수 있습니다. 요청서 내용은 이 요청의 견적 산출과 회신에만 써 주시고, 다른 목적으로 쓰거나 다른 곳에 공개하지 말아 주십시오.{" "}
            <a href={`mailto:hello@danchu.kr?subject=${encodeURIComponent(`[${rfq.no}] CDA 서명 요청`)}`}>CDA 서명 요청 →</a>
          </span>
        </div>
      )}
      {got.closed && <div className="note note--warn" style={{ marginBottom: 16 }}>의뢰자가 기관을 선정했거나 회신이 마감되어 이 요청의 회신이 닫혔습니다.</div>}

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="card" style={{ padding: "6px 18px" }}>
            <div style={{ padding: "12px 0 6px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{summary ? "참여 전 요약" : "의뢰 개요"}</div>
            {rfq.overview.map(([k, v]) => (
              <div key={k} className="kv" style={{ borderTop: "1px solid var(--track)" }}>
                <span className="kv__k">{k}</span>
                <span className="kv__v">{v}</span>
              </div>
            ))}
          </div>

          {(rfq.situation.length > 0 || rfq.ask.length > 0) && (
            <div className="card" style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              {rfq.situation.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>의뢰자 상황</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: "flex", flexDirection: "column", gap: 3 }}>
                    {rfq.situation.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              )}
              {rfq.ask.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", marginBottom: 6 }}>회신에서 설명해 주세요</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: "flex", flexDirection: "column", gap: 3 }}>
                    {rfq.ask.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!summary && (
          <div className="card" style={{ padding: "6px 18px" }}>
            <div style={{ padding: "12px 0 6px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>공통 조건</div>
            {rfq.common.length === 0 && <p style={{ padding: "6px 0 12px", fontSize: 14, color: "var(--muted)" }}>의뢰자가 상세 조건을 입력하지 않았습니다. 기관의 설계로 견적하고 회신에 설명해 주세요.</p>}
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
          )}
        </div>

        <div className="stack">
          <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>요청 시험 항목 {rfq.rows.length}</h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{summary ? "종 · 회복 기간 · GLP 여부" : "회신 표의 행이 됩니다"}</span>
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

          {!summary && !submitted && !got.closed && !got.declined && !got.expired && withdrawHref && (
            <div style={{ textAlign: "center" }}>
              <Link href={withdrawHref} className="btxt">참여 철회</Link>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>제출 전에는 언제든 철회할 수 있고, 철회하면 청구하지 않습니다.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
