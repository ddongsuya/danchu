"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 메뉴 페이지 첫 제목(main h1)이 실제 휴대폰에서 보이는지 스스로 확인해 기록한다.
 * 페이지를 열거나 옮긴 뒤 0.8초와 2.5초에 제목 위치·가림 여부·화면 높이를 /api/diag 로 보낸다.
 * 사용자가 이미 스크롤을 시작했으면 touched 표시를 붙여 보낸다(바로 스크롤한 경우도 놓치지 않으려고).
 * 화면 동작에는 아무 영향이 없다. 휴대폰 폭(860px 이하)에서만 보낸다.
 */
export function HeadWatch() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.innerWidth > 860 || typeof navigator.sendBeacon !== "function") return;
    let touched = false;
    const stop = () => { touched = true; };
    addEventListener("touchstart", stop, { passive: true, once: true });
    addEventListener("wheel", stop, { passive: true, once: true });
    const send = (at: number) => {
      try {
        const h = document.querySelector<HTMLElement>("main h1");
        const r = (el: Element | null) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), Math.round(b.height)]; };
        const cs = h ? getComputedStyle(h) : null;
        let cover = "";
        if (h) {
          const b = h.getBoundingClientRect();
          const x = Math.min(Math.max(b.left + 8, 1), innerWidth - 1), y = Math.min(Math.max(b.top + b.height / 2, 1), innerHeight - 1);
          const at = document.elementFromPoint(x, y);
          cover = at ? `${at.tagName.toLowerCase()}.${String(at.className).slice(0, 40)}` : "none";
        }
        const hb = h?.getBoundingClientRect();
        // 감싼 요소까지 곱한 실제 불투명도 (제목 자신은 1이어도 부모가 0이면 안 보인다)
        let eff = 1; for (let el: Element | null = h; el && el !== document.documentElement; el = el.parentElement) eff *= Number(getComputedStyle(el).opacity);
        const ok = !!h && !!hb && hb.top >= 0 && hb.bottom <= innerHeight && eff === 1 && cs?.visibility === "visible" && (cover.startsWith("h1") || !!h.contains(document.elementFromPoint(Math.max(hb.left + 8, 1), Math.min(Math.max(hb.top + hb.height / 2, 1), innerHeight - 1))));
        const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
        const data = {
          ok, at, touched, cueTap: (window as Window & { __cueTap?: number }).__cueTap ?? null, path: location.pathname, nav: nav?.type, y: Math.round(scrollY), ih: innerHeight, iw: innerWidth,
          vv: Math.round(window.visualViewport?.height ?? 0), ch: document.documentElement.clientHeight,
          vhpx: document.documentElement.style.getPropertyValue("--vhpx"),
          h1: r(h), h1c: cs ? [cs.color, cs.opacity, cs.visibility, cs.fontSize] : null, eff: Math.round(eff * 100) / 100,
          first: r(document.querySelector("main > :first-child")), top: r(document.querySelector("nav.top")),
          cover, theme: document.documentElement.dataset.theme, rm: matchMedia("(prefers-reduced-motion: reduce)").matches,
          dark: matchMedia("(prefers-color-scheme: dark)").matches, dpr: devicePixelRatio,
          ua: navigator.userAgent.slice(0, 220), build: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
        };
        navigator.sendBeacon("/api/diag", new Blob([JSON.stringify(data)], { type: "text/plain" }));
      } catch { /* 기록 실패는 무시 */ }
    };
    const timers = [800, 2500].map((ms) => window.setTimeout(() => send(ms), ms));
    return () => { timers.forEach(clearTimeout); removeEventListener("touchstart", stop); removeEventListener("wheel", stop); };
  }, [pathname]);
  return null;
}
