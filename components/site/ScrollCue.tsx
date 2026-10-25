"use client";
import { useEffect, useRef, useState } from "react";

/**
 * 첫 화면 아래의 "아래로 내려 보세요" 안내. 모든 공개 페이지에 같은 모양으로 붙는다.
 * 화면 아래에 고정되어 있다가 화면 높이의 30%쯤 내려가면 사라진다(문서 맨 위의 1px 표지를 IntersectionObserver로 본다).
 * 누르면 한 화면의 9할만큼 내려간다.
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
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollBy({ top: Math.round(innerHeight * 0.9), behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <>
      <span ref={mark} aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, pointerEvents: "none" }} />
      <a className={on ? "cue" : "cue off"} href="#main" onClick={go} aria-hidden={!on} tabIndex={on ? 0 : -1}>
        <span>아래로 내려 보세요</span><i aria-hidden="true"></i>
      </a>
    </>
  );
}
