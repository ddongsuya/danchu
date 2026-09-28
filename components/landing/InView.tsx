"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 화면에 들어오면 .in 을 붙이고 한 번만 재생하는 래퍼.
 * 모션 최소화 설정이면 처음부터 .in 상태(= 애니메이션 최종 장면)로 둔다.
 */
export function InView({
  className = "",
  threshold = 0.35,
  children,
}: {
  className?: string;
  threshold?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setOn(true);
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} className={`${className}${on ? " in" : ""}`}>
      {children}
    </div>
  );
}
