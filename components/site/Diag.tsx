"use client";

import { useEffect, useState } from "react";

/**
 * 화면 진단 상자. 주소 뒤에 ?diag=1 을 붙이면 왼쪽 아래에 뜬다.
 * 보는 환경(브라우저, 동작 줄이기, CSS 지원, 실제로 도는 애니메이션 수)을 캡처 한 장으로 알 수 있게 한다.
 */
export function Diag() {
  const [lines, setLines] = useState<string[] | null>(null);
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("diag")) return;
    const sup = (q: string) => (typeof CSS !== "undefined" && CSS.supports(q) ? "O" : "X");
    const measure = () => {
      const all = document.getAnimations();
      const running = all.filter((a) => a.playState === "running").length;
      const fe = document.querySelectorAll(".fe").length;
      const feAnim = [...document.querySelectorAll<HTMLElement>(".fe")].filter((e) => getComputedStyle(e).animationName !== "none").length;
      const h1 = document.querySelector("main h1");
      const h1op = h1 ? getComputedStyle(h1).opacity : "-";
      // 뷰포트 단위가 실제 몇 px인지 (앱 내 브라우저는 vh 계열을 엉뚱하게 계산할 수 있다)
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0";
      document.body.appendChild(probe);
      const px = (v: string) => { probe.style.height = v; return Math.round(probe.getBoundingClientRect().height); };
      const units = `vh ${px("100vh")} · svh ${px("100svh")} · dvh ${px("100dvh")} · lvh ${px("100lvh")}`;
      probe.remove();
      const rect = (sel: string) => { const el = document.querySelector(sel); if (!el) return `${sel} 없음`; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return `${sel} y${Math.round(r.top + scrollY)} h${Math.round(r.height)} w${Math.round(r.width)} ${cs.display}/${cs.visibility}/op${cs.opacity}`; };
      setLines([
        `단위 ${units} · vv ${Math.round(visualViewport?.height ?? 0)} · 문서높이 ${document.documentElement.scrollHeight} · scrollY ${Math.round(scrollY)}`,
        rect("nav.top"), rect(".first"), rect("main h1"), rect(".fd"), rect(".strip"), rect(".cue"),
        `h1 글꼴 ${h1 ? getComputedStyle(h1).fontFamily.split(",")[0] : "-"} · 색 ${h1 ? getComputedStyle(h1).color : "-"}`,
        `UA ${navigator.userAgent}`,
        `화면 ${innerWidth}x${innerHeight} dpr ${devicePixelRatio}`,
        `동작 줄이기 ${matchMedia("(prefers-reduced-motion: reduce)").matches ? "켜짐" : "꺼짐"}`,
        `지원: cqw ${sup("width:1cqw")} · animation-timeline ${sup("animation-timeline:view()")} · :has ${sup("selector(:has(a))")} · dvh ${sup("height:100dvh")}`,
        `애니메이션 전체 ${all.length} · 재생 중 ${running}`,
        `영상 조각 .fe ${fe} · 애니메이션 적용 ${feAnim}`,
        `첫 제목 opacity ${h1op}`,
        `빌드 ${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local"}`,
      ]);
    };
    measure();
    const t = setInterval(measure, 1500);
    return () => clearInterval(t);
  }, []);
  if (!lines) return null;
  return (
    <pre style={{ position: "fixed", left: 8, bottom: 8, zIndex: 9999, maxWidth: "calc(100vw - 16px)", margin: 0, padding: "10px 12px", background: "#1B1B19", color: "#F4F4F0", font: "12px/1.5 ui-monospace, monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", borderRadius: 2 }}>
      {lines.join("\n")}
    </pre>
  );
}
