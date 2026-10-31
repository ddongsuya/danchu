"use client";

import { useEffect, useState } from "react";

/**
 * 휴대폰 바닥에 붙는 행동 버튼. 첫 장면의 같은 버튼(.rs-acts)이 화면에 보이는 동안에는 숨겨
 * 한 화면에 같은 버튼이 두 개 보이지 않게 한다. 첫 장면이 없거나 관찰을 못 하면 그냥 보인다.
 */
export function DockAfter({ children, watch = ".rs-acts" }: { children: React.ReactNode; watch?: string }) {
  // hidden: 스크립트가 관찰을 시작한 뒤에만 true 가 된다. 스크립트가 없으면 버튼은 늘 보인다
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const el = document.querySelector(watch);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);
  return (
    <div className="cta only-narrow dock" data-js-away={hidden ? "" : undefined} aria-hidden={hidden || undefined}>
      {children}
    </div>
  );
}
