"use client";

import { useState } from "react";
import { cardsFor, DISCLAIMER, repeatDoseFor, type ClinDuration, type DesignCard } from "@/lib/design-guide";
import type { Values } from "@/lib/rfq-schema";

const CAT = "일반독성";

/**
 * 요청서 상세 조건의 일반독성 영역에 붙는 설계 단서.
 * 고른 항목의 표준 설계 카드 + "표준 설계로 채우기", 임상 투여기간에서 역산한 필요 기간.
 */
export function DesignHints({ values, onFill }: { values: Values; onFill: (patch: Record<string, string | string[]>) => void }) {
  const items = Array.isArray(values[`${CAT}.items`]) ? (values[`${CAT}.items`] as string[]) : [];
  const cards = cardsFor(items);
  const clin = typeof values.clinDuration === "string" ? values.clinDuration : "";
  const advice = clin && clin !== "미정" ? repeatDoseFor(clin as ClinDuration, "임상시험 진입") : null;
  const [open, setOpen] = useState<string>("");
  const [filled, setFilled] = useState<string>("");

  if (!cards.length && !advice) return null;

  const fill = (c: DesignCard) => {
    const patch: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(c.fill)) patch[`${CAT}.${k}`] = v;
    onFill(patch);
    setFilled(c.title);
  };

  return (
    <div className="hints">
      <div className="hints__hd">
        <b>설계 단서</b>
        <span>{DISCLAIMER}</span>
      </div>
      {advice && (
        <p className="hints__m3">
          임상 예정 투여기간 <b>{clin}</b> 기준, 임상시험 진입에는 설치류 <b>{advice.rodent}</b> · 비설치류 <b>{advice.nonRodent}</b> 반복투여독성이 필요합니다 (ICH M3).
          {advice.items.some((i) => !items.includes(i)) && items.some((i) => i.startsWith("반복투여")) ? ` 요청서 항목으로는 ${advice.items.join(" · ")}입니다.` : ""}
        </p>
      )}
      {cards.map((c) => (
        <div key={c.title} className="hint">
          <div className="hint__row">
            <button type="button" className="hint__t" aria-expanded={open === c.title} onClick={() => setOpen(open === c.title ? "" : c.title)}>
              <b>{c.title}</b>
              <span>{c.purpose}</span>
            </button>
            <button type="button" className="b2 bsm" onClick={() => fill(c)}>{filled === c.title ? "채웠습니다" : "표준 설계로 채우기"}</button>
          </div>
          {open === c.title && (
            <dl className="hint__dl">
              {c.rows.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
              <p>근거 · {c.basis.join(" · ")}</p>
            </dl>
          )}
        </div>
      ))}
    </div>
  );
}
