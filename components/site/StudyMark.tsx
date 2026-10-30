"use client";

import { useEffect, useRef } from "react";
import { buffer, drawCard, setReduced, W, H, type Kind } from "@/components/site/study-fork-motion";

/** 네 갈래 첫 화면에서 고른 종류의 상징 그래픽 하나. 다음 화면 머리에 두어 어디서 왔는지 이어 준다 */
export function StudyMark({ kind, className }: { kind: Kind; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = mq.matches;
    setReduced(reduce);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;
    const c = cv.getContext("2d")!;
    const A = buffer(), B = buffer();
    let raf = 0, vis = true;
    const t0 = performance.now();
    const frame = (now: number) => {
      if (vis) drawCard(c, kind, now - t0, A, B, reduce);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
    const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; }, { threshold: 0.1 });
    io.observe(cv);
    const onMq = () => { reduce = mq.matches; setReduced(reduce); run(); };
    mq.addEventListener("change", onMq);
    run();
    return () => { cancelAnimationFrame(raf); io.disconnect(); mq.removeEventListener("change", onMq); };
  }, [kind]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
