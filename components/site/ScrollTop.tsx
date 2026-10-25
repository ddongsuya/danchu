"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 페이지를 옮기면 맨 위에서 시작한다.
 * 스크롤 스냅이 켜진 상태에서 iOS 사파리는 이전 페이지의 스크롤 위치(맨 아래)를 새 페이지에 그대로 맞춰 버린다.
 * 스냅을 잠깐 끄고 맨 위로 올린 뒤 되돌린다. 앵커(#…)로 들어온 경우는 건드리지 않는다.
 */
export function ScrollTop() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.location.hash) return;
    const html = document.documentElement;
    const prev = html.style.scrollSnapType;
    html.style.scrollSnapType = "none";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    const id = requestAnimationFrame(() => { html.style.scrollSnapType = prev; });
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  return null;
}
