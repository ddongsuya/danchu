"use client";

import { useEffect, useRef, useState } from "react";
import { InView } from "@/components/landing/InView";

/** 720×440 고정 좌표로 그리고, 부모 폭이 좁으면 통째로 축소한다. */
const W = 720;
const H = 440;

const NODES = [
  { label: "A", x: 70, y: 60, tx: -290, ty: -160, fy: -51, cost: "1.12억", weeks: "16주", low: false },
  { label: "B", x: 650, y: 60, tx: 290, ty: -160, fy: -17, cost: "1.05억", weeks: "14주", low: true },
  { label: "C", x: 70, y: 380, tx: -290, ty: 160, fy: 17, cost: "1.01억", weeks: "18주", low: false },
  { label: "D", x: 650, y: 380, tx: 290, ty: 160, fy: 51, cost: "1.17억", weeks: "15주", low: false },
];

/**
 * 요청서 한 장 → 기관 네 곳 → 회신 네 줄 → 비교표.
 * 화면에 들어오면 한 번 재생하고 비교표 장면에서 멈춘다(각 애니메이션 fill: forwards).
 */
export function Sequence() {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / W));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrap} className="sq-wrap" aria-hidden="true">
      <div className="sq-scale" style={{ transform: `scale(${scale})` }}>
        <InView className="sq" threshold={0.3}>
          <svg className="sq__svg" viewBox={`0 0 ${W} ${H}`} fill="none" strokeWidth="1.5" strokeDasharray="420">
            {NODES.map((n) => (
              <path key={n.label} className="sq__line" d={`M360 220 L${n.x} ${n.y}`} />
            ))}
          </svg>

          <div className="sq__card">
            <div className="sq__card-top">
              <span className="sq__tag-id">RFQ · DC-2026-0142</span>
              <span className="sq__dot" />
            </div>
            <span className="sq__bar" style={{ width: "72%" }} />
            <span className="sq__bar" style={{ width: "90%" }} />
            <span className="sq__bar" style={{ width: "56%" }} />
            <div className="sq__tags">
              <span className="sq__tag">반복투여독성</span>
              <span className="sq__tag">유전독성</span>
            </div>
          </div>

          {NODES.map((n) => (
            <div key={n.label}>
              <div className="sq__fly" style={{ "--tx": `${n.tx}px`, "--ty": `${n.ty}px` } as React.CSSProperties}>
                <span className="sq__tag-id">RFQ · DC-2026-0142</span>
                <span className="sq__bar sq__bar--s" style={{ width: "72%" }} />
                <span className="sq__bar sq__bar--s" style={{ width: "90%" }} />
              </div>
              <div className="sq__node" style={{ left: n.x, top: n.y }}>
                <b>CRO</b>
                <span>{n.label}</span>
              </div>
              <div
                className="sq__row"
                style={{ "--tx": `${n.tx}px`, "--ty": `${n.ty}px`, "--fy": `${n.fy}px` } as React.CSSProperties}
              >
                <b>CRO {n.label}</b>
                <span className={n.low ? "sq__low" : undefined}>{n.cost}</span>
                <span>{n.weeks}</span>
              </div>
            </div>
          ))}

          <div className="sq__frame">
            <span className="sq__frame-ttl">견적 비교표 · DC-2026-0142</span>
            <div className="sq__frame-hd">
              <span>기관</span>
              <span>총액</span>
              <span>기간</span>
            </div>
          </div>
        </InView>
      </div>
    </div>
  );
}
