import type { QuoteLineDef } from "@/lib/quote-items";

export function StudyConditions({ row }: { row: QuoteLineDef }) {
  if (!row.conditions?.length) {
    return row.cond ? <span style={{ fontSize: 13, color: "var(--body)", lineHeight: 1.5 }}>{row.cond}</span> : null;
  }
  return (
    <dl style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
      {row.conditions.map(([label, value]) => (
        <div key={label} style={{ marginTop: 4 }}>
          <dt style={{ color: "var(--muted)" }}>{label}</dt>
          <dd style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
