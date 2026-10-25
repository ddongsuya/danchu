"use client";
import { useEffect } from "react";

/**
 * 실제 보이는 화면 높이를 px로 재서 --vhpx 에 넣는다. 한 화면 장면 높이의 기준.
 * 카카오톡 같은 앱 내 브라우저는 svh·dvh를 실제보다 크게 계산해 첫 화면 제목이 밀려났다.
 * 주소창이 접히고 펴질 때마다 높이가 바뀌면 스크롤이 튀므로, 폭이 바뀔 때(회전 등)만 다시 잰다.
 */
export function ViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;
    let lastW = 0;
    const set = () => {
      const w = window.innerWidth;
      if (w === lastW) return;
      lastW = w;
      const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
      if (h > 0) root.style.setProperty("--vhpx", `${h}px`);
    };
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);
  return null;
}
