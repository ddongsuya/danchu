import Link from "next/link";
import { Deadlines } from "@/components/app/Deadlines";
import { RESULTS } from "@/lib/cro-data";

export default function CroQuotes() {
  return (
    <div className="scr scr--sf">
      <div style={{ padding: "calc(var(--top) + 10px) 20px 0", display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ fontSize: 26, lineHeight: 1.25, fontWeight: 700, letterSpacing: "-0.02em" }}>제출한 견적</h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>기한 내에는 수정할 수 있습니다</p>
      </div>

      <div className="pad" style={{ paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>최근 결과</h2>
        <Link href="/app/cro/awards" style={{ fontSize: 13, color: "var(--muted)" }}>선정 2 · 미선정 1 →</Link>
      </div>
      <div className="pad" style={{ padding: "10px 20px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {RESULTS.slice(0, 2).map(([title, sub, state]) => (
          <Link key={title} href="/app/cro/awards" className="card" style={{ borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, color: "var(--ink)" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{sub}</span>
            </div>
            <span className={`pill ${state === "선정" ? "pill--ok" : "pill--sf"}`}>{state}</span>
          </Link>
        ))}
      </div>

      <Deadlines active="quotes" />
    </div>
  );
}
