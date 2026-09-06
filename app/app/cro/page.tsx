"use client";

import { useState } from "react";
import Link from "next/link";
import { CroTabBar, Mark } from "@/components/app/ui";
import { CRO_ME, INBOX } from "@/lib/cro-data";

const FILTERS = ["전체", "신규", "작성 중", "제출"] as const;
const TONE = { brand: "var(--brand)", err: "var(--err)", ok: "var(--ok)" };

export default function CroInbox() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");
  const items = INBOX.filter((r) => filter === "전체" || r.filter === filter);
  const fresh = INBOX.filter((r) => r.filter === "신규").length;

  return (
    <div className="scr scr--sf">
      <div style={{ padding: "calc(var(--top) + 10px) 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Mark size={26} />
          <span style={{ fontSize: 18, fontWeight: 700 }}>단추</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: "var(--ink)", color: "var(--wh)" }}>CRO</span>
        </div>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{CRO_ME.name} · {CRO_ME.user}</span>
      </div>

      <div className="pad" style={{ paddingTop: 24, display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ fontSize: 26, lineHeight: 1.25, fontWeight: 700, letterSpacing: "-0.02em" }}>받은 요청</h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>신규 {fresh}건 · 회신 기한이 가까운 순</p>
      </div>

      <div className="pad" style={{ paddingTop: 16 }}>
        <div className="seg seg--lg">
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      <div className="pad" style={{ padding: "14px 20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((r) => (
          <Link
            key={r.token}
            href={`/app/cro/r/${r.token}`}
            className="card"
            style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, color: "var(--ink)", borderColor: r.filter === "신규" ? "var(--bline)" : undefined }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)", letterSpacing: ".04em" }}>{r.no}</span>
              <span className={`pill ${r.filter === "제출" ? "pill--ok" : r.urgent ? "pill--err" : "pill--sf"}`}>{r.dday}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{r.title}</span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.client} · {r.purpose}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {r.tags.map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--track)", paddingTop: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: TONE[r.tone] }}>{r.state}</span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.action} →</span>
            </div>
          </Link>
        ))}
        {items.length === 0 && (
          <div style={{ border: "1px dashed var(--dash)", borderRadius: 16, padding: "28px 20px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
            해당하는 요청이 없습니다
          </div>
        )}
      </div>

      <CroTabBar active="inbox" />
    </div>
  );
}
