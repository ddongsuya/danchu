import Link from "next/link";
import type { Stuck } from "@/lib/stuck";

export type StuckRow = { rfq_no: string; company: string; substance: string; reasons: Stuck[] };

/** 운영자 홈 맨 위 "멈춘 요청" (2026-10-29 과업 점검 1·6). 사람 손이 필요한 요청을 이유·바로 할 일과 함께 */
export function StuckList({ rows }: { rows: StuckRow[] }) {
  return (
    <section className="stuck" aria-labelledby="stuck-h">
      <h2 id="stuck-h">멈춘 요청 {rows.length}</h2>
      {rows.length === 0 ? <p style={{ fontSize: 14, color: "var(--muted)" }}>사람 손이 필요한 요청이 없습니다.</p> : rows.map((r) => (
        <div key={r.rfq_no} className="stuck__row">
          <span className="stuck__no">{r.rfq_no}</span>
          <span className="stuck__why">{r.reasons.map((x) => x.label).join(", ")}<small>{r.company} · {r.substance}</small></span>
          <Link href={`/admin/r/${r.rfq_no}`} className="b2">{r.reasons[0].action}</Link>
        </div>
      ))}
    </section>
  );
}
