import Link from "next/link";
import { Bar, Mark, StatusPill, TabBar } from "@/components/app/ui";
import { FOCUS, ME, REQUESTS, SUMMARY } from "@/lib/app-data";

const TILES: [string, number, boolean][] = [
  ["진행 중", SUMMARY.ongoing, false],
  ["견적 도착", SUMMARY.arrived, true],
  ["종료", SUMMARY.closed, false],
];

export default function Home() {
  return (
    <div className="scr scr--sf">
      <div style={{ padding: "calc(var(--top) + 10px) 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Mark size={26} />
          <span style={{ fontSize: 18, fontWeight: 700 }}>단추</span>
        </div>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{ME.company}</span>
      </div>

      <div className="pad" style={{ paddingTop: 28, display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ fontSize: 26, lineHeight: 1.25, fontWeight: 700, letterSpacing: "-0.02em" }}>
          {ME.name} 님,
          <br />
          견적 {SUMMARY.arrived}건이 도착했어요
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }} className="tnum">
          {FOCUS.no} · 5곳 중 {SUMMARY.arrived}곳 회신
        </p>
      </div>

      <div className="pad" style={{ paddingTop: 20, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
        {TILES.map(([label, n, brand]) => (
          <div key={label} className="card" style={{ padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
            <span className="tnum" style={{ fontSize: 24, fontWeight: 700, color: brand ? "var(--brand)" : undefined }}>{n}</span>
          </div>
        ))}
      </div>

      <div className="pad" style={{ paddingTop: 28, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>내 요청</h2>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>최근순</span>
      </div>

      <div className="pad" style={{ padding: "12px 20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {REQUESTS.map((r) => (
          <Link
            key={r.no}
            href={`/app/r/${r.no}`}
            className="card"
            style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, color: "var(--ink)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)", letterSpacing: ".04em" }}>{r.no}</span>
              <StatusPill tone={r.tone}>{r.status}</StatusPill>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{r.substance}</span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.cats}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Bar pct={r.pct} />
              <span className="tnum" style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{r.meta}</span>
            </div>
          </Link>
        ))}
      </div>

      <TabBar active="home" unread />
    </div>
  );
}
