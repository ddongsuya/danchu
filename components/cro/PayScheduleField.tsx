"use client";

import { useState } from "react";
import { X } from "@phosphor-icons/react";
import { DEFAULT_PAY, PAY_MAX_ROWS, PAY_WHEN, formatPay, parsePay, payError, type PayRow } from "@/lib/pay-schedule";

/**
 * 지급 조건 줄 편집 (2026-11-26 시안 v7). 단계 이름 · 비율(%) · 지급 시점을 줄로 더하고 뺀다.
 * 값은 저장 글(lib/pay-schedule formatPay) 하나로 부모에 올린다. 쓰는 중인 줄(이름이 빈 줄 등)은 이 안에서만 들고 있는다.
 */
export function PayScheduleField({ value, disabled, onChange }: { value: string; disabled: boolean; onChange?: (v: string, err: string | null) => void }) {
  const [rows, setRows] = useState<PayRow[]>(() => parsePay(value));
  // 예전에 자유 글로 적은 결제 조건은 줄로 못 읽는다. 지우지 않고 보여 준다
  const legacyText = value.trim() && !rows.length ? value.trim() : "";
  const err = payError(rows);
  const sum = rows.reduce((a, r) => a + (Number.isFinite(r.pct) ? r.pct : 0), 0);

  const set = (next: PayRow[]) => {
    setRows(next);
    // 쓰는 중인 줄(이름 빈 줄 등)은 저장 글로 다시 읽히지 않으므로 오류를 함께 올려 제출을 막는다
    onChange?.(next.length ? formatPay(next) : "", payError(next));
  };
  const upd = (i: number, patch: Partial<PayRow>) => set(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="fld paysch">
      <span className="fld__lab" id="pay-lab">지급 조건</span>
      {legacyText && <p className="paysch__legacy">예전 입력: {legacyText}. 아래에서 줄로 다시 적어 주세요.</p>}
      {rows.length > 0 && (
        <div className="paysch__rows" role="group" aria-labelledby="pay-lab">
          <div className="paysch__head" aria-hidden="true"><span>단계</span><span>비율</span><span>지급 시점</span><span /></div>
          {rows.map((r, i) => (
            <div className="paysch__row" key={i}>
              <input className="inp" aria-label={`${i + 1}번째 단계 이름`} maxLength={20} disabled={disabled} value={r.label} onChange={(e) => upd(i, { label: e.target.value })} />
              <span className="paysch__pct">
                <input className="inp tnum" aria-label={`${i + 1}번째 비율`} inputMode="numeric" disabled={disabled} value={Number.isFinite(r.pct) && r.pct ? String(r.pct) : ""} onChange={(e) => upd(i, { pct: Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || 0 })} />
                <span aria-hidden="true">%</span>
              </span>
              <select className="sel" aria-label={`${i + 1}번째 지급 시점`} disabled={disabled} value={r.when} onChange={(e) => upd(i, { when: e.target.value })}>
                {!PAY_WHEN.includes(r.when as (typeof PAY_WHEN)[number]) && <option value={r.when}>{r.when || "고르기"}</option>}
                {PAY_WHEN.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <button type="button" className="paysch__x" aria-label={`${i + 1}번째 줄 빼기`} disabled={disabled} onClick={() => set(rows.filter((_, j) => j !== i))}><X size={14} aria-hidden="true" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="paysch__foot">
        {rows.length < PAY_MAX_ROWS && (
          <button type="button" className="btxt" disabled={disabled} onClick={() => set(rows.length ? [...rows, { label: "", pct: 0, when: "최종 보고서 제출 시" }] : DEFAULT_PAY)}>
            {rows.length ? "줄 추가" : "지급 조건 추가"}
          </button>
        )}
        {rows.length > 0 && <span className={`paysch__sum tnum${sum === 100 ? "" : " is-off"}`}>합계 <b>{sum}%</b></span>}
      </div>
      {err && <p className="fld__err" role="alert">{err}</p>}
    </div>
  );
}
