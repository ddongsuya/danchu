"use client";

import { COST_PARTS, costTotal } from "@/lib/efficacy";

type Design = Record<string, unknown>;

/**
 * 효력시험 회신의 비용 구분. 설계는 기관마다 달라도 비용이 생기는 자리는 같다.
 * 다섯 칸을 채우면 합계가 총액이 된다. 값은 design.extra 에 cost_* 로 저장한다.
 */
export function EfficacyCosts({ value, disabled, onChange }: { value: Design; disabled: boolean; onChange: (d: Design, total: string) => void }) {
  const extra = (value.extra && typeof value.extra === "object" ? value.extra : {}) as Record<string, unknown>;
  const total = costTotal(extra);
  const set = (key: string, raw: string) => {
    const v = raw.replace(/[^\d]/g, "").slice(0, 12);
    const next = { ...extra, [key]: v };
    const sum = costTotal(next);
    onChange({ ...value, extra: next }, sum ? String(sum) : "");
  };
  return (
    <div style={{ borderTop: "1px dashed var(--cline)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>비용 구분</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>채우면 합계가 금액에 들어갑니다</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
        {COST_PARTS.map(([key, label, hint]) => (
          <div key={key} className="fld" style={{ gap: 4 }}>
            <label className="fld__lab" style={{ fontSize: 12 }} title={hint}>{label}</label>
            <div className="numin">
              <input type="text" inputMode="numeric" disabled={disabled} placeholder={hint} value={typeof extra[key] === "string" && extra[key] ? Number(extra[key]).toLocaleString("ko-KR") : ""} onChange={(e) => set(key, e.target.value)} aria-label={label} />
              <span>원</span>
            </div>
          </div>
        ))}
      </div>
      {total > 0 && <span className="tnum" style={{ fontSize: 12.5, color: "var(--muted)" }}>구분 합계 {total.toLocaleString("ko-KR")}원</span>}
    </div>
  );
}
