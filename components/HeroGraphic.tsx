"use client";

import { useEffect, useRef, useState } from "react";

/** 그래픽 노드 — CRO 4곳 위치, 분배 카드 이동량, 회신 행 정렬 위치 */
const NODES = [
  { label: "A", x: 60, y: 60, tx: -160, ty: -110, fy: -38, cost: "1.2억", weeks: "16주", low: false },
  { label: "B", x: 380, y: 60, tx: 160, ty: -110, fy: -2, cost: "1.35억", weeks: "14주", low: false },
  { label: "C", x: 60, y: 280, tx: -160, ty: 110, fy: 34, cost: "1.1억", weeks: "18주", low: true },
  { label: "D", x: 380, y: 280, tx: 160, ty: 110, fy: 70, cost: "1.28억", weeks: "15주", low: false },
];

/**
 * 히어로 루프 그래픽 — 요청서 1장 → CRO 4곳 → 회신 4행 → 비교표 (3초, 반복).
 * 440×340 고정 좌표로 그리고, 부모 폭이 좁으면 통째로 축소한다.
 */
export function HeroGraphic({ mode = "loop" }: { mode?: "loop" | "static" }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / 440));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrap} className="dh-wrap" aria-hidden="true">
      <div style={{ transform: `scale(${scale})` }}>
        <div className={`dh${mode === "static" ? " dh--static" : ""}`}>
          <svg className="dh__svg" viewBox="0 0 440 340" fill="none" stroke="var(--brand-line)" strokeWidth="1.5" strokeDasharray="400">
            {NODES.map((n) => (
              <path key={n.label} className="dh__line" d={`M220 170 L${n.x} ${n.y}`} />
            ))}
          </svg>

          <div className="dh__card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="g-rfq">RFQ · DC-2026-0001</span>
              <span className="g-dot" />
            </div>
            <div className="g-bar" style={{ width: "70%" }} />
            <div className="g-bar" style={{ width: "88%" }} />
            <div className="g-bar" style={{ width: "55%" }} />
            <div style={{ marginTop: "auto", display: "flex", gap: 6 }}>
              <span className="g-tag">반복투여독성</span>
              <span className="g-tag">유전독성</span>
            </div>
          </div>

          {NODES.map((n) => (
            <div key={n.label}>
              <div className="dh__fly" style={{ "--tx": `${n.tx}px`, "--ty": `${n.ty}px` } as React.CSSProperties}>
                <span className="g-rfq" style={{ fontSize: 10 }}>RFQ · DC-2026-0001</span>
                <div className="g-bar g-bar--s" style={{ width: "70%" }} />
                <div className="g-bar g-bar--s" style={{ width: "88%" }} />
              </div>
              <div className="dh__node" style={{ left: n.x, top: n.y }}>
                <b>CRO</b>
                <span>{n.label}</span>
              </div>
              <div className="dh__row" style={{ "--tx": `${n.tx}px`, "--ty": `${n.ty}px`, "--fy": `${n.fy}px` } as React.CSSProperties}>
                <b>CRO {n.label}</b>
                <span className={n.low ? "g-low" : undefined}>{n.cost}</span>
                <span>{n.weeks}</span>
              </div>
            </div>
          ))}

          <div className="dh__frame">
            <div className="dh__ttl">견적 비교표 · DC-2026-0001</div>
            <div className="dh__hd">
              <span>기관</span>
              <span>반복투여 4주</span>
              <span>기간</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
