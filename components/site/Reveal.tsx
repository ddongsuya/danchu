"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 목록이 화면에 들어오면 항목이 차례로 나타난다(30~80ms 스태거). 한 번만.
 * 쉬는 상태에서는 그대로 보이고, data-in 이 붙을 때만 나타나는 움직임을 한 번 재생한다. 동작 줄이기면 움직임 없음.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.dataset.in = "1"; io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={["rv", className].filter(Boolean).join(" ")}>{children}</div>;
}
