/** 표기 헬퍼 - 금액·날짜 */

/** 187000000 → "1억 8,700만 원" */
export function won(n: number): string {
  if (!n) return "0원";
  if (n < 1e4) return `${n.toLocaleString("ko-KR")}원`; // 만 원 미만은 반올림하지 않는다
  const e = Math.floor(n / 1e8);
  const m = Math.round((n % 1e8) / 1e4);
  return (e ? `${e}억 ` : "") + (m ? `${m.toLocaleString("ko-KR")}만 원` : e ? "" : `${n.toLocaleString("ko-KR")}원`);
}
export function comma(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 날짜("2026-10-12")는 그대로, 시각(ISO)은 서울 날짜로 → "2026-10-12" */
function seoulDate(s: string): string {
  if (s.length <= 10) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}
/** "2026-10-12" 또는 ISO 시각 → "10월 12일" (서울) */
export function md(s: string | null | undefined): string {
  if (!s) return "-";
  const [, m, d] = seoulDate(s).split("-");
  return `${+m}월 ${+d}일`;
}
/** "2026-12-01" 또는 ISO 시각 → "12-01" (서울). 일정 줄의 날짜 칸 */
export function mmdd(s: string | null | undefined): string {
  return s ? seoulDate(s).slice(5, 10) : "";
}
/** "2026-12-07" → "2026-12-08" (서울 달력 기준 다음 날) */
export function nextDay(ymd: string): string {
  return new Date(new Date(`${ymd.slice(0, 10)}T12:00:00+09:00`).getTime() + 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}
/** ISO → "2026.09.08" */
export function ymd(s: string | null | undefined): string {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "");
}
/** ISO → "9월 8일 14:05" */
export function mdhm(s: string | null | undefined): string {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}
/** 상대 시각: "방금", "3시간 전", "어제", "9월 2일" */
export function ago(s: string | null | undefined): string {
  if (!s) return "";
  const t = new Date(s).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 6e4);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d === 1) return "어제";
  if (d < 7) return `${d}일 전`;
  return md(new Date(t).toISOString());
}
/** D-day (서울 자정 기준) */
export function dday(ymdStr: string | null | undefined): { n: number; label: string } {
  if (!ymdStr) return { n: 0, label: "" };
  const end = new Date(`${ymdStr.slice(0, 10)}T23:59:59+09:00`).getTime();
  const n = Math.ceil((end - Date.now()) / 864e5);
  return { n, label: n < 0 ? "기한 지남" : n === 0 ? "D-day" : `D-${n}` };
}
/**
 * 결제 조건 "50, 50" · "30 · 40 · 30" → "선급 50% · 잔금 50%" · "선급 30% · 중도 40% · 잔금 30%".
 * 기관 회신 칸이 "선급 · 중도 · 잔금 %" 순서다. 숫자 2~3개가 아니면 적은 그대로 보여 준다
 */
export function payTerms(s: string | null | undefined): string {
  if (!s || !s.trim()) return "";
  const parts = s.split(/[\s,·/:%-]+/).filter(Boolean);
  if (!parts.every((p) => /^\d{1,3}(\.\d+)?$/.test(p))) return s.trim();
  const names = parts.length === 2 ? ["선급", "잔금"] : parts.length === 3 ? ["선급", "중도", "잔금"] : null;
  if (!names) return s.trim();
  return parts.map((p, i) => `${names[i]} ${p}%`).join(" · ");
}
/** 오늘 (서울) YYYY-MM-DD */
export function todaySeoul(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}
