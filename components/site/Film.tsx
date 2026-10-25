"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowCounterClockwise, Pause, Play } from "@phosphor-icons/react";
import { keyframes, type Track } from "./brand-film-motion";
import "./brand-film.css";
import "./flow-film.css";

/**
 * 소개 페이지의 짧은 필름 재생기. 무대는 SVG 한 장(children), 움직임은 tracks 의 키프레임(한 타임라인),
 * 재생·정지는 Web Animations API. 브랜드 필름(BrandFilm)의 무대·버튼 스타일(.bfilm*)을 그대로 쓴다.
 * - 화면에 절반 이상 보이면 한 번 재생하고 마지막 장면에서 멈춘다.
 * - 동작 줄이기면 마지막 장면만 보인다. 기본 스타일(키프레임이 없을 때)이 곧 마지막 장면이어야 한다.
 * - scope 는 필름마다 다른 클래스. 키프레임 이름과 선택자가 이 클래스로 묶여 한 페이지에 여러 필름을 둘 수 있다.
 */
export type Scene = [label: string, at: number, text: string];
type Phase = "ready" | "playing" | "paused" | "ended" | "still";

export function filmCss(scope: string, dur: number, tracks: Track[]): string {
  return tracks.map((tr) => `${keyframes(`${scope}-${tr.name}`, dur, tr.stops)}.${scope} ${tr.sel}{animation-name:${scope}-${tr.name}}`).join("");
}

/** 장면 문장(아래 한 줄)과 단계 레일의 켜짐. 모든 필름이 같은 규칙을 쓴다 */
export function sceneTracks(scenes: Scene[], dur: number, rail = true): Track[] {
  const out: Track[] = [];
  scenes.forEach(([, t], i) => {
    const end = scenes[i + 1]?.[1] ?? dur;
    const stops: Track["stops"] = [[0, "opacity:0"]];
    if (t > 0) stops.push([t - 0.01, "opacity:0"]);
    stops.push([t + 0.35, "opacity:1"]);
    if (end < dur) stops.push([end - 0.35, "opacity:1"], [end, "opacity:0"], [dur, "opacity:0"]);
    else stops.push([dur, "opacity:1"]);
    out.push({ name: `cue-${i}`, sel: `.flowf__cue--${i}`, stops });
    if (rail) out.push({ name: `step-${i}`, sel: `.ff-step--${i}`, stops: t > 0 ? [[0, "opacity:0.35"], [t - 0.01, "opacity:0.35"], [t + 0.3, "opacity:1"], [dur, "opacity:1"]] : [[0, "opacity:0.35"], [0.3, "opacity:1"], [dur, "opacity:1"]] });
  });
  return out;
}

export function Film({ scope, dur, scenes, tracks, title, children }: { scope: string; dur: number; scenes: Scene[]; tracks: Track[]; title: string; children: ReactNode }) {
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
    <figure ref={rootRef} className={`bfilm flowf ${scope}`} data-motion={still ? "still" : "on"} data-phase={phase} aria-labelledby={titleId} style={{ "--bfilm-dur": `${dur}s` } as CSSProperties}>
      <style>{filmCss(scope, dur, tracks)}</style>
      <figcaption id={titleId} className="sr-only">{title}</figcaption>
      <div className="bfilm__stage flowf__stage" aria-hidden="true">{children}</div>
      <div className="flowf__cues" aria-hidden="true">
        {scenes.map(([label, , text], i) => <p key={label + i} className={`flowf__cue flowf__cue--${i}`}><b>{label}</b>{text}</p>)}
      </div>
      <ol className="sr-only">{scenes.map(([label, , text], i) => <li key={label + i}>{label}: {text}</li>)}</ol>
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

/** 무대 안 공통 조각: 줄 몇 개가 그려진 서류 카드 */
export function Card({ x, y, w = 90, h = 110, className = "ff-card" }: { x: number; y: number; w?: number; h?: number; className?: string }) {
  const l = x - w / 2 + 16;
  const t = y - h / 2;
  const lines = [26, 48, 70].filter((d) => d < h - 14);
  return (
    <g className={className}>
      <rect x={x - w / 2} y={t} width={w} height={h} rx="8" />
      {lines.map((d, i) => <line key={d} x1={l} y1={t + d} x2={x + w / 2 - [16, 30, 22][i]} y2={t + d} />)}
    </g>
  );
}
