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

const NODES = [
  { label: "A", x: 380, y: 230, tx: -260, ty: -170, fy: -30, cost: "1.2억", weeks: "16주", low: false },
  { label: "B", x: 900, y: 230, tx: 260, ty: -170, fy: 14, cost: "1.35억", weeks: "14주", low: false },
  { label: "C", x: 380, y: 570, tx: -260, ty: 170, fy: 58, cost: "1.1억", weeks: "18주", low: true },
  { label: "D", x: 900, y: 570, tx: 260, ty: 170, fy: 102, cost: "1.28억", weeks: "15주", low: false },
];

/**
 * 오프닝 인트로 (5초, 탭 세션당 1회) — 요청서 → CRO 4곳 → 회신 → 비교표 → 단추 로고로 수렴 → 홈.
 * 서버가 오버레이를 그려 두고, 재방문·모션 최소화 설정이면 페인트 전에 인라인 스크립트가 숨긴다.
 * 클릭하면 건너뛴다.
 */
export function IntroSplash() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.hidden) return;
    document.documentElement.style.overflow = "hidden";
    const fit = () => setScale(Math.min(innerWidth / 1280, innerHeight / 800, 1));
    fit();
    addEventListener("resize", fit);
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
      removeEventListener("resize", fit);
      el.removeEventListener("click", end);
      document.documentElement.style.overflow = "";
    };
  }, []);

  return (
    <>
      <div ref={ref} className="op" aria-hidden="true">
        <div className="op__stage" style={{ transform: `scale(${scale})` }}>
          <div className="op__zoom">
            <svg className="op__svg" viewBox="0 0 1280 800" fill="none" stroke="var(--brand-line)" strokeWidth="1.5" strokeDasharray="600">
              {NODES.map((n) => (
                <path key={n.label} className="op__line" d={`M640 400 L${n.x} ${n.y}`} />
              ))}
            </svg>
            <div className="op__card">
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
                <div className="op__fly" style={{ "--tx": `${n.tx}px`, "--ty": `${n.ty}px` } as React.CSSProperties}>
                  <span className="g-rfq">RFQ · DC-2026-0001</span>
                  <div className="g-bar" style={{ width: "70%" }} />
                  <div className="g-bar" style={{ width: "88%" }} />
                </div>
                <div className="op__node" style={{ left: n.x, top: n.y }}>
                  <b>CRO</b>
                  <span>{n.label}</span>
                </div>
                <div className="op__row" style={{ "--tx": `${n.tx}px`, "--ty": `${n.ty}px`, "--fy": `${n.fy}px` } as React.CSSProperties}>
                  <b>CRO {n.label}</b>
                  <span className={n.low ? "g-low" : undefined}>{n.cost}</span>
                  <span>{n.weeks}</span>
                </div>
              </div>
            ))}
            <div className="op__frame">
              <div className="dh__ttl">견적 비교표 · DC-2026-0001</div>
              <div className="dh__hd">
                <span>기관</span>
                <span>반복투여 4주</span>
                <span>기간</span>
              </div>
            </div>
            <svg className="op__logo" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="13" fill="var(--white)" />
              <circle cx="10" cy="10" r="1.9" fill="var(--brand)" />
              <circle cx="18" cy="10" r="1.9" fill="var(--brand)" />
              <circle cx="10" cy="18" r="1.9" fill="var(--brand)" />
              <circle cx="18" cy="18" r="1.9" fill="var(--brand)" />
            </svg>
            <div className="op__word">
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
