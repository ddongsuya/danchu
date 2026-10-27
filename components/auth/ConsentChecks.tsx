"use client";

/** 가입 화면 동의 체크. 약관과 개인정보 수집·이용 동의는 항목마다 따로 받는다 (개인정보 보호법 제22조 제1항) */
export type ConsentItem = { id: string; label: React.ReactNode };

export function ConsentChecks({
  items,
  checked,
  onChange,
}: {
  items: ConsentItem[];
  checked: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  return (
    <div className="consents" role="group" aria-label="필수 동의">
      {items.map((it) => (
        <label key={it.id} className={`chk${checked[it.id] ? " chk--on" : ""}`}>
          <input
            type="checkbox"
            checked={!!checked[it.id]}
            onChange={(e) => onChange({ ...checked, [it.id]: e.target.checked })}
          />
          <span>
            <span className="consents__req">[필수]</span> {it.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/** 모든 항목에 동의했는지 */
export function allConsented(items: ConsentItem[], checked: Record<string, boolean>): boolean {
  return items.every((it) => checked[it.id]);
}
