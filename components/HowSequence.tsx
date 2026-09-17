"use client";

import { useEffect, useRef, useState } from "react";
import { HeroGraphic } from "@/components/HeroGraphic";

type Step = { no: number; t: string; p: string; tag: string };
type Phase = "wait" | "play" | "hold";

/** 그래픽 한 번 재생 길이(루프 3초) 중 비교표 장면에서 멈추는 시점 */
const HOLD_AT = 2820;
/** 단계가 차례로 나오는 간격 */
const STEP_GAP = 380;

/**
 * 진행 방식 — 그래픽이 끝까지 한 번 재생된 뒤(요청서 → CRO 4곳 → 비교표에서 정지) 1 → 2 → 3이 차례로 나타난다.
 * 화면에 보일 때 시작하고, 오프닝 인트로가 재생 중이면 인트로가 끝난 뒤 시작한다.
 */
export function HowSequence({ steps }: { steps: Step[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("wait");
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("hold");
      setShown(steps.length);
      return;
    }
    const timers: number[] = [];
    let started = false;
    /** 그래픽 안의 CSS 애니메이션 전부 (정확한 시점에 맞추기 위해 Web Animations API 로 직접 조작) */
    const anims = () => (el.querySelector(".dh")?.getAnimations({ subtree: true }) ?? []) as Animation[];
    const start = () => {
      if (started) return;
      started = true;
      setPhase("play");
      anims().forEach((a) => { a.currentTime = 0; a.play(); });
      timers.push(window.setTimeout(() => {
        setPhase("hold");
        anims().forEach((a) => { a.pause(); a.currentTime = HOLD_AT; }); // 비교표가 다 보이는 장면에서 정지
      }, HOLD_AT));
      steps.forEach((_, i) => timers.push(window.setTimeout(() => setShown(i + 1), HOLD_AT + 250 + i * STEP_GAP)));
    };
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const introPlaying = !!document.querySelector(".op:not([hidden])");
        if (introPlaying) addEventListener("dc:intro-end", start, { once: true });
        else start();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    addEventListener("dc:how-start", start); // 개발·검증용 수동 시작
    return () => {
      io.disconnect();
      removeEventListener("dc:intro-end", start);
      removeEventListener("dc:how-start", start);
      timers.forEach(clearTimeout);
    };
  }, [steps]);

  return (
    <div ref={ref} className="how__in">
      <HeroGraphic mode="seq" phase={phase} />
      <ol className="how__steps">
        {steps.map((s, i) => (
          <li key={s.no} className={`how__step${i < shown ? " in" : ""}`}>
            <span className="how__no">{s.no}</span>
            <div>
              <div className="how__t">
                <h3>{s.t}</h3>
                <span className="how__tag">{s.tag}</span>
              </div>
              <p className="how__p">{s.p}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
