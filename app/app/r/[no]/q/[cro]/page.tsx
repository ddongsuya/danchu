import Link from "next/link";
import { SubHeader } from "@/components/app/ui";
import { INCL_KEYS, comma, croBySlug, md, won } from "@/lib/app-data";

export default async function QuoteDetail({ params }: { params: Promise<{ no: string; cro: string }> }) {
  const { no, cro } = await params;
  const c = croBySlug(cro);

  const kv: [string, string][] = [
    ["GLP 인증", c.glp.join(" · ")],
    ["결제 조건", `선급 ${c.pay} 잔금 (%)`],
    ["보고서 언어", "국문 · 영문 번역 별도"],
    ["시험물질 필요량", "원료 40 g + 예비 10 g"],
    ["추가 제안", c.addon],
  ];

  return (
    <div className="scr scr--sf">
      <SubHeader sheet back={`/app/r/${no}/compare`} backLabel="비교" title="견적서" action={{ label: "PDF 열기", brand: true }}>
        <div style={{ padding: "8px 0 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="tnum" style={{ fontSize: 13, color: "var(--muted)" }}>{c.no} · 견적일 {c.date}</span>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{c.name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)", letterSpacing: ".04em" }}>총 견적액 · VAT 별도</span>
              <span className="tnum" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 }}>{won(c.total)}</span>
            </div>
            <span className="tnum" style={{ fontSize: 13, color: "var(--muted)", textAlign: "right" }}>
              유효 {md(c.valid)}
              <br />
              착수 {md(c.start)} · {c.weeks}주
            </span>
          </div>
        </div>
      </SubHeader>

      <div className="pad" style={{ paddingTop: 20 }}>
        <div className="card" style={{ padding: "18px 18px 6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>항목별 금액</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>단위 원</span>
          </div>
          {c.items.map(([name, price, weeks, design]) => (
            <div key={name} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 0", borderTop: "1px solid var(--track)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{name}</span>
                <span className="tnum" style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" }}>{comma(price)}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="pill pill--ok">가능</span>
                <span className="pill pill--sf">{weeks}주</span>
                <span className="pill pill--sf" style={{ fontWeight: 400 }}>{design}</span>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderTop: "1.5px solid var(--ink)", fontSize: 15 }}>
            <span style={{ fontWeight: 600 }}>합계</span>
            <span className="tnum" style={{ fontWeight: 700 }}>{comma(c.total)}</span>
          </div>
        </div>
      </div>

      <div className="pad" style={{ paddingTop: 12 }}>
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>포함 · 제외</h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {INCL_KEYS.map((k, i) => {
              const yes = !!c.incl[i];
              return (
                <span
                  key={k}
                  style={{
                    fontSize: 13, padding: "5px 10px", borderRadius: 999,
                    border: `1px solid ${yes ? "var(--bline)" : "var(--iline)"}`,
                    background: yes ? "var(--tint)" : "var(--wh)",
                    color: yes ? "var(--brand)" : "var(--ph)",
                    textDecoration: yes ? "none" : "line-through",
                  }}
                >
                  {k}
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", background: "var(--sf)", borderRadius: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>제외 항목 · 별도 옵션</span>
            <span style={{ fontSize: 14, color: "var(--body)", lineHeight: 1.5 }}>{c.excl}</span>
          </div>
        </div>
      </div>

      <div className="pad" style={{ paddingTop: 12 }}>
        <div className="card card--rows">
          {kv.map(([k, v]) => (
            <div key={k} className="kv" style={{ padding: "12px 0", fontSize: 14 }}>
              <span className="kv__k">{k}</span>
              <span className="kv__v">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pad" style={{ padding: "12px 20px 24px" }}>
        <div className="card" style={{ borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 38, height: 38, borderRadius: 9, background: "var(--tint)", color: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>
            PDF
          </span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              정식 견적서_{c.name}.pdf
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>2.4MB · 계약의 정본</span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 16V5M7 10l5-5 5 5" />
            <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
          </svg>
        </div>
      </div>

      <div className="cta cta--sf">
        <Link href={`/app/r/${no}/q/${cro}/select`} className="b1">이 CRO 선택하기</Link>
      </div>
    </div>
  );
}
