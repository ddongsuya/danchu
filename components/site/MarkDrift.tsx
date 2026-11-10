"use client";

import { useEffect, useRef } from "react";

/**
 * 랜딩 첫 화면 그림: 검정 점 네 개가 종이 위를 떠돌다가 가운데로 모여 네 칸 마크가 되고, 다시 풀려 떠돈다.
 * 시작도 끝도 없이 이어진다. 캔버스 한 장에 그리기만 하고(레이아웃을 건드리지 않는다),
 * 화면 밖이거나 탭이 가려지면 멈춘다. 동작 줄이기에서는 마크가 맺힌 한 장면만 그린다.
 * 좌표는 캔버스 반폭을 1로 본 값이다.
 */
const CELL = 0.19, GAP = 0.033, OFF = (CELL + GAP) / 2;   // 마크 규격: 칸 .40, 간격 .07, 모서리 .15 (components/Logo.tsx 와 같은 비율)
const SEAT = [[-OFF, -OFF], [OFF, -OFF], [-OFF, OFF], [OFF, OFF]];
const DOT = 0.075;
// 점마다 주기가 다른 두 흐름을 겹쳐 같은 길을 되풀이하지 않는다
const FREE = [
  { ax: 0.52, ay: 0.40, bx: 0.22, by: 0.26, w1: 0.83, w2: 1.37, p1: 0.3, p2: 1.9 },
  { ax: 0.44, ay: 0.50, bx: 0.28, by: 0.18, w1: 0.71, w2: 1.53, p1: 2.4, p2: 0.7 },
  { ax: 0.50, ay: 0.36, bx: 0.20, by: 0.30, w1: 0.93, w2: 1.21, p1: 4.1, p2: 3.3 },
  { ax: 0.40, ay: 0.48, bx: 0.30, by: 0.22, w1: 0.77, w2: 1.45, p1: 5.2, p2: 5.0 },
];
const CYCLE = 7.5, IN = [2.4, 3.5], OUT = [5.3, 6.4];   // 초. 3.5~5.3 사이는 마크로 머문다
const STILL_AT = 4.4;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (x: number) => Math.min(1, Math.max(0, x));

export function MarkDrift() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    let W = 0, H = 0, dpr = 1, raf = 0, ink = "#1B1B19", onScreen = true;
    const t0 = performance.now();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    const size = () => {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ink = getComputedStyle(cv).color || ink;
    };
    const draw = (T: number) => {
      const u = (Math.min(W, H) / 2) * 0.96, cx = W / 2, cy = H / 2, t = T % CYCLE;
      const formed = clamp((t - IN[1] + 0.3) / 0.6) * (1 - clamp((t - OUT[0]) / 0.6));
      const breathe = 1 + 0.012 * Math.sin(T * 1.6) * formed;   // 맺힌 동안 아주 얕게 숨쉰다
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = ink;
      FREE.forEach((f, k) => {
        const d = k * 0.11;
        const m = t < OUT[0] ? ease(clamp((t - IN[0] - d) / (IN[1] - IN[0] - 0.33))) : 1 - ease(clamp((t - OUT[0] - d) / (OUT[1] - OUT[0] - 0.33)));
        const fx = f.ax * Math.sin(T * f.w1 + f.p1) + f.bx * Math.sin(T * f.w2 + f.p2);
        const fy = f.ay * Math.cos(T * f.w1 * 0.9 + f.p2) + f.by * Math.sin(T * f.w2 * 1.1 + f.p1);
        const sx = SEAT[k][0] * breathe, sy = SEAT[k][1] * breathe;
        const x = cx + (fx + (sx - fx) * m) * u, y = cy + (fy + (sy - fy) * m) * u;
        const s = (DOT + (CELL * breathe - DOT) * m) * u;
        const round = s * (0.5 - 0.35 * clamp((m - 0.55) / 0.45));   // 원에서 둥근 네모로
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(x - s / 2, y - s / 2, s, s, round);
        else ctx.arc(x, y, s / 2, 0, Math.PI * 2);
        ctx.fill();
      });
    };
    const loop = (now: number) => { draw((now - t0) / 1000); raf = requestAnimationFrame(loop); };
    const start = () => {
      cancelAnimationFrame(raf);
      size();
      if (still.matches) draw(STILL_AT);
      else if (onScreen && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const ro = new ResizeObserver(() => { size(); if (still.matches) draw(STILL_AT); });
    ro.observe(cv);
    const io = new IntersectionObserver((es) => { onScreen = es.some((e) => e.isIntersecting); start(); });
    io.observe(cv);
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    document.addEventListener("visibilitychange", start);
    still.addEventListener("change", start);
    dark.addEventListener("change", start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", start);
      still.removeEventListener("change", start);
      dark.removeEventListener("change", start);
    };
  }, []);
  return <canvas ref={ref} className="mdrift" />;
}
