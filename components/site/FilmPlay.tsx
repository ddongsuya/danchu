"use client";

import { useEffect } from "react";

/**
 * 설명 영상(.fe 요소가 든 묶음)을 화면에 들어온 순간부터 처음부터 재생한다.
 * - 묶음은 인라인 --T(영상 길이)를 가진 요소. 페이지가 열리면 보이지 않는 묶음은 0초에 멈춰 둔다.
 * - 묶음의 그림 무대(.fst)가 절반 이상 보이면 재생을 시작하고, 묶음이 완전히 벗어나면 다시 0초로 되돌려
 *   다음에 들어올 때 또 처음부터 보이게 한다.
 * - 스크립트가 돌지 않는 환경에서는 아무 것도 건드리지 않으므로 영상은 지금처럼 바로 재생된다.
 */
export function FilmPlay() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const units = Array.from(document.querySelectorAll<HTMLElement>(".a main [style]")).filter((el) => el.style.getPropertyValue("--T"));
    if (!units.length) return;

    const filmAnims = (unit: HTMLElement) => {
      const list = typeof unit.getAnimations === "function" ? unit.getAnimations({ subtree: true }) : [];
      return list.filter((a) => {
        const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
        return !!t && t.classList.contains("fe");
      });
    };
    const rewind = (unit: HTMLElement) => {
      unit.classList.add("hold");
      for (const a of filmAnims(unit)) {
        try { a.currentTime = 0; } catch { /* 일부 브라우저는 읽기 전용 */ }
      }
    };
    const play = (unit: HTMLElement) => {
      if (!unit.classList.contains("hold")) return;
      for (const a of filmAnims(unit)) {
        try { a.currentTime = 0; } catch { /* 무시 */ }
      }
      unit.classList.remove("hold");
    };

    const stageOf = (unit: HTMLElement) => unit.querySelector<HTMLElement>(".fst") ?? unit;
    const byStage = new Map<Element, HTMLElement>();
    for (const u of units) {
      byStage.set(stageOf(u), u);
      rewind(u);
    }

    // 들어올 때: 무대가 절반 이상 보이면 시작 (무대가 화면보다 크면 보이는 만큼으로 판단)
    const enter = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const unit = byStage.get(e.target);
        if (!unit) continue;
        const vh = e.rootBounds?.height ?? window.innerHeight;
        const need = Math.min(0.5, (vh * 0.5) / Math.max(1, e.boundingClientRect.height));
        if (e.isIntersecting && e.intersectionRatio >= need - 0.001) play(unit);
      }
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    // 나갈 때: 묶음 전체가 화면에서 벗어나면 0초로
    const leave = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) rewind(e.target as HTMLElement);
      }
    }, { threshold: 0 });

    for (const u of units) { enter.observe(stageOf(u)); leave.observe(u); }
    return () => { enter.disconnect(); leave.disconnect(); for (const u of units) u.classList.remove("hold"); };
  }, []);
  return null;
}
