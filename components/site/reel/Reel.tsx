"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { endCard, type Build, type Dims, type Tl } from "./kit";
import "./reel.css";

/**
 * 메뉴 페이지 영상 재생기.
 * - 고정 크기 캔버스를 화면 폭과 높이(한 화면 안)에 맞게 줄인다. 폭 860px 이하는 세로형 캔버스로 다시 그린다.
 * - 화면에 35% 이상 들어오면 처음부터 재생하고, 완전히 벗어나면 처음으로 돌린다.
 * - 동작 줄이기여도 재생한다. 영상이 곧 내용이라 멈추면 아무것도 전하지 못한다(사용자 원칙).
 * - 모든 영상의 끝에는 로고 엔드카드(kit.endCard)가 붙는다.
 * - chapters 가 있으면 타임라인 라벨 ch0, ch1 … 로 옮겨 가는 단계 버튼을 단다.
 */
export function Reel({ build, dims, label, chapters, hint, loop = false, reserve = 0, className = "" }: {
  build: Build; dims: Dims; label: string; chapters?: string[]; hint?: string; loop?: boolean; reserve?: number | [number, number]; className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const tlRef = useRef<Tl | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current!, stage = stageRef.current!, cv = cvRef.current!;
    let mode: boolean | null = null, visible = false, raf = 0, lastVW = 0, lastVH = 0;

    const onUpdate = () => {
      const tl = tlRef.current; if (!tl) return;
      if (barRef.current) barRef.current.style.transform = `scaleX(${tl.progress()})`;
      if (chapters) {
        const t = tl.time(); let k = 0;
        chapters.forEach((_, i) => { const at = tl.labels[`ch${i}`]; if (at != null && t >= at - 0.01) k = i; });
        setActive((p) => (p === k ? p : k));
      }
    };

    // 한 화면 안에 들어가도록, 영상 말고 섹션 안의 나머지(제목·버튼·여백)가 차지하는 높이를 잰다
    const around = (stageH: number) => {
      const rs = Array.isArray(reserve) ? reserve[mode ? 1 : 0] : reserve;
      const sec = wrap.closest("section");
      if (!sec) return rs;
      const cs = getComputedStyle(sec);
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const own = [...sec.children].find((c) => c.contains(wrap)) as HTMLElement | undefined;
      const ownExtra = (own?.offsetHeight ?? wrap.offsetHeight) - stageH;
      const cols = cs.gridTemplateColumns.split(" ").filter(Boolean).length;
      if (cols > 1) return pad + ownExtra + 8;
      const others = [...sec.children].filter((c) => c !== own) as HTMLElement[];
      const gap = parseFloat(cs.rowGap) || 0;
      return pad + ownExtra + others.reduce((h, c) => h + c.offsetHeight, 0) + gap * others.length + 8;
    };

    const layout = () => {
      const P = window.innerWidth <= 860;
      if (P !== mode) {
        tlRef.current?.kill();
        cv.innerHTML = "";
        mode = P;
        const [W, H] = P ? dims.P : dims.L;
        cv.style.width = `${W}px`; cv.style.height = `${H}px`;
        const tl = build(cv, P);
        // 모든 영상은 로고 엔드카드로 끝난다 (영상이 직접 자기 자리에서 펼쳐지는 엔드카드를 넣었으면 그대로 둔다)
        if (!tl.data?.end) endCard(tl, cv, W, H);
        if (loop) tl.repeat(-1).repeatDelay(1.2);
        tl.eventCallback("onUpdate", onUpdate);
        tlRef.current = tl;
        if (visible) tl.restart(); else tl.pause(0);
      }
      const [W, H] = mode ? dims.P : dims.L;
      // 휴대폰 주소창이 접히고 펴질 때마다 크기가 흔들리지 않게, 높이는 폭이 바뀔 때만 다시 잰다
      if (window.innerWidth !== lastVW || !lastVH) { lastVW = window.innerWidth; lastVH = window.innerHeight; }
      const vh = lastVH;
      const nav = mode ? 60 : 68;
      const maxH = Math.max(240, vh - nav - around(stage.offsetHeight));
      const k = Math.min(wrap.clientWidth / W, maxH / H);
      stage.style.width = `${W * k}px`; stage.style.height = `${H * k}px`;
      cv.style.transform = `scale(${k})`;
    };

    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); });
    ro.observe(wrap);
    window.addEventListener("resize", layout);
    layout();
    layout();
    // 글꼴이 늦게 오면 글자 폭을 재서 놓은 영상(카드 위치 등)을 한 번 다시 그린다
    let alive = true;
    document.fonts?.ready.then(() => { if (alive && document.fonts.status === "loaded") { mode = null; layout(); } });

    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const tl = tlRef.current; if (!tl) return;
      if (e.intersectionRatio >= 0.35 && !visible) { visible = true; tl.restart(); }
      else if (e.intersectionRatio === 0 && visible) { visible = false; tl.pause(0); }
    }), { threshold: [0, 0.35] });
    io.observe(stage);

    return () => { alive = false; io.disconnect(); ro.disconnect(); window.removeEventListener("resize", layout); cancelAnimationFrame(raf); tlRef.current?.kill(); tlRef.current = null; };
  }, [build, dims, loop, reserve, chapters]); // reserve 배열은 모듈 상수로 넘긴다

  const go = (i: number) => { const tl = tlRef.current; if (!tl) return; tl.play(`ch${i}`); setActive(i); };

  return (
    <div className={`rl ${className}`.trim()} ref={wrapRef}>
      <div className="rl-stage" ref={stageRef} role="img" aria-label={label}>
        <div className="rl-cv" ref={cvRef} aria-hidden="true" />
      </div>
      <div className="rl-ctl">
        <button type="button" className="rl-re" onClick={() => tlRef.current?.restart()} aria-label="처음부터 다시 보기">
          <ArrowCounterClockwise size={16} weight="bold" aria-hidden="true" />
        </button>
        <span className="rl-prog" aria-hidden="true"><i ref={barRef} /></span>
      </div>
      {chapters && (
        <div className="rl-chs" role="group" aria-label="장면으로 이동">
          {chapters.map((c, i) => (
            <button key={c} type="button" className="rl-chb" aria-pressed={active === i} onClick={() => go(i)}>{c}</button>
          ))}
          {hint && <p className="rl-hint">{hint}</p>}
        </div>
      )}
    </div>
  );
}
