"use client";

import { use, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Caret } from "@/components/app/ui";
import { CROS, INCL_KEYS, MIN_TOTAL, dday, md, won } from "@/lib/app-data";

/** 라벨 열과 카드가 같은 행 높이를 공유한다 */
const ROWS: [string, number][] = [
  ["", 72],
  ["총액", 64],
  ["착수 가능일", 48],
  ["총 소요기간", 48],
  ["기본 포함", 92],
  ["제외·별도", 84],
  ["GLP 대응", 64],
  ["결제 조건", 48],
  ["유효기간", 48],
  ["추가 제안", 56],
];

const SORTS: [("total" | "weeks" | "start"), string][] = [
  ["total", "총액"],
  ["weeks", "기간"],
  ["start", "착수일"],
];
const CARD = 262;
const STEP = CARD + 10;

export default function Compare({ params }: { params: Promise<{ no: string }> }) {
  const { no } = use(params);
  const [sortBy, setSortBy] = useState<"total" | "weeks" | "start">("total");
  const [idx, setIdx] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () =>
      [...CROS].sort((a, b) =>
        sortBy === "total" ? a.total - b.total : sortBy === "weeks" ? a.weeks - b.weeks : a.start.localeCompare(b.start),
      ),
    [sortBy],
  );
  const active = sorted[Math.min(idx, sorted.length - 1)];
  const sortLabel = SORTS.find(([k]) => k === sortBy)![1];

  const changeSort = (k: typeof sortBy) => {
    setSortBy(k);
    setIdx(0);
    scroller.current?.scrollTo({ left: 0, behavior: "smooth" });
  };

  return (
    <div className="scr scr--wh">
      <div className="hd">
        <div className="hd__bar">
          <Link href={`/app/r/${no}`} className="hd__back">
            <Caret />
            <span className="tnum">{no}</span>
          </Link>
          <span className="hd__ttl">견적 비교</span>
          <span className="hd__act">PDF</span>
        </div>
        <div style={{ padding: "6px 0 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>5곳 중 {CROS.length}곳 회신 · VAT 별도</span>
          <div className="seg">
            {SORTS.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={sortBy === k} onClick={() => changeSort(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", paddingLeft: 16 }}>
        <div style={{ flex: "none", width: 86, display: "flex", flexDirection: "column", paddingTop: 4 }}>
          {ROWS.map(([label, h], i) => (
            <div
              key={label || "head"}
              style={{
                height: h, display: "flex", alignItems: "center",
                fontSize: 12, fontWeight: 600, color: "var(--muted)",
                borderTop: i === 0 ? undefined : "1px solid var(--track)",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div
          ref={scroller}
          onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / STEP))}
          style={{
            flex: 1, display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory",
            padding: "4px 16px 8px 8px", scrollPaddingLeft: 8, minWidth: 0,
          }}
        >
          {sorted.map((c, i) => {
            const on = i === idx;
            const diff = c.total - MIN_TOTAL;
            return (
              <div
                key={c.slug}
                style={{
                  flex: "none", width: CARD, scrollSnapAlign: "start", borderRadius: 16,
                  border: `1px solid ${on ? "var(--brand)" : "var(--cline)"}`,
                  background: "var(--wh)", display: "flex", flexDirection: "column", overflow: "hidden",
                  boxShadow: on ? "0 12px 30px -16px rgba(26,25,25,.35)" : "none",
                }}
              >
                <div style={{ height: 72, padding: "0 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, background: on ? "var(--tint)" : "var(--wh)" }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{i + 1}위 · {sortLabel} 기준</span>
                </div>
                <div style={{ height: 64, padding: "0 16px", display: "flex", flexDirection: "column", justifyContent: "center", borderTop: "1px solid var(--track)" }}>
                  <span className="tnum" style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}>{won(c.total)}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: diff === 0 ? "var(--ok)" : "var(--muted)" }}>
                    {diff === 0 ? "최저가" : `최저가 대비 +${won(diff)}`}
                  </span>
                </div>
                <div className="tnum" style={{ height: 48, padding: "0 16px", display: "flex", alignItems: "center", borderTop: "1px solid var(--track)", fontSize: 15 }}>
                  {md(c.start)}
                </div>
                <div className="tnum" style={{ height: 48, padding: "0 16px", display: "flex", alignItems: "center", borderTop: "1px solid var(--track)", fontSize: 15 }}>
                  {c.weeks}주
                </div>
                <div style={{ height: 92, padding: "0 16px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "4px 8px", alignContent: "center", borderTop: "1px solid var(--track)" }}>
                  {INCL_KEYS.map((k, ki) => {
                    const yes = !!c.incl[ki];
                    return (
                      <span
                        key={k}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12,
                          color: yes ? "var(--body)" : "var(--ph)",
                          textDecoration: yes ? "none" : "line-through",
                        }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: "50%", background: yes ? "var(--brand)" : "var(--dash)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="var(--onbrand)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        {k}
                      </span>
                    );
                  })}
                </div>
                <div style={{ height: 84, padding: "0 16px", display: "flex", alignItems: "center", borderTop: "1px solid var(--track)", fontSize: 13, lineHeight: 1.45, color: "var(--body)" }}>
                  {c.excl}
                </div>
                <div style={{ height: 64, padding: "0 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, borderTop: "1px solid var(--track)" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.glpOk ? "var(--ok)" : "var(--err)" }}>
                    {c.glpOk ? "US FDA 제출 대응 ✓" : "US FDA 제출 대응 불가"}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{c.glp.join(" · ")}</span>
                </div>
                <div className="tnum" style={{ height: 48, padding: "0 16px", display: "flex", alignItems: "center", borderTop: "1px solid var(--track)", fontSize: 14 }}>
                  {c.pay} (%)
                </div>
                <div className="tnum" style={{ height: 48, padding: "0 16px", display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--track)", fontSize: 14 }}>
                  {md(c.valid)}
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--brand)", background: "var(--tint)", padding: "2px 7px", borderRadius: 999 }}>{dday(c.valid)}</span>
                </div>
                <div style={{ height: 56, padding: "0 16px", display: "flex", alignItems: "center", borderTop: "1px solid var(--track)", fontSize: 14 }}>
                  {c.addon}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "10px 0 4px" }}>
        {sorted.map((c, i) => (
          <span key={c.slug} style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 3, background: i === idx ? "var(--brand)" : "var(--dash)", transition: "all .2s" }} />
        ))}
      </div>

      <div className="cta cta--wh">
        <Link href={`/app/r/${no}/q/${active.slug}`} className="b1">{active.name} 견적서 상세 보기</Link>
        <p className="cta__note">정본은 CRO가 첨부한 PDF 견적서입니다</p>
      </div>
    </div>
  );
}
