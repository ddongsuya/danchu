"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 스크롤 등장 컨트롤러 — [data-rv] 요소를 뷰포트 진입 시 .in 으로 전환.
 * 오프닝 인트로가 재생 중이면 끝나갈 무렵부터 관찰을 시작한다.
 */
export function Motion() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 },
    );
    const observeAll = () => document.querySelectorAll("[data-rv]:not(.in)").forEach((el) => io.observe(el));
    const introPlaying = !!document.querySelector(".op:not([hidden])");
    const t = window.setTimeout(observeAll, introPlaying ? 4500 : 0);
    // 인트로를 클릭으로 건너뛰면 바로 시작
    const onSkip = () => {
      clearTimeout(t);
      observeAll();
    };
    addEventListener("dc:intro-end", onSkip);
    return () => {
      clearTimeout(t);
      removeEventListener("dc:intro-end", onSkip);
      io.disconnect();
    };
  }, []);
  return null;
}

/**
 * 인트로 무대 좌표. 가로 화면은 넓게, 세로(폰) 화면은 위아래로 긴 배치를 쓴다.
 * 무대 전체가 화면 안에 들어가도록 축소하므로(contain) 잘리는 요소가 없다.
 */
type Stage = {
  w: number;
  h: number;
  cx: number;
  cy: number;
  dx: number;
  dy: number;
  nodes: [number, number][];
  /** 마지막 로고·문구 확대 배수 */
  boost: number;
};

const WIDE: Stage = { w: 1280, h: 800, cx: 640, cy: 400, dx: 260, dy: 170, nodes: [[380, 230], [900, 230], [380, 570], [900, 570]], boost: 1 };
const TALL: Stage = { w: 640, h: 800, cx: 320, cy: 400, dx: 150, dy: 210, nodes: [[140, 170], [500, 170], [140, 630], [500, 630]], boost: 1.7 };

const ROWS = [
  { label: "A", fy: -30, cost: "1.2억", weeks: "16주", low: false },
  { label: "B", fy: 14, cost: "1.35억", weeks: "14주", low: false },
  { label: "C", fy: 58, cost: "1.1억", weeks: "18주", low: true },
  { label: "D", fy: 102, cost: "1.28억", weeks: "15주", low: false },
];

/**
 * 오프닝 인트로 (5초, 탭 세션당 1회) — 요청서 → CRO 4곳 → 회신 → 비교표 → 단추 로고로 수렴 → 홈.
 * 서버가 오버레이를 그려 두고, 재방문·모션 최소화 설정이면 페인트 전에 인라인 스크립트가 숨긴다.
 * 클릭하면 건너뛴다.
 */
export function IntroSplash() {
  const ref = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>(WIDE);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.hidden) return;
    document.documentElement.style.overflow = "hidden";
    /** 레이아웃 뷰포트 기준으로 무대를 고른 뒤 화면 안에 다 들어가도록 축소한다 */
    const fit = () => {
      const root = document.documentElement;
      const w = root.clientWidth || innerWidth;
      const h = root.clientHeight || innerHeight;
      const s = w < 760 || w < h ? TALL : WIDE;
      setStage(s);
      setScale(Math.min(w / s.w, h / s.h, 1));
    };
    fit();
    // resize 이벤트가 오지 않는 레이아웃 변화(주소창 접힘, 창 분할)도 잡는다
    const ro = new ResizeObserver(fit);
    ro.observe(document.documentElement);
    addEventListener("orientationchange", fit);
    const end = () => {
      if (el.hidden) return;
      el.hidden = true;
      document.documentElement.style.overflow = "";
      dispatchEvent(new Event("dc:intro-end"));
    };
    const t = window.setTimeout(end, 5000);
    el.addEventListener("click", end);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      removeEventListener("orientationchange", fit);
      el.removeEventListener("click", end);
      document.documentElement.style.overflow = "";
    };
  }, []);

  const { cx, cy, dx, dy, nodes, boost } = stage;
  const mid = { left: cx, top: cy };

  return (
    <>
      <div ref={ref} className="op" aria-hidden="true" style={{ "--boost": boost, visibility: scale ? "visible" : "hidden" } as React.CSSProperties}>
        <div className="op__stage" style={{ width: stage.w, height: stage.h, marginLeft: -stage.w / 2, marginTop: -stage.h / 2, transform: `scale(${scale})` }}>
          <div className="op__zoom">
            <svg className="op__svg" viewBox={`0 0 ${stage.w} ${stage.h}`} fill="none" stroke="var(--brand-line)" strokeWidth="1.5" strokeDasharray="600">
              {nodes.map(([x, y]) => (
                <path key={`${x}-${y}`} className="op__line" d={`M${cx} ${cy} L${x} ${y}`} />
              ))}
            </svg>

            <div className="op__card" style={mid}>
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

            {ROWS.map((r, i) => {
              const [nx, ny] = nodes[i];
              const tx = nx < cx ? -dx : dx;
              const ty = ny < cy ? -dy : dy;
              return (
                <div key={r.label}>
                  <div className="op__fly" style={{ ...mid, "--tx": `${tx}px`, "--ty": `${ty}px` } as React.CSSProperties}>
                    <span className="g-rfq">RFQ · DC-2026-0001</span>
                    <div className="g-bar" style={{ width: "70%" }} />
                    <div className="g-bar" style={{ width: "88%" }} />
                  </div>
                  <div className="op__node" style={{ left: nx, top: ny }}>
                    <b>CRO</b>
                    <span>{r.label}</span>
                  </div>
                  <div className="op__row" style={{ ...mid, "--tx": `${tx}px`, "--ty": `${ty}px`, "--fy": `${r.fy}px` } as React.CSSProperties}>
                    <b>CRO {r.label}</b>
                    <span className={r.low ? "g-low" : undefined}>{r.cost}</span>
                    <span>{r.weeks}</span>
                  </div>
                </div>
              );
            })}

            <div className="op__frame" style={mid}>
              <div className="dh__ttl">견적 비교표 · DC-2026-0001</div>
              <div className="dh__hd">
                <span>기관</span>
                <span>반복투여 4주</span>
                <span>기간</span>
              </div>
            </div>

            <svg className="op__logo" viewBox="0 0 28 28" style={mid}>
              <circle cx="14" cy="14" r="13" fill="var(--white)" />
              <circle cx="10" cy="10" r="1.9" fill="var(--brand)" />
              <circle cx="18" cy="10" r="1.9" fill="var(--brand)" />
              <circle cx="10" cy="18" r="1.9" fill="var(--brand)" />
              <circle cx="18" cy="18" r="1.9" fill="var(--brand)" />
            </svg>
            <div className="op__word" style={{ top: cy + 108 * boost }}>
              <b>단추</b>
              <span>여러 조각을 하나로</span>
            </div>
          </div>
        </div>
        <span className="op__skip">클릭하면 건너뜁니다</span>
      </div>
      {/* 재방문·모션 최소화 설정에서는 페인트 전에 즉시 숨긴다 */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var s=sessionStorage.getItem('dc_intro_v2');var r=matchMedia('(prefers-reduced-motion: reduce)').matches;if(s||r){var e=document.querySelector('.op');if(e)e.hidden=true;}else{sessionStorage.setItem('dc_intro_v2','1');}}catch(e){}})()",
        }}
      />
    </>
  );
}
