"use client";

import { useState, type ReactNode } from "react";

/** 비교 보고서의 부(部) 전환. 한 번에 한 부만 보여 준다 (휴대폰은 화면 전환식). */
export function ReportTabs({ tabs }: { tabs: { id: string; label: string; node: ReactNode }[] }) {
  const [cur, setCur] = useState(tabs[0]?.id);
  const on = tabs.find((t) => t.id === cur) ?? tabs[0];
  const move = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const next = tabs[(i + d + tabs.length) % tabs.length];
    setCur(next.id);
    document.getElementById(`rp-tab-${next.id}`)?.focus();
  };
  return (
    <>
      <div className="rp-tabs" role="tablist" aria-label="보고서 구성">
        {tabs.map((t, i) => (
          <button key={t.id} type="button" role="tab" id={`rp-tab-${t.id}`} aria-selected={t.id === on.id} aria-controls="rp-panel" tabIndex={t.id === on.id ? 0 : -1} onClick={() => setCur(t.id)} onKeyDown={(e) => move(e, i)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="rp-panel" role="tabpanel" id="rp-panel" aria-labelledby={`rp-tab-${on.id}`}>
        {on.node}
      </div>
    </>
  );
}
