"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Buildings, FileText, LockSimple, Pause, Play } from "@phosphor-icons/react";

/**
 * 서비스 소개의 움직이는 설명 그림. 페이지의 모션 순간은 이것 하나다.
 *
 * 요소가 장면마다 자리를 바꾼다(transform 만 움직인다).
 * - 요청서 카드는 끝까지 같은 자리에 있다가 비교표의 행 이름이 된다
 * - 기관 노드는 오른쪽에 모였다가 비교표의 열 머리로 올라간다
 * - 회신 카드는 한 더미로 도착했다가 열로 펼쳐진다
 *
 * 자동 재생은 화면에 보일 때만, 장면 버튼을 누르면 멈춘다. 동작 줄이기 설정에서는 자동 재생하지 않고 이동 없이 바뀐다.
 */

const ITEMS = ["반복투여 4주", "복귀돌연변이", "체내 소핵"] as const;

/* 기관명과 금액은 예시. 이용 안내 페이지의 비교표 예시와 같은 값 */
const REPLIES: { org: string; cells: [string, string][]; total: [string, string] }[] = [
  { org: "기관 A", cells: [["9,800만", "14주"], ["1,100만", "6주"], ["2,600만", "8주"]], total: ["1억 3,500만", "14주"] },
  { org: "기관 B", cells: [["9,200만", "12주"], ["1,050만", "5주"], ["2,400만", "8주"]], total: ["1억 2,650만", "12주"] },
  { org: "기관 C", cells: [["1억 600만", "16주"], ["1,250만", "6주"], ["불가", "설비 없음"]], total: ["1억 1,850만", "16주"] },
];

const STEPS: { title: string; body: string }[] = [
  { title: "요청서 한 번", body: "시험 항목과 조건을 한 번만 적습니다. 어떤 시험이 필요한지 모르면 제안을 받아 채웁니다." },
  { title: "맞는 기관에 전달", body: "수행 분야가 맞는 기관에 같은 요청서가 갑니다. 회사명과 연락처는 가려집니다." },
  { title: "같은 양식으로 회신", body: "기관은 요청서의 항목 그대로 금액과 기간을 채우고, 정식 견적서 PDF를 붙입니다." },
  { title: "항목별로 나란히", body: "회신 기한이 지나면 한 표로 정리됩니다. 정렬 기준은 의뢰자가 고르고, 단추는 기관을 권하지 않습니다." },
  { title: "고른 기관에만 공개", body: "선택한 기관에만 회사명과 연락처가 전달되고, 계약은 기관과 직접 합니다." },
];

const HOLD = 3200;
const HOLD_LAST = 4800;

export function ServiceMotion() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [manual, setManual] = useState(false);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const visible = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // 화면에 들어오면 재생, 벗어나면 멈춤 (손으로 고른 뒤에는 다시 켜지 않는다)
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        visible.current = e.isIntersecting;
        if (manual || reduced) return;
        setPlaying(e.isIntersecting);
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [manual, reduced]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setStep((s) => (s + 1) % STEPS.length), step === STEPS.length - 1 ? HOLD_LAST : HOLD);
    return () => window.clearTimeout(t);
  }, [playing, step]);

  const pick = useCallback((i: number) => {
    setManual(true);
    setPlaying(false);
    setStep(i);
  }, []);

  const toggle = () => {
    if (playing) {
      setManual(true);
      setPlaying(false);
    } else {
      setManual(false);
      if (step === STEPS.length - 1) setStep(0);
      setPlaying(true);
    }
  };

  return (
    <div className="mo" ref={root} data-step={step + 1} data-playing={playing ? "1" : "0"}>
      <div className="mo__stage" aria-hidden="true">
        <div className="mo__req">
          <div className="mo__hd">
            <FileText size={16} weight="bold" />
            <span className="mo__swap"><span className="mo__swap-a">요청서</span><span className="mo__swap-b">항목</span></span>
          </div>
          {ITEMS.map((it, i) => (
            <div key={it} className="mo__row" style={{ ["--i" as string]: i }}>{it}</div>
          ))}
          <div className="mo__row mo__row--total">총액 · 기간</div>
        </div>

        {REPLIES.map((r, i) => (
          <div key={r.org} className={`mo__org mo__org--${i}`} style={{ ["--i" as string]: i }}>
            <Buildings size={16} weight="bold" />
            <span>{r.org}</span>
          </div>
        ))}

        {REPLIES.map((r, i) => (
          <div key={`env-${r.org}`} className={`mo__env mo__env--${i}`} style={{ ["--i" as string]: i }}>
            <FileText size={14} weight="bold" />
            <span className="mo__env-t">요청서</span>
            <LockSimple size={13} weight="bold" className="mo__lock" />
          </div>
        ))}

        {REPLIES.map((r, i) => (
          <div key={`rep-${r.org}`} className={`mo__rep mo__rep--${i}`} style={{ ["--i" as string]: i }}>
            <div className="mo__hd mo__hd--rep">
              {i === 0 ? <span className="mo__swap"><span className="mo__pick-a">회신</span><span className="mo__pick-b">연락처 공개</span></span> : "회신"}
            </div>
            {r.cells.map(([a, b], k) => (
              <div key={k} className={`mo__cell${a === "불가" ? " mo__cell--no" : ""}`}><b>{a}</b><small>{b}</small></div>
            ))}
            <div className="mo__cell mo__cell--total"><b>{r.total[0]}</b><small>{r.total[1]}</small></div>
          </div>
        ))}
      </div>

      <div className="mo__bar">
        <ol className="mo__steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button type="button" className="mo__step" aria-current={i === step ? "step" : undefined} onClick={() => pick(i)}>
                <span className="mo__prog"><span style={{ animationDuration: `${i === STEPS.length - 1 ? HOLD_LAST : HOLD}ms` }} key={`${i}-${step}-${playing}`} /></span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
        {!reduced && (
          <button type="button" className="mo__play" onClick={toggle} aria-label={playing ? "자동 재생 멈춤" : "자동 재생"}>
            {playing ? <Pause size={16} weight="bold" /> : <Play size={16} weight="bold" />}
          </button>
        )}
      </div>
      <p className="mo__cap"><b className="mo__cap-t">{STEPS[step].title}. </b>{STEPS[step].body}</p>
      <p className="mo__note">기관명과 금액은 예시입니다. 정본은 각 기관이 첨부한 PDF 견적서입니다.</p>

      {/* 화면 읽기 프로그램용: 그림 대신 단계 설명 전체 */}
      <ol className="sr-only">
        {STEPS.map((s) => <li key={s.title}>{s.title}. {s.body}</li>)}
      </ol>
    </div>
  );
}
