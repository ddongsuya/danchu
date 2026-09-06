import Link from "next/link";
import { CroTabBar } from "./ui";
import { DEADLINES } from "@/lib/cro-data";

/** 마감 현황 리스트 + CRO 탭바 — 16 제출 완료와 '제출한 견적' 탭이 공유 */
export function Deadlines({ active, title = "마감 현황" }: { active: "inbox" | "quotes" | "org"; title?: string }) {
  return (
    <>
      <div className="pad" style={{ paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>9월 7일 기준</span>
      </div>
      <div className="pad" style={{ padding: "10px 20px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {DEADLINES.map((d) => (
          <Link key={d.no} href={`/app/cro/r/${d.token}`} className="card" style={{ borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, color: "var(--ink)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{d.title}</span>
                <span className="tnum" style={{ fontSize: 12, color: "var(--muted)" }}>{d.no} · {d.sub}</span>
              </div>
              <span className={`pill pill--${d.tone}`}>{d.pill}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="bar"><i className={d.bar === "err" ? "bar--err" : ""} style={{ width: `${d.pct}%` }} /></div>
              <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{d.meta}</span>
            </div>
          </Link>
        ))}
      </div>
      <CroTabBar active={active} />
    </>
  );
}
