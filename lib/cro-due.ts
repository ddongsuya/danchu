/**
 * 받은 요청 표의 회신 기한 칸과 정렬 (시안 검토판 c-req, 2026-11-27).
 * 날짜는 서울 기준 YYYY-MM-DD 문자열끼리 비교한다.
 */

const DAY = 864e5;
const md = (d: string) => `${d.slice(5, 7)}-${d.slice(8, 10)}`;
const dayNo = (d: string) => Math.round(new Date(`${d.slice(0, 10)}T00:00:00+09:00`).getTime() / DAY);

/** 남은 날 수. 오늘이면 0, 지났으면 음수 */
export function daysLeft(due: string, today: string): number {
  return dayNo(due) - dayNo(today);
}

/** "07-27 · D-13", 당일은 "오늘 마감", 지나면 "07-01 · 마감", 없으면 "-" */
export function replyDueLabel(due: string | null | undefined, today: string): { text: string; today: boolean } {
  if (!due) return { text: "-", today: false };
  const n = daysLeft(due, today);
  if (n === 0) return { text: "오늘 마감", today: true };
  return { text: n < 0 ? `${md(due)} · 마감` : `${md(due)} · D-${n}`, today: false };
}

/** 회신 기한 가까운 순: 남은 기한이 가까운 것부터, 지난 기한은 그 뒤에 최근 것부터, 기한 없는 것은 맨 뒤 */
export function sortByReplyDue<T extends { replyBy: string; no: string }>(items: readonly T[], today: string): T[] {
  const rank = (x: T) => (!x.replyBy ? 2 : x.replyBy >= today ? 0 : 1);
  return [...items].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return a.replyBy.localeCompare(b.replyBy) || a.no.localeCompare(b.no);
    if (ra === 1) return b.replyBy.localeCompare(a.replyBy) || a.no.localeCompare(b.no);
    return a.no.localeCompare(b.no);
  });
}

/** 제출 완료 화면 주소의 ?at= (ISO 시각). 형식이 아니면 버린다 */
export function doneAt(at: string | null | undefined): string | undefined {
  if (!at || at.length > 40 || isNaN(Date.parse(at))) return undefined;
  return at;
}

/** 회신에 붙이는 견적서 PDF 한도 (components/cro/ReplyForm, app/api/quote/[token]/upload-url) */
export const MAX_REPLY_PDF = 20 * 1024 * 1024;

/** 견적서 PDF 줄의 오류. 문제가 없으면 null (시안 검토판 c-reply~up · ~big) */
export function replyPdfError(f: { name: string; size: number; type?: string }): string | null {
  if ((f.type && f.type !== "application/pdf") || !/\.pdf$/i.test(f.name)) return "PDF 파일만 올릴 수 있어요.";
  if (f.size > MAX_REPLY_PDF) return `${Math.ceil(f.size / 1024 / 1024)}MB예요. 20MB 이하로 줄여 다시 올려 주세요.`;
  return null;
}

/** ISO 또는 ms → "14:02" (서울) */
export function hm(t: number | string): string {
  return new Date(t).toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
}

export type SaveState = "idle" | "saving" | "saved" | "failed";
/** 제목 줄의 자동 저장 상태: "저장됨 14:02", 저장하는 중, 멈춤 */
export function saveStatus(state: SaveState, at: number | null): string {
  if (state === "saving") return "저장하는 중";
  if (state === "failed") return "저장 멈춤";
  if (state === "saved") return at ? `저장됨 ${hm(at)}` : "저장됨";
  return "";
}

/** 견적 유효기간은 오늘 이후. 비워 두면 제출일 + 30일 */
export function validUntilError(v: string, today: string): string | null {
  return v && v < today ? "오늘 이후 날짜를 골라 주세요." : null;
}

/** "협의로" · "견적으로": 받침이 있으면 "으로" (ㄹ 받침은 "로"). 토스트 문장용 */
export function withRo(w: string): string {
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  const jong = c >= 0 && c < 11172 ? c % 28 : 0;
  return `${w}${jong && jong !== 8 ? "으로" : "로"}`;
}

/** "영업 담당을" · "김 책임을" · "Kim를": 받침이 있으면 "을" */
export function withObj(w: string): string {
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  return `${w}${c >= 0 && c < 11172 && c % 28 ? "을" : "를"}`;
}
