/** 표기 헬퍼 — 금액·날짜 */

/** 187000000 → "1억 8,700만 원" */
export function won(n: number): string {
  if (!n) return "0원";
  const e = Math.floor(n / 1e8);
  const m = Math.round((n % 1e8) / 1e4);
  return (e ? `${e}억 ` : "") + (m ? `${m.toLocaleString("ko-KR")}만 원` : e ? "" : `${n.toLocaleString("ko-KR")}원`);
}
export function comma(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** "2026-10-12" → "10월 12일" */
export function md(s: string | null | undefined): string {
  if (!s) return "—";
  const [, m, d] = s.slice(0, 10).split("-");
  return `${+m}월 ${+d}일`;
}
/** ISO → "2026.09.08" */
export function ymd(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "");
}
/** ISO → "9월 8일 14:05" */
export function mdhm(s: string | null | undefined): string {
  if (!s) return "—";
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
/** 오늘 (서울) YYYY-MM-DD */
export function todaySeoul(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}
