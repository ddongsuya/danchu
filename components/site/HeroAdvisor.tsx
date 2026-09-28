"use client";

import { useMemo, useState } from "react";
import { advise, type Answers } from "@/lib/advisor";
import { RfqLink } from "@/components/RfqLink";

/**
 * 첫 화면의 제안 미리보기. 요청서 위자드가 쓰는 lib/advisor.ts를 그대로 돌린다.
 * 12문항 중 결과를 크게 가르는 4개만 묻고 나머지는 보수적인 기본값으로 둔다.
 */
const STAGES = ["1상 진입", "2상", "3상", "품목허가"] as const;
const ROUTES = ["경구", "정맥", "피하", "근육", "국소 적용(피부·점안 등)", "흡입"] as const;
const DURATIONS = ["단회", "2주 이내", "1개월 이내", "3개월 이내", "6개월 이내", "6개월 초과·만성"] as const;
const WOCBP = ["예", "아니오", "미정"] as const;

const SHOW = 7;

export function HeroAdvisor() {
  const [stage, setStage] = useState<string>("1상 진입");
  const [route, setRoute] = useState<string>("경구");
  const [duration, setDuration] = useState<string>("1개월 이내");
  const [wocbp, setWocbp] = useState<string>("예");

  const advice = useMemo(() => {
    const a: Answers = {
      product: "합성의약품", stage, auth: ["식약처"], indication: "그 외", cns: "모름",
      route, duration, freq: "1일 1회", wocbp, ped: "아니오", prior: ["없음"],
    };
    if (wocbp === "예") { a.wScale = "미정"; a.contra = "미정"; }
    return advise(a);
  }, [stage, route, duration, wocbp]);

  const on = advice.tests.filter((t) => t.on);
  const off = advice.tests.filter((t) => !t.on);
  const head = on.slice(0, SHOW);
  const rest = on.slice(SHOW);
  // 답이 바뀔 때마다 목록이 다시 나타나도록 키를 바꾼다
  const key = `${stage}|${route}|${duration}|${wocbp}`;

  const Sel = ({ id, label, value, opts, set }: { id: string; label: string; value: string; opts: readonly string[]; set: (v: string) => void }) => (
    <div className="adv__f">
      <label htmlFor={id}>{label}</label>
      <div className="adv__sel">
        <select id={id} value={value} onChange={(e) => set(e.target.value)}>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <aside className="adv" aria-label="필요한 시험 미리보기">
      <div className="adv__hd">
        <b>상황을 고르면 필요한 시험이 바뀝니다</b>
        <span>합성의약품 · 식약처 제출 기준</span>
      </div>
      <div className="adv__q">
        <Sel id="hs" label="준비하는 단계" value={stage} opts={STAGES} set={setStage} />
        <Sel id="hr" label="임상 투여경로" value={route} opts={ROUTES} set={setRoute} />
        <Sel id="hd" label="임상 투여기간" value={duration} opts={DURATIONS} set={setDuration} />
        <Sel id="hw" label="임상에 가임 여성 포함" value={wocbp} opts={WOCBP} set={setWocbp} />
      </div>
      <div className="adv__out">
        <div className="adv__sum">
          <b>필요한 시험 {on.length}건</b>
          <span>선택 {off.length}건 · 기관에 물을 것 {advice.askCro.length}건</span>
        </div>
        <ol className="adv__list" key={key}>
          {head.map((t, i) => (
            <li key={t.key} className="adv__row" style={{ "--i": i } as React.CSSProperties}>
              <b>{t.label}</b>
              <span className="cite">{t.basis}</span>
            </li>
          ))}
        </ol>
        {(rest.length > 0 || off.length > 0) && (
          <details className="adv__more">
            <summary><span>나머지 {rest.length + off.length}건과 근거</span><span aria-hidden="true">+</span></summary>
            <ul>
              {rest.map((t) => <li key={t.key}>{t.label} <span className="cite">{t.basis}</span></li>)}
              {off.map((t) => <li key={t.key}><span className="muted">선택 · </span>{t.label} <span className="cite">{t.basis}</span></li>)}
            </ul>
          </details>
        )}
        {advice.askCro.length > 0 && (
          <details className="adv__more">
            <summary><span>가이드라인이 정하지 않아 기관에 물을 것 {advice.askCro.length}건</span><span aria-hidden="true">+</span></summary>
            <ul>{advice.askCro.map((q) => <li key={q}>{q}</li>)}</ul>
          </details>
        )}
      </div>
      <div className="adv__ft">
        <span>공개 가이드라인에 근거한 참고용 제안입니다. 요청서에서는 12문항을 답하고 항목을 빼거나 더할 수 있습니다.</span>
        <RfqLink className="b b--line b--sm">요청서에서 이어서</RfqLink>
      </div>
    </aside>
  );
}
