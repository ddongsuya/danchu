"use client";

import { GAP_REASONS, GAP_REASON_LABEL, gapLabel, gapOf, type GapReason } from "@/lib/contract-gap";
import { won } from "@/lib/format";

/**
 * 계약금액 입력 아래에 선정 견적과의 차이를 보여 준다. 10% 이상 다르면 사유를 고르게 한다 (0034).
 * 사유를 고르지 않으면 부모 폼이 저장을 막는다 (needsReason && !reason)
 */
export function GapReasonField({ id, quoteAmount, amount, reason, onReason, formal = false }: { id: string; quoteAmount: number | null; amount: string; reason: GapReason | ""; onReason: (r: GapReason | "") => void; formal?: boolean }) {
  const g = /^\d{1,13}$/.test(amount) && Number(amount) > 0 ? gapOf(quoteAmount, Number(amount)) : null;
  if (!quoteAmount) return null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <p className="fld__help tnum" style={{ margin: 0 }}>
        선정 견적 {won(quoteAmount)}
        {g ? ` · ${gapLabel(g, won)}` : ""}
      </p>
      {g?.needsReason && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="fld__lab" style={{ marginBottom: 6 }}>
            차이 사유<span className="req">*</span>
          </legend>
          <div className="chips" aria-describedby={`${id}-help`}>
            {GAP_REASONS.map((r) => (
              <button key={r} type="button" className="chip" aria-pressed={reason === r} onClick={() => onReason(reason === r ? "" : r)}>
                {GAP_REASON_LABEL[r]}
              </button>
            ))}
          </div>
          <span id={`${id}-help`} className="fld__help" style={{ display: "block", marginTop: 6 }}>
            {formal
              ? "선정 견적과 10% 이상 다르면 사유를 남깁니다. 의뢰자 확인 화면에 함께 표시됩니다. 기타는 비고에 내용을 적습니다."
              : "선정 견적과 10% 이상 다르면 사유를 남겨 주세요. 의뢰자 확인 화면에 함께 보여요. 기타를 고르면 비고에 내용을 적어 주세요."}
          </span>
        </fieldset>
      )}
    </div>
  );
}

/** 폼 저장 가능 여부: 차이가 10% 이상이면 사유, 기타면 비고까지 */
export function gapReady(quoteAmount: number | null, amount: string, reason: GapReason | "", note: string): boolean {
  if (!/^\d{1,13}$/.test(amount)) return false;
  const g = gapOf(quoteAmount, Number(amount));
  if (!g?.needsReason) return true;
  if (!reason) return false;
  return reason !== "other" || !!note.trim();
}
