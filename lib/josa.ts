/**
 * 이름 뒤 조사 (을/를, 과/와). 기관 이름처럼 화면에 그대로 끼우는 값에 쓴다 (예: "예시 기관 A를 선정할까요?").
 * 한글은 받침으로, 영문 글자·숫자는 읽는 소리의 받침으로 고른다 (L·M·N·R, 0·1·3·6·7·8 은 받침 있음).
 */
const LATIN_FINAL = new Set(["l", "m", "n", "r"]);
const DIGIT_FINAL = new Set(["0", "1", "3", "6", "7", "8"]);

function hasFinal(word: string): boolean {
  const s = word.replace(/[\s)\]"'.,·]+$/u, "");
  const ch = s.at(-1) ?? "";
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return DIGIT_FINAL.has(ch);
  if (/[a-z]/i.test(ch)) return LATIN_FINAL.has(ch.toLowerCase());
  return false;
}

/** "기관 A" → "기관 A를", "한국독성" → "한국독성을" */
export const eulReul = (w: string) => `${w}${hasFinal(w) ? "을" : "를"}`;
/** "기관 A" → "기관 A와", "한국독성" → "한국독성과" */
export const gwaWa = (w: string) => `${w}${hasFinal(w) ? "과" : "와"}`;
