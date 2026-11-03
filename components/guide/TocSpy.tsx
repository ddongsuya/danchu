"use client";

import { useEffect } from "react";

/**
 * 가이드라인 자료실 목차: 지금 읽는 주제를 목차에 표시하고(aria-current),
 * 제품 유형을 바꾸면 목록 맨 위로 돌아간다(목록이 줄어 빈 화면에 남지 않게).
 * 스크롤 이벤트 대신 IntersectionObserver 와 scrollend 로 본다.
 */
export function TocSpy() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lib");
    if (!root) return;
    const links = new Map<string, HTMLAnchorElement>();
    root.querySelectorAll<HTMLAnchorElement>(".lt a").forEach((a) => links.set(a.hash.slice(1), a));
    const mark = (id: string) => links.forEach((a, k) => (k === id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));

    // 보이는 주제 중 윗변이 사이드바 상단(108px) 근처를 지난 마지막 것을 지금 주제로 본다.
    // 주제가 지나갈 때마다 다시 계산한다(스크롤 이벤트 대신 IntersectionObserver).
    const pick = () => {
      let cur = "";
      root.querySelectorAll<HTMLElement>(".ltopic").forEach((s) => {
        if (s.offsetParent !== null && s.getBoundingClientRect().top <= 120) cur = s.id;
      });
      const first = root.querySelector<HTMLElement>(".ltopic:not([hidden])");
      mark(cur || first?.id || "");
    };
    const io = new IntersectionObserver(pick, { rootMargin: "-100px 0px -40% 0px", threshold: [0, 1] });
    root.querySelectorAll<HTMLElement>(".ltopic").forEach((s) => io.observe(s));

    // 목차를 누르면 바로 표시(부드러운 스크롤이 끝나기 전에도)
    const onClick = (e: Event) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>(".lt a");
      if (a) mark(a.hash.slice(1));
    };
    const onChange = (e: Event) => {
      if (!(e.target as HTMLElement).matches('input[name="lp"]')) return;
      if (root.getBoundingClientRect().top < 0) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        root.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      }
    };
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    window.addEventListener("scrollend", pick);
    return () => {
      io.disconnect();
      root.removeEventListener("click", onClick);
      root.removeEventListener("change", onChange);
      window.removeEventListener("scrollend", pick);
    };
  }, []);
  return null;
}
