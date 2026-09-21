"use client";

import { useState } from "react";
import { CLIN_DURATIONS, repeatDoseFor, type ClinDuration, type Stage } from "@/lib/design-guide";

const STAGES: Stage[] = ["임상시험 진입", "품목허가 신청"];

/** 임상 예정 투여기간 → 필요한 반복투여독성 기간 (ICH M3(R2) 표 1·2) */
export function DurationCalc() {
  const [clin, setClin] = useState<ClinDuration>("1개월 이내");
  const [stage, setStage] = useState<Stage>("임상시험 진입");
  const r = repeatDoseFor(clin, stage);
  return (
    <div className="calc">
      <div className="calc__in">
        <div className="calc__fld">
          <span className="calc__lab">어느 단계를 준비하시나요</span>
          <div className="seg" role="radiogroup" aria-label="단계">
            {STAGES.map((s) => (
              <button key={s} type="button" aria-pressed={stage === s} onClick={() => setStage(s)}>{s}</button>
            ))}
          </div>
        </div>
        <div className="calc__fld">
          <span className="calc__lab">임상에서 얼마나 투여할 예정인가요</span>
          <div className="chips">
            {CLIN_DURATIONS.map((d) => (
              <button key={d} type="button" className="chip" aria-pressed={clin === d} onClick={() => setClin(d)}>{d}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="calc__out" role="status">
        <span className="calc__lab">필요한 반복투여독성 기간</span>
        <div className="calc__res">
          <div><b>{r.rodent}</b><span>설치류</span></div>
          <div><b>{r.nonRodent}</b><span>비설치류</span></div>
        </div>
        <p className="calc__note">단추 요청서에서는 <b>{r.items.join(" · ")}</b> 항목에 해당합니다.{r.note ? ` ${r.note}` : ""}</p>
      </div>
    </div>
  );
}
