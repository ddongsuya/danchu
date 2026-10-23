"use client";

import { useLayoutEffect, useRef } from "react";
import { won } from "@/lib/format";

/** 숫자만 남긴다 */
export const digitsOnly = (s: string, max: number) => s.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "").slice(0, max);

/** "180000000" → "180,000,000" */
export const groupDigits = (d: string) => (d ? Number(d).toLocaleString("ko-KR") : "");

/**
 * 쉼표가 들어간 문자열에서 caret 앞 숫자 개수를 센다.
 * 다시 쉼표를 넣은 뒤에도 같은 숫자 뒤에 caret 을 둘 수 있게.
 */
export function digitsBefore(s: string, caret: number): number {
  let n = 0;
  for (let i = 0; i < caret && i < s.length; i++) if (s[i] >= "0" && s[i] <= "9") n++;
  return n;
}
/** 쉼표 문자열에서 n 번째 숫자 바로 뒤의 위치 */
export function caretAfterDigits(s: string, n: number): number {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] >= "0" && s[i] <= "9") seen++;
    if (seen === n) return i + 1;
  }
  return s.length;
}

/**
 * 금액 입력 칸. 쉼표를 넣어 보여 주되, 중간을 고쳐도 caret 이 끝으로 튀지 않는다.
 * 아래에 한글 읽기(예: 1억 8,005만 원)를 붙여 자릿수 실수를 바로 알아보게 한다.
 */
export function MoneyInput({
  value,
  onChange,
  maxDigits = 13,
  unit = "원",
  label,
  placeholder,
  disabled,
  readout = true,
  inputStyle,
}: {
  value: string | undefined | null;
  onChange: (digits: string) => void;
  maxDigits?: number;
  unit?: string;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  readout?: boolean;
  inputStyle?: React.CSSProperties;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const pending = useRef<number | null>(null);
  const shown = groupDigits(value ?? "");

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && pending.current != null && document.activeElement === el) {
      const pos = caretAfterDigits(el.value, pending.current);
      el.setSelectionRange(pos, pos);
    }
    pending.current = null;
  }, [shown]);

  const n = Number(value || 0);
  return (
    <div className="money">
      <div className="numin">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          value={shown}
          style={inputStyle}
          aria-label={label}
          onChange={(e) => {
            const raw = e.target.value;
            const caret = e.target.selectionStart ?? raw.length;
            const leadingZeros = /^0+/.exec(raw.replace(/[^\d]/g, ""))?.[0].length ?? 0;
            pending.current = Math.max(0, digitsBefore(raw, caret) - leadingZeros);
            onChange(digitsOnly(raw, maxDigits));
          }}
        />
        <span>{unit}</span>
      </div>
      {readout && (
        <span className="money__read tnum" aria-live="polite">
          {n >= 1e4 ? won(n) : ""}
        </span>
      )}
    </div>
  );
}
