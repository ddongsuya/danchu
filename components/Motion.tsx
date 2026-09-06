"use client";

import { useEffect } from "react";

/**
 * 랜딩 모션 컨트롤러
 * - [data-rv] 요소를 뷰포트 진입 시 .in 으로 전환 (스크롤 등장)
 * - [data-timeline] 의 스크롤 진행도를 --s1~--s5 로 스테이지에 기록
 * 두 동작 모두 prefers-reduced-motion 을 존중한다.
 */
export function Motion() {
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 1) 스크롤 등장
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
    const observeAll = () =>
      document.querySelectorAll("[data-rv]:not(.in)").forEach((el) => io.observe(el));

    // 인트로가 재생 중이면 끝나갈 무렵부터 관찰 시작
    const introPlaying = !!document.querySelector(".intro:not([hidden])");
    const startAt = introPlaying ? 2250 : 0;
    const t = window.setTimeout(observeAll, startAt);

    // 2) 스크롤 타임라인
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const seg = (p: number, a: number, b: number) => ease(Math.min(1, Math.max(0, (p - a) / (b - a))));

    let raf = 0;
    const tick = () => {
      const wrap = document.querySelector<HTMLElement>("[data-timeline]");
      if (!wrap) return;
      const stage = wrap.firstElementChild as HTMLElement | null;
      if (!stage) return;
      const r = wrap.getBoundingClientRect();
      const vh = stage.clientHeight || innerHeight;
      const span = r.height - vh;
      if (!(span > 0)) return;
      let p = reduce ? 1 : Math.min(1, Math.max(0, -r.top / span));
      if (!isFinite(p)) p = 0;
      [seg(p, 0, 0.14), seg(p, 0.14, 0.4), seg(p, 0.4, 0.6), seg(p, 0.6, 0.8), seg(p, 0.82, 1)].forEach(
        (v, i) => stage.style.setProperty("--s" + (i + 1), v.toFixed(4)),
      );
    };
    // 앵커 이동처럼 화면을 건너뛰었을 때 남는 미노출 요소를 정리한다
    const sweep = () => {
      document.querySelectorAll<HTMLElement>("[data-rv]:not(.in)").forEach((el) => {
        if (el.getBoundingClientRect().top < innerHeight * 0.85) el.classList.add("in");
      });
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        tick();
        sweep();
      });
    };

    addEventListener("scroll", onScroll, { capture: true, passive: true });
    addEventListener("resize", onScroll);
    tick();
    requestAnimationFrame(tick);
    const t2 = window.setTimeout(tick, 300);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      if (raf) cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll, { capture: true });
      removeEventListener("resize", onScroll);
      io.disconnect();
    };
  }, []);

  return null;
}

const HOLES: [number, number, string, string, string][] = [
  [57, 57, "-40vw", "-40vh", "0s"],
  [115, 57, "40vw", "-40vh", ".1s"],
  [57, 115, "-40vw", "40vh", ".2s"],
  [115, 115, "40vw", "40vh", ".3s"],
];

/** 첫 방문(탭 세션 기준) 시 한 번 재생되는 인트로 스플래시 */
export function IntroSplash() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".intro");
    if (!el || el.hidden) return;
    document.documentElement.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      el.hidden = true;
      document.documentElement.style.overflow = "";
    }, 2750);
    return () => {
      clearTimeout(t);
      document.documentElement.style.overflow = "";
    };
  }, []);

  return (
    <>
      <div className="intro" aria-hidden="true">
        <div className="intro__in">
          <div className="intro__disc-wrap">
            <div className="intro__disc" />
            {HOLES.map(([l, t, hx, hy, d]) => (
              <span
                key={`${l}-${t}`}
                className="intro__hole"
                style={
                  {
                    left: l,
                    top: t,
                    "--hx": hx,
                    "--hy": hy,
                    animationDelay: d,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          <div className="intro__word">
            <b>단추</b>
            <span>여러 조각을 하나로</span>
          </div>
        </div>
      </div>
      {/* 재방문·모션 최소화 설정에서는 페인트 전에 즉시 숨긴다 */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var s=sessionStorage.getItem('dc_intro');var r=matchMedia('(prefers-reduced-motion: reduce)').matches;if(s||r){var e=document.querySelector('.intro');if(e)e.hidden=true;}else{sessionStorage.setItem('dc_intro','1');}}catch(e){}})()",
        }}
      />
    </>
  );
}
