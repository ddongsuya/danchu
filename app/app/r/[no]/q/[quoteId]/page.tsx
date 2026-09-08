import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { glpCoverage } from "@/lib/quote-items";
import { INCL_KEYS } from "@/lib/cro-data";
import { Crumb } from "@/components/app/ui";
import { comma, md, won, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function QuoteDetail({ params }: { params: Promise<{ no: string; quoteId: string }> }) {
  const s = await requireSession("requester");
  const { no, quoteId } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin")) notFound();
  if (!rfq.compared_at && s.profile.role !== "admin") notFound();
  const d = await getRfqDetail(rfq);
  const q = d.quotes.find((x) => x.id === quoteId && x.status === "submitted");
  if (!q) notFound();
  const items = q.cro_quote_items ?? [];
  const sb = getSupabaseAdmin()!;
  const { data: org } = q.cro_org_id ? await sb.from("cro_orgs").select("glp_certs, aaalac, website, intro").eq("id", q.cro_org_id).maybeSingle() : { data: null };
  const certs = (org?.glp_certs ?? []) as string[];
  const cov = glpCoverage(Array.isArray(rfq.payload.authority) ? (rfq.payload.authority as string[]) : [], certs);
  const min = Math.min(...d.quotes.filter((x) => x.status === "submitted").map((x) => x.total_amount ?? 0).filter((t) => t > 0));
  const diff = (q.total_amount ?? 0) - min;
  const selectable = !rfq.selected_quote_id && !!rfq.compared_at;

  return (
    <>
      <Crumb href={`/app/r/${rfq.rfq_no}/compare`} label="비교표" />
      <div className="ph">
        <div>
          <span className="tnum" style={{ fontSize: 13, color: "var(--muted)" }}>{rfq.rfq_no} · 제출 {ymd(q.submitted_at)}</span>
          <h1>{q.cro_name}</h1>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)", letterSpacing: ".04em" }}>총 견적액 · VAT 별도</div>
              <div className="tnum" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 }}>{won(q.total_amount ?? 0)}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: diff === 0 ? "var(--ok)" : "var(--muted)" }}>{diff === 0 ? "최저가" : `최저가 대비 +${won(diff)}`}</span>
          </div>
        </div>
        <div className="ph__actions">
          {q.pdf_path && <a href={`/api/quotes/${q.id}/pdf`} className="b2">정본 PDF</a>}
          {selectable && <Link href={`/app/r/${rfq.rfq_no}/q/${q.id}/select`} className="b1">이 CRO 선택</Link>}
          {rfq.selected_quote_id === q.id && <span className="pill pill--ok">선택한 CRO</span>}
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="card" style={{ padding: "18px 18px 6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>항목별 금액</h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>단위 원 · VAT 별도</span>
            </div>
            {items.map((it) => (
              <div key={it.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 0", borderTop: "1px solid var(--track)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{it.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{it.cond || it.category}</div>
                  </div>
                  <span className="tnum" style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", color: it.avail === "불가" ? "var(--ph)" : undefined }}>
                    {it.avail === "불가" ? "불가" : it.amount != null ? comma(it.amount) : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className={`pill ${it.avail === "가능" ? "pill--ok" : it.avail === "조건부 가능" ? "pill--warn" : "pill--sf"}`}>{it.avail || "—"}</span>
                  {it.weeks ? <span className="pill pill--sf">{it.weeks}주</span> : null}
                  {it.reason && <span style={{ fontSize: 13, color: "var(--body)" }}>{it.reason}</span>}
                </div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderTop: "1.5px solid var(--ink)", fontSize: 15 }}>
              <span style={{ fontWeight: 600 }}>합계</span>
              <span className="tnum" style={{ fontWeight: 700 }}>{comma(q.total_amount ?? 0)}</span>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>포함 · 제외</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {INCL_KEYS.map((k) => {
                const yes = (q.includes ?? []).includes(k);
                return (
                  <span key={k} className="chip chip--sm" style={{ borderColor: yes ? "var(--bline)" : "var(--iline)", background: yes ? "var(--tint)" : "var(--wh)", color: yes ? "var(--brand)" : "var(--ph)", textDecoration: yes ? "none" : "line-through" }}>
                    {k}
                  </span>
                );
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", background: "var(--sf)", borderRadius: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>제외 항목 · 별도 옵션 · 전달 사항</span>
              <span style={{ fontSize: 14, color: "var(--body)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{q.note || "없음"}</span>
            </div>
          </div>

          <div className="card card--rows">
            {[
              ["GLP 인증", certs.join(" · ") || "—"],
              ["제출처 대응", cov.ok ? "대응 가능 ✓" : `대응 불가 · ${cov.missing.join(", ")} 미보유`],
              ["AAALAC", org?.aaalac == null ? "—" : org.aaalac ? "인증" : "없음"],
              ["착수 가능일", md(q.start_date)],
              ["총 소요기간", q.total_weeks ? `${q.total_weeks}주 (병렬 수행 기준)` : "—"],
              ["결제 조건", q.pay_terms ? `${q.pay_terms} (%)` : "—"],
              ["견적 유효기간", md(q.valid_until)],
              ["보고서 언어", q.report_lang || "—"],
              ["시험물질 필요량", q.substance_qty || "—"],
            ].map(([k, v]) => (
              <div key={k} className="kv">
                <span className="kv__k">{k}</span>
                <span className="kv__v" style={{ color: k === "제출처 대응" ? (cov.ok ? "var(--ok)" : "var(--err)") : undefined }}>{v}</span>
              </div>
            ))}
          </div>

          {q.pdf_path && (
            <a href={`/api/quotes/${q.id}/pdf`} className="card card--link" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: 9, background: "var(--tint)", color: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>PDF</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.pdf_name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{q.pdf_size ? `${(q.pdf_size / 1024 / 1024).toFixed(1)}MB · ` : ""}계약의 정본</div>
              </div>
            </a>
          )}
        </div>
      </div>

      {selectable && (
        <div className="cta">
          <Link href={`/app/r/${rfq.rfq_no}/q/${q.id}/select`} className="b1 blg bfull">이 CRO 선택하기</Link>
        </div>
      )}
    </>
  );
}
