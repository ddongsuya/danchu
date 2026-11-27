/** 영업일 가산 (토·일 제외, 공휴일 미반영) */
export function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from);
  let k = 0;
  while (k < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) k++;
  }
  return d;
}

/** "9월 8일(월)" */
export function formatKo(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${"일월화수목금토"[d.getDay()]})`;
}

/** 서울 기준 현재 시각 */
export function nowSeoul(): Date {
  const s = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  return new Date(s);
}

/** 평일 n일 뒤 "7월 14일" (서울 날짜, 시안 회신 기한 칩 "평일 7일 · 7월 14일") */
export function businessDayLabel(n: number, from: Date = nowSeoul()): string {
  const d = addBusinessDays(from, n);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
