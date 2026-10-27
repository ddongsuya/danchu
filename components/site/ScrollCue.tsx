"use client";
import { useEffect, useRef, useState } from "react";

/**
 * 첫 화면 아래의 "아래로 내려 보세요" 안내. 모든 공개 페이지에 같은 모양으로 붙는다.
 * 화면 아래에 고정되어 있다가 화면 높이의 30%쯤 내려가면 사라진다(문서 맨 위의 1px 표지를 IntersectionObserver로 본다).
 * 누르면 한 화면의 9할만큼 내려간다. 누를 수 있는 곳은 글자와 화살표뿐이다(화면 아래 가장자리를 눌러도 움직이지 않게).
 */
export function ScrollCue() {
  const [on, setOn] = useState(false);
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = mark.current;
    if (!el) return;
    const scrollable = () => document.documentElement.scrollHeight > innerHeight + 160;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting && scrollable()), { rootMargin: "30% 0px 0px 0px", threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const go = (e: React.MouseEvent) => {
    e.preventDefault();
    // 운영 기록(HeadWatch)이 "안내를 눌러 내려간 것"과 다른 원인을 구분하도록 표시
    (window as Window & { __cueTap?: number }).__cueTap = Math.round(performance.now());
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollBy({ top: Math.round(innerHeight * 0.9), behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <>
      <span ref={mark} aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, pointerEvents: "none" }} />
      {/* 띠(바탕 그라데이션)는 누를 수 없고, 글자와 화살표만 누를 수 있다. 띠 전체가 링크이던 때는
          화면 아래 가장자리(사파리 도구 막대 근처, 엄지가 닿는 자리)를 누르기만 해도 0.9화면 내려가 첫 제목이 사라졌다 (2026-10-27 운영 기록으로 확정) */}
      <div className={on ? "cue" : "cue off"} aria-hidden={!on}>
        <a href="#main" onClick={go} tabIndex={on ? 0 : -1}>
          <span>아래로 내려 보세요</span><i aria-hidden="true"></i>
        </a>
      </div>
    </>
  );
}
