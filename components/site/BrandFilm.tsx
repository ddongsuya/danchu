"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ArrowCounterClockwise, Pause, Play } from "@phosphor-icons/react";
import { BRAND_FILMS, cueLine, type FilmId, type FilmRatio } from "@/lib/brand-film";
import { filmCss } from "./brand-film-motion";
import "./brand-film.css";

/**
 * 브랜드 필름. 무대는 CSS 키프레임 하나의 타임라인(필름 길이와 같은 duration, linear 진행)이고,
 * 재생·일시정지·탐색은 Web Animations API로 그 타임라인을 통째로 움직인다.
 * 키프레임은 lib/brand-film.ts(문구·장면 시각)에서 brand-film-motion.ts 가 초 단위로 만든다.
 *
 * 무대 층 (아래에서 위로)
 *   1. .bfilm__bg   배경 층. 단색 바탕. C안은 실험실 장면 이미지·스크림·"AI 생성 이미지" 표시(BgLab).
 *   2. .bfilm__art  그림 층. B안: 점·실·마크·천(ArtMark), C안: 천·웰 위의 마크(ArtLab). 두 필름 모두 천과 채우기 단추(Fabric)를 쓴다.
 *   3. .bfilm__text 글자 층. lib 의 cues 로 만든다.
 *   4. .bfilm__end  엔드카드 층. 마크와 약속 문장. endcardAt 기준으로 등장(필름 공통).
 *
 * - seek(초)가 있으면 모든 무대 애니메이션을 멈추고 그 시각으로 맞춘다(캡처·스틸용). 맞춘 뒤 data-ready="1".
 *   무대 안 이미지(C안 배경)는 디코드가 끝난 뒤에 탐색·재생을 시작한다.
 * - 그 밖에는 화면에 50% 이상 보일 때 한 번 재생하고 엔드카드에서 멈춘다(반복 없음).
 * - 동작 줄이기 설정이면 무대 애니메이션을 끄고 엔드카드만 보인다. 재생 중에 설정이 켜져도 엔드카드로 바뀐다
 *   (사용자가 직접 재생을 누른 경우만 예외).
 */

export type BrandFilmProps = {
  film: FilmId;
  /** 지정하지 않으면 넓은 화면 16x9, 599px 이하 4x5 */
  ratio?: FilmRatio;
  /** 초. 주어지면 그 장면에 멈춘다 */
  seek?: number;
  /** 재생 제어 버튼. 기본: seek 가 없을 때만 */
  controls?: boolean;
  /** 부모 상자를 꽉 채운다(캡처용). 비율 대신 부모 크기를 쓴다 */
  fill?: boolean;
  /** C안 글자 처리. scrim: 아래쪽 스크림 위 밝은 글자(기본), ink: 스크림 없이 밝은 실험대 위 진한 글자(비교용) */
  variant?: "scrim" | "ink";
};

type Phase = "ready" | "playing" | "paused" | "ended" | "still";

function Mark({ className }: { className: string }) {
  return (
    <span className={className}>
      <i /><i /><i /><i />
    </span>
  );
}

/** 바느질 실: 늘어진 S자. 세로로 납작해지면(scaleY) 팽팽한 실이 된다. 선 굵기는 변형과 무관하게 유지 */
function Thread() {
  return (
    <svg className="bfilm-mk__thread" viewBox="0 0 1600 100" preserveAspectRatio="none" aria-hidden="true">
      <g>
        <path d="M0 50 C160 4 320 4 400 50 S640 96 800 50 S1120 4 1200 50 S1440 96 1600 50" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

/** 두 겹의 천(아래 천 = 바탕, 위 천 = 여밈선과 단춧구멍)과 채우기 단추. 두 필름 공통 */
function Fabric() {
  return (
    <div className="bfilm-fx">
      <Mark className="bfilm-mark bfilm-fx__under" />
      <div className="bfilm-fx__top"><i className="bfilm-fx__slit" /></div>
      <i className="bfilm-fx__shadow" />
    </div>
  );
}

/** B안 그림 층: 흩어진 점 → 실에 끌려 모여 네 구멍 단추 → 구멍 속 천 → 여밈선 → 단춧구멍에 채워짐 */
function ArtMark() {
  return (
    <div className="bfilm-mk">
      <Thread />
      <div className="bfilm-mk__box">
        <Mark className="bfilm-mark bfilm-mk__plate" />
        {(["a", "b", "c", "d"] as const).map((k) => (
          <span key={k} className={`bfilm-mk__dot bfilm-mk__dot--${k}`}><i /></span>
        ))}
      </div>
      <Fabric />
      <Mark className="bfilm-mark bfilm-fx__button" />
    </div>
  );
}

/** C안 배경 장면. AI 생성 이미지(public/brand-film/lab). 크기는 CSS가 무대 비율로 정하므로 레이아웃 이동 없음. */
const LAB_SHOTS = [
  { cls: "L1", src: "L1" },
  { cls: "L2", src: "L2" },
  { cls: "L3b", src: "L3" },
  { cls: "L3", src: "L3" },
] as const;

/** C안 배경 층: 장면(켄번스) → 흐린 플레이트 → 선명한 플레이트, 아래쪽 스크림, "AI 생성 이미지" 표시 */
function BgLab() {
  return (
    <div className="bfilm-lb">
      {LAB_SHOTS.map((s) => (
        <div key={s.cls} className={`bfilm-lb__shot bfilm-lb__shot--${s.cls}`}>
          {/* 무대 비율로 크기가 정해진 상자 안의 배경. 디코드 시점을 직접 기다리려고 일반 img 를 쓴다 */}
          <img src={`/brand-film/lab/${s.src}.webp`} alt="" width={3840} height={2160} decoding="async" draggable={false} />
        </div>
      ))}
      <i className="bfilm-lb__scrim" />
      <span className="bfilm-lb__credit">AI 생성 이미지</span>
    </div>
  );
}

/** C안 그림 층: 천(바탕 전환) 위에, L3 가운데 2x2 웰에 원 넷이 겹쳐 나타나고 뒤로 판이 떠올라 마크가 된다. 이어서 채우기. */
function ArtLab() {
  return (
    <div className="bfilm-lb__art">
      <Fabric />
      <div className="bfilm-lb__mark">
        <i className="bfilm-lb__plate" />
        {(["a", "b", "c", "d"] as const).map((k) => (
          <span key={k} className={`bfilm-lb__dot bfilm-lb__dot--${k}`}><i /></span>
        ))}
      </div>
      <Mark className="bfilm-mark bfilm-fx__button" />
    </div>
  );
}

export function BrandFilm({ film, ratio, seek, controls, fill = false, variant = "scrim" }: BrandFilmProps) {
  const spec = BRAND_FILMS[film];
  const titleId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const seeking = typeof seek === "number" && Number.isFinite(seek);
  const showControls = controls ?? !seeking;

  const [phase, setPhase] = useState<Phase>("ready");
  const [motion, setMotion] = useState<"auto" | "on" | "still">(seeking ? "on" : "auto");
  const [ready, setReady] = useState(false);
  // 무대 안 이미지가 디코드될 때까지 탐색·재생을 미룬다(B안은 이미지가 없어 바로 true)
  const [assets, setAssets] = useState(false);

  // 이벤트 핸들러에서 최신 값을 읽기 위한 거울
  const phaseRef = useRef<Phase>("ready");
  const userPausedRef = useRef(false);
  const [userPaused, setUserPaused] = useState(false);
  const setPaused = useCallback((v: boolean) => { userPausedRef.current = v; setUserPaused(v); }, []);
  const inViewRef = useRef(false);
  const startedRef = useRef(false);
  // 동작 줄이기 설정에서도 사용자가 직접 재생을 고른 경우
  const userChoseMotionRef = useRef(false);
  const go = useCallback((p: Phase) => { phaseRef.current = p; setPhase(p); }, []);

  // 무대(+진행 막대)의 CSS 키프레임만. 버튼의 hover·active 전환(CSSTransition)은 빼야 타임라인이 섞이지 않는다.
  const anims = useCallback(
    () => (rootRef.current?.getAnimations({ subtree: true }) ?? []).filter((a) => a instanceof CSSAnimation),
    [],
  );

  const play = useCallback(() => {
    const list = anims();
    if (!list.length) return;
    list.forEach((a) => a.play());
    startedRef.current = true;
    go("playing");
  }, [anims, go]);

  const hold = useCallback((next: Phase) => {
    anims().forEach((a) => a.pause());
    go(next);
  }, [anims, go]);

  useEffect(() => {
    let alive = true;
    const imgs = Array.from(rootRef.current?.querySelectorAll<HTMLImageElement>(".bfilm__stage img") ?? []);
    Promise.all(imgs.map((img) => img.decode().catch(() => undefined))).then(() => { if (alive) setAssets(true); });
    return () => { alive = false; };
  }, [film]);

  // 동작 줄이기 판단. seek 가 있으면 캡처이므로 늘 움직임을 켠다.
  useEffect(() => {
    if (seeking) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (mq.matches && !userChoseMotionRef.current) {
        // 재생 전이든 재생 중이든 엔드카드 정지 화면으로
        if (phaseRef.current !== "still") { setMotion("still"); go("still"); }
      } else if (!mq.matches && phaseRef.current === "still") { setMotion("on"); go("ready"); startedRef.current = false; }
      else if (!mq.matches) setMotion("on");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [seeking, go]);

  // 탐색: 모든 무대 애니메이션을 멈추고 같은 시각으로 맞춘다
  useEffect(() => {
    if (!seeking || !assets) return;
    const ms = Math.min(Math.max(seek!, 0), spec.durationSec) * 1000;
    anims().forEach((a) => { a.pause(); a.currentTime = ms; });
    setReady(true);
  }, [seeking, seek, spec.durationSec, anims, assets]);

  // 재생 제어: 50% 이상 보이고 탭이 보일 때만 재생. 사용자가 멈춘 경우는 그대로 둔다.
  useEffect(() => {
    if (seeking || motion !== "on" || !assets) return;
    const root = rootRef.current;
    if (!root) return;
    anims().forEach((a) => a.pause());
    if (phaseRef.current !== "ended") {
      if (!startedRef.current) anims().forEach((a) => { a.currentTime = 0; });
      go(userPausedRef.current ? "paused" : startedRef.current ? "paused" : "ready");
    }
    setReady(true);

    const resume = () => {
      if (userPausedRef.current || !inViewRef.current || document.hidden) return;
      if (phaseRef.current === "ready" || phaseRef.current === "paused") play();
    };
    const io = new IntersectionObserver(([e]) => {
      inViewRef.current = e.isIntersecting && e.intersectionRatio >= 0.5;
      if (inViewRef.current) resume();
      else if (phaseRef.current === "playing") hold("paused");
    }, { threshold: [0, 0.5, 1] });
    io.observe(root);
    const onVis = () => {
      if (document.hidden) { if (phaseRef.current === "playing") hold("paused"); }
      else resume();
    };
    document.addEventListener("visibilitychange", onVis);
    const onEnd = () => {
      if (phaseRef.current !== "playing") return;
      const list = anims();
      if (list.length && list.every((a) => a.playState === "finished")) go("ended");
    };
    root.addEventListener("animationend", onEnd);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      root.removeEventListener("animationend", onEnd);
      anims().forEach((a) => a.pause());
    };
  }, [seeking, motion, anims, play, hold, go, assets]);

  // 끝나면 일시정지 버튼이 쓸 수 없게 된다. 그 버튼에 있던 키보드 포커스는 '다시 보기'로 옮긴다.
  useEffect(() => {
    if (phase === "ended" && document.activeElement === pauseRef.current) replayRef.current?.focus();
  }, [phase]);

  const togglePause = () => {
    if (phaseRef.current === "ended") return;
    if (phaseRef.current === "playing") { setPaused(true); hold("paused"); return; }
    const next = !userPausedRef.current;
    setPaused(next);
    if (!next && inViewRef.current && !document.hidden) play();
  };

  const replay = () => {
    setPaused(false);
    startedRef.current = true;
    if (motion !== "on") {
      // 동작 줄이기 상태에서 사용자가 직접 고른 재생: 애니메이션이 다시 붙은 다음 프레임에 처음부터
      userChoseMotionRef.current = true;
      setMotion("on");
      requestAnimationFrame(() => { anims().forEach((a) => { a.currentTime = 0; }); play(); });
      return;
    }
    anims().forEach((a) => { a.currentTime = 0; });
    play();
  };

  const style = { "--bfilm-dur": `${spec.durationSec}s` } as CSSProperties;
  const ended = phase === "ended";

  return (
    <figure
      ref={rootRef}
      className="bfilm"
      data-film={film}
      data-ratio={ratio ?? "auto"}
      data-fill={fill ? "1" : undefined}
      data-motion={motion}
      data-phase={phase}
      data-variant={film === "lab" ? variant : undefined}
      data-ready={ready ? "1" : undefined}
      aria-labelledby={titleId}
      style={style}
    >
      <style>{filmCss(spec)}</style>
      <figcaption id={titleId} className="sr-only">브랜드 필름 「{spec.title}」</figcaption>
      <div className="bfilm__stage" aria-hidden="true">
        <div className="bfilm__layer bfilm__bg">{film === "lab" && <BgLab />}</div>
        <div className="bfilm__layer bfilm__art">{film === "mark" ? <ArtMark /> : <ArtLab />}</div>
        <div className="bfilm__layer bfilm__text">
          {spec.cues.map((c, i) => (
            <p key={i} className={`bfilm__cue bfilm-${film}-cue-${i}`}>{c.text}</p>
          ))}
        </div>
        <div className="bfilm__layer bfilm__end">
          <Mark className={`bfilm__end-mark bfilm-${film}-end-mark`} />
          <div className="bfilm__end-stack">
            <p className={`bfilm__end-lead bfilm-${film}-end-lead`}>{spec.endcard.lead}</p>
            <p className={`bfilm__end-promise bfilm-${film}-end-promise`}>{spec.endcard.promise}</p>
            <p className={`bfilm__end-line bfilm-${film}-end-line`}>{spec.endcard.line}</p>
            <p className={`bfilm__end-domain bfilm-${film}-end-domain`}>{spec.endcard.domain}</p>
          </div>
        </div>
      </div>
      <ol className="sr-only">
        {spec.cues.map((c, i) => <li key={i}>{cueLine(c.text)}</li>)}
        <li>{spec.endcard.lead} {spec.endcard.promise} {spec.endcard.line} {spec.endcard.domain}</li>
      </ol>
      {showControls && (
        <div className="bfilm__bar">
          <div className="bfilm__progress" aria-hidden="true"><i /></div>
          <div className="bfilm__buttons">
            {phase === "still" ? (
              <p className="bfilm__note">동작 줄이기 설정에 맞춰 마지막 장면만 보여 드립니다.</p>
            ) : (
              <button
                ref={pauseRef}
                type="button"
                className="bfilm__btn"
                aria-label="필름 일시정지"
                aria-pressed={userPaused}
                aria-disabled={ended || undefined}
                onClick={togglePause}
              >
                <Pause size={18} aria-hidden="true" />
                <span>일시정지</span>
              </button>
            )}
            <button
              ref={replayRef}
              type="button"
              className="bfilm__btn"
              aria-label={phase === "still" ? "필름 재생" : "필름 처음부터 다시 보기"}
              onClick={replay}
            >
              {phase === "still" ? <Play size={18} aria-hidden="true" /> : <ArrowCounterClockwise size={18} aria-hidden="true" />}
              <span>{phase === "still" ? "재생" : "다시 보기"}</span>
            </button>
          </div>
        </div>
      )}
      <noscript>
        <style>{".bfilm .bfilm__stage *,.bfilm .bfilm__progress i{animation:none!important}.bfilm__bar{display:none}"}</style>
      </noscript>
    </figure>
  );
}
