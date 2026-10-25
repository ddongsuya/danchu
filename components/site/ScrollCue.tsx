"use client";
import { useEffect, useRef, useState } from "react";

/**
 * 첫 화면 아래의 "아래로 내려 보세요" 안내. 모든 공개 페이지에 같은 모양으로 붙는다.
 * 화면 아래에 고정되어 있다가 첫 화면(main의 첫 블록)의 끝이 화면 안으로 들어오면 사라진다.
 * 누르면 두 번째 블록의 맨 위로 내려간다 (두 번째 블록이 없으면 한 화면만큼).
 */
export function ScrollCue() {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const main = document.getElementById("main");
    const first = main?.firstElementChild as HTMLElement | null;
    if (!first) return;
    const update = () => {
      const r = first.getBoundingClientRect();
      // 첫 블록의 끝이 아직 화면 아래에 있으면 안내를 보인다
      setOn(r.bottom > innerHeight - 24 && r.top < innerHeight);
    };
    const io = new IntersectionObserver(update, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) });
    io.observe(first);
    update();
    addEventListener("resize", update);
    return () => { io.disconnect(); removeEventListener("resize", update); };
  }, []);
  const go = (e: React.MouseEvent) => {
    e.preventDefault();
    const main = document.getElementById("main");
    const second = main?.children[1] as HTMLElement | undefined;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (second) second.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    else scrollBy({ top: innerHeight * 0.9, behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <a ref={ref} className={on ? "cue" : "cue off"} href="#main" onClick={go} aria-hidden={!on} tabIndex={on ? 0 : -1}>
      <span>아래로 내려 보세요</span><i aria-hidden="true"></i>
    </a>
  );
}
