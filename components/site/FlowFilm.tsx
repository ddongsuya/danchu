"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ArrowCounterClockwise, Pause, Play } from "@phosphor-icons/react";
import { FLOW_DUR, SCENES, flowCss } from "./flow-film-motion";
import "./brand-film.css";
import "./flow-film.css";

/**
 * 흐름 필름: 요청서 한 건이 접수부터 계약 완료까지 흐르는 7장면.
 * 무대는 SVG 한 장, 움직임은 flow-film-motion.ts 의 키프레임(한 타임라인), 재생·정지는 Web Animations API.
 * 브랜드 필름(BrandFilm)의 무대·버튼 스타일(.bfilm*)을 그대로 쓴다. 동작 줄이기면 마지막 장면만 보인다.
 */
type Phase = "ready" | "playing" | "paused" | "ended" | "still";

function Card({ x, y, w = 90, h = 110 }: { x: number; y: number; w?: number; h?: number }) {
  const l = x - w / 2 + 16;
  const t = y - h / 2;
  return (
    <g className="ff-card">
      <rect x={x - w / 2} y={t} width={w} height={h} rx="8" />
      <line x1={l} y1={t + 26} x2={x + w / 2 - 16} y2={t + 26} />
      <line x1={l} y1={t + 48} x2={x + w / 2 - 30} y2={t + 48} />
      <line x1={l} y1={t + 70} x2={x + w / 2 - 22} y2={t + 70} />
    </g>
  );
}

const ORGS = [["a", 300, "기관 A", "참여"], ["b", 600, "기관 B", "불참"], ["c", 900, "기관 C", "참여"]] as const;

function Stage() {
  return (
    <svg viewBox="0 0 1200 900" aria-hidden="true">
      <line className="ff-rail" x1="60" y1="104" x2="1140" y2="104" />
      {SCENES.map(([label], i) => (
        <text key={label} className={`ff-step ff-step--${i}`} x={70 + i * 160} y="80"><tspan>{String(i + 1).padStart(2, "0")}</tspan> {label}</text>
      ))}
      <text className="ff-lane" x="60" y="238">의뢰자</text>
      <text className="ff-lane" x="60" y="478">단추</text>
      <text className="ff-lane" x="60" y="728">기관</text>
      <rect className="ff-box" x="340" y="180" width="240" height="100" rx="12" />
      <text className="ff-label" x="460" y="238" textAnchor="middle">의뢰자</text>
      <g className="ff-hub">
        <rect className="ff-box ff-box--hub" x="340" y="420" width="240" height="100" rx="12" />
        <text className="ff-label" x="460" y="470" textAnchor="middle">단추</text>
        <text className="ff-sub" x="460" y="498" textAnchor="middle">같은 양식으로 모읍니다</text>
      </g>
      {ORGS.map(([k, x, name, st]) => (
        <g key={k}>
          <rect className="ff-box ff-box--org" x={x - 120} y="670" width="240" height="100" rx="12" />
          <text className="ff-label" x={x} y="716" textAnchor="middle">{name}</text>
          <g className={`ff-badge ff-badge--${k}`}><text x={x} y="748" textAnchor="middle">{st}</text></g>
        </g>
      ))}
      <line className="ff-wall" x1="450" y1="650" x2="450" y2="790" />
      <line className="ff-wall" x1="750" y1="650" x2="750" y2="790" />
      <g className="ff-req"><Card x={760} y={230} /></g>
      {(["a", "b", "c"] as const).map((k) => (
        <g key={k} className={`ff-note ff-note--${k}`}><rect x="725" y="445" width="70" height="50" rx="6" /></g>
      ))}
      {(["a", "c"] as const).map((k, i) => (
        <g key={k} className={`ff-reply ff-reply--${k}`}><Card x={i === 0 ? 300 : 900} y={720} w={80} h={96} /></g>
      ))}
      <g className="ff-table">
        <rect className="bg" x="600" y="160" width="320" height="140" rx="10" />
        <rect className="ff-pick" x="736" y="166" width="92" height="128" rx="6" />
        <line x1="600" y1="202" x2="920" y2="202" />
        <line x1="600" y1="250" x2="920" y2="250" />
        <text className="hd" x="616" y="190">항목</text>
        <text className="hd" x="782" y="190" textAnchor="middle">기관 A</text>
        <text className="hd" x="872" y="190" textAnchor="middle">기관 C</text>
        <text x="616" y="234">반복투여 4주</text>
        <text x="782" y="234" textAnchor="middle">9,800만</text>
        <text x="872" y="234" textAnchor="middle">1억 600만</text>
        <text x="616" y="282">복귀돌연변이</text>
        <text x="782" y="282" textAnchor="middle">1,100만</text>
        <text x="872" y="282" textAnchor="middle">1,250만</text>
      </g>
      <g className="ff-link">
        <line x1="360" y1="280" x2="320" y2="668" />
        <circle cx="360" cy="280" r="7" />
        <circle cx="320" cy="668" r="7" />
      </g>
      <g className="ff-direct"><text x="320" y="470" textAnchor="end">직접 계약</text></g>
      <g className="ff-done">
        <circle cx="568" cy="178" r="22" />
        <path d="M557 178 l8 8 l14 -16" />
      </g>
    </svg>
  );
}

export function FlowFilm() {
  const titleId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [still, setStill] = useState(false);
  const phaseRef = useRef<Phase>("ready");
  const pausedByUser = useRef(false);
  const inView = useRef(false);
  const go = useCallback((p: Phase) => { phaseRef.current = p; setPhase(p); }, []);
  const anims = useCallback(() => (rootRef.current?.getAnimations({ subtree: true }) ?? []).filter((a) => a instanceof CSSAnimation), []);
  const play = useCallback(() => { anims().forEach((a) => a.play()); go("playing"); }, [anims, go]);
  const hold = useCallback((p: Phase) => { anims().forEach((a) => a.pause()); go(p); }, [anims, go]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => { setStill(mq.matches); if (mq.matches) go("still"); else if (phaseRef.current === "still") go("ready"); };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [go]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || still) return;
    anims().forEach((a) => { a.pause(); a.currentTime = 0; });
    const resume = () => { if (!pausedByUser.current && inView.current && !document.hidden && phaseRef.current !== "ended") play(); };
    const io = new IntersectionObserver(([e]) => {
      inView.current = e.isIntersecting && e.intersectionRatio >= 0.5;
      if (inView.current) resume(); else if (phaseRef.current === "playing") hold("paused");
    }, { threshold: [0, 0.5, 1] });
    io.observe(root);
    const onVis = () => { if (document.hidden) { if (phaseRef.current === "playing") hold("paused"); } else resume(); };
    document.addEventListener("visibilitychange", onVis);
    const onEnd = () => { if (phaseRef.current === "playing" && anims().every((a) => a.playState === "finished")) go("ended"); };
    root.addEventListener("animationend", onEnd);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); root.removeEventListener("animationend", onEnd); anims().forEach((a) => a.pause()); };
  }, [still, anims, play, hold, go]);

  const toggle = () => {
    if (phaseRef.current === "ended") return;
    if (phaseRef.current === "playing") { pausedByUser.current = true; hold("paused"); return; }
    pausedByUser.current = false;
    play();
  };
  const replay = () => {
    pausedByUser.current = false;
    if (still) { setStill(false); go("ready"); requestAnimationFrame(() => { anims().forEach((a) => { a.currentTime = 0; }); play(); }); return; }
    anims().forEach((a) => { a.currentTime = 0; });
    play();
  };
  const ended = phase === "ended";

  return (
    <figure ref={rootRef} className="bfilm flowf" data-motion={still ? "still" : "on"} data-phase={phase} aria-labelledby={titleId} style={{ "--bfilm-dur": `${FLOW_DUR}s` } as CSSProperties}>
      <style>{flowCss()}</style>
      <figcaption id={titleId} className="sr-only">요청 한 건이 접수부터 계약 완료까지 흐르는 과정</figcaption>
      <div className="bfilm__stage flowf__stage" aria-hidden="true"><Stage /></div>
      <div className="flowf__cues" aria-hidden="true">
        {SCENES.map(([label, , text], i) => <p key={label} className={`flowf__cue flowf__cue--${i}`}><b>{label}</b>{text}</p>)}
      </div>
      <ol className="sr-only">{SCENES.map(([label, , text]) => <li key={label}>{label}: {text}</li>)}</ol>
      <div className="bfilm__bar">
        <div className="bfilm__progress" aria-hidden="true"><i /></div>
        <div className="bfilm__buttons">
          {phase === "still" ? (
            <p className="bfilm__note">동작 줄이기 설정에 맞춰 마지막 장면만 보여 드립니다.</p>
          ) : (
            <button type="button" className="bfilm__btn" aria-label={phase === "playing" ? "일시정지" : "재생"} aria-disabled={ended || undefined} onClick={toggle}>
              {phase === "playing" ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
              {phase === "playing" ? "일시정지" : "재생"}
            </button>
          )}
          <button type="button" className="bfilm__btn" aria-label="처음부터 다시 보기" onClick={replay}><ArrowCounterClockwise size={18} aria-hidden="true" />다시 보기</button>
        </div>
      </div>
    </figure>
  );
}
