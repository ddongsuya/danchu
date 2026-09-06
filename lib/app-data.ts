/**
 * 앱 화면용 데모 데이터.
 * 핸드오프 프로토타입의 데모 세트를 그대로 옮긴 것으로,
 * 로그인·Supabase 연동이 붙으면 이 모듈만 교체하면 된다.
 */

export const ME = {
  name: "김서연",
  initial: "서",
  company: "(주)바이오벤처",
  dept: "개발팀 팀장",
  email: "seoyeon@bioventure.kr",
  phone: "010-4821-0000",
  orgType: "바이오벤처",
  cda: "체결 완료 · 2026.08",
};

/** 요청 진행 7단계 — 상태값과 진행률 */
export const STAGES = [
  "접수", "배포", "견적 도착", "비교표 발송", "CRO 선택", "계약 진행", "종료",
] as const;
export const STAGE_PCT: Record<string, number> = {
  접수: 8, 배포: 25, "견적 도착": 45, "비교표 발송": 60, "CRO 선택": 75, "계약 진행": 88, 종료: 100,
};

export type Req = {
  no: string;
  substance: string;
  cats: string;
  status: string;
  tone: "sf" | "tint" | "ok";
  pct: number;
  meta: string;
};

export const REQUESTS: Req[] = [
  { no: "DC-2026-0008", substance: "AB-14", cats: "안전성약리 · hERG", status: "접수", tone: "sf", pct: 8, meta: "배포 예정 9/8" },
  { no: "DC-2026-0007", substance: "DC-101", cats: "일반독성 · 유전독성", status: "견적 도착 3/5", tone: "tint", pct: 45, meta: "회신 기한 9/16" },
  { no: "DC-2026-0005", substance: "BV-22", cats: "안전성약리", status: "비교표 발송", tone: "tint", pct: 60, meta: "CRO 선택 대기" },
  { no: "DC-2026-0003", substance: "KX-7", cats: "의료기기 생물학적 안전성", status: "계약 진행", tone: "ok", pct: 88, meta: "KTR과 진행" },
  { no: "DC-2026-0002", substance: "DC-090", cats: "동물대체시험", status: "종료", tone: "sf", pct: 100, meta: "6월 완료" },
];

export const SUMMARY = { ongoing: 3, arrived: 3, closed: 1 };

/** 견적 비교 대상 요청 */
export const FOCUS = {
  no: "DC-2026-0007",
  substance: "DC-101",
  cats: "일반독성 · 유전독성 · 허가자료 제출용",
  status: "견적 도착 3/5",
  chips: ["식약처(MFDS)", "US FDA", "CRO 5곳", "CDA 필요"],
  replyBy: "회신 기한 9월 16일",
};

/** 진행 상태 타임라인 — st: 2 완료 · 1 현재 · 0 예정 */
export const TIMELINE: [string, string, string, number][] = [
  ["접수", "요청서 정리 완료", "9월 4일", 2],
  ["배포 완료", "CDA 체결 CRO 5곳", "9월 5일", 2],
  ["견적 도착 3/5", "켐온 · 바이오톡스텍 · KIT", "진행 중", 1],
  ["비교표 발송", "회신 기한 후 1영업일", "9월 17일 예정", 0],
  ["CRO 선택", "", "", 0],
  ["계약 진행", "", "", 0],
  ["종료", "", "", 0],
];

export const REPLIES: [string, string, boolean][] = [
  ["KIT 안전성평가연구소", "도착 · 오늘", true],
  ["켐온", "도착 · 9월 6일", true],
  ["바이오톡스텍", "도착 · 9월 5일", true],
  ["코아스템켐온", "작성 중", false],
  ["KTR", "미회신", false],
];

export const INCL_KEYS = ["임상병리", "조직병리", "TK", "조제물분석", "QA 점검", "영문 보고서"];

export type Cro = {
  slug: string;
  name: string;
  no: string;
  date: string;
  total: number;
  start: string;
  weeks: number;
  incl: number[];
  excl: string;
  glp: string[];
  glpOk: boolean;
  pay: string;
  valid: string;
  addon: string;
  items: [string, number, number, string][];
};

/** 참여 기관명은 예시 데이터 — 실제 서비스에서는 계정 정보로 대체된다 */
export const CROS: Cro[] = [
  {
    slug: "a", name: "켐온", no: "CQ-26-1188", date: "2026.09.06",
    total: 187000000, start: "2026-10-12", weeks: 26, incl: [1, 1, 1, 1, 1, 0],
    excl: "영문 보고서 +800만 원 · 시험물질 보관 별도",
    glp: ["식약처(KGLP)", "OECD GLP", "US FDA GLP"], glpOk: true,
    pay: "30 · 40 · 30", valid: "2026-11-06", addon: "1건 · hERG(권장)",
    items: [
      ["반복투여독성 4주 (랫드)", 128000000, 22, "SD 랫드 · 4군 · 10/10 · 회복 2주"],
      ["복귀돌연변이 Ames (TG 471)", 9500000, 6, "5균주 · ±S9"],
      ["염색체이상 in vitro (TG 473)", 14500000, 8, "CHL 세포"],
      ["소핵 in vivo (마우스)", 35000000, 10, "ICR 마우스 · 3군"],
    ],
  },
  {
    slug: "b", name: "바이오톡스텍", no: "BTT-2609-042", date: "2026.09.05",
    total: 172000000, start: "2026-11-02", weeks: 28, incl: [1, 0, 0, 1, 1, 1],
    excl: "조직병리 판독 +1,800만 원 · TK 분석 +1,500만 원",
    glp: ["식약처(KGLP)", "OECD GLP"], glpOk: false,
    pay: "50 · 0 · 50", valid: "2026-10-30", addon: "없음",
    items: [
      ["반복투여독성 4주 (랫드)", 118000000, 24, "SD 랫드 · 4군 · 10/10"],
      ["복귀돌연변이 Ames (TG 471)", 9000000, 6, "5균주 · ±S9"],
      ["염색체이상 in vitro (TG 473)", 13500000, 8, "CHL 세포"],
      ["소핵 in vivo (마우스)", 31500000, 10, "ICR 마우스 · 3군"],
    ],
  },
  {
    slug: "c", name: "KIT 안전성평가연구소", no: "KIT-Q-26-0731", date: "2026.09.07",
    total: 203500000, start: "2026-09-28", weeks: 24, incl: [1, 1, 1, 1, 1, 1],
    excl: "없음 · 전 항목 기본 포함",
    glp: ["식약처(KGLP)", "OECD GLP", "US FDA GLP", "US EPA GLP"], glpOk: true,
    pay: "30 · 30 · 40", valid: "2026-11-15", addon: "2건 · hERG(필수) · 국소내성(권장)",
    items: [
      ["반복투여독성 4주 (랫드)", 139000000, 20, "SD 랫드 · 4군 · 10/10 · 회복 2주 · TK"],
      ["복귀돌연변이 Ames (TG 471)", 10500000, 5, "5균주 · ±S9"],
      ["염색체이상 in vitro (TG 473)", 16000000, 7, "CHL 세포"],
      ["소핵 in vivo (마우스)", 38000000, 9, "ICR 마우스 · 3군 · 노출증명"],
    ],
  },
];

export const MIN_TOTAL = Math.min(...CROS.map((c) => c.total));

/** 알림 — h는 섹션 헤더 */
export const NOTIFS: ([("h"), string] | [string, string, string, string, 0 | 1])[] = [
  ["h", "오늘"],
  ["견적", "KIT 안전성평가연구소 견적 도착", "DC-2026-0007 · 5곳 중 3곳 회신 · 비교표는 회신 기한 후 발송", "2시간 전", 1],
  ["견적", "켐온 견적 도착", "DC-2026-0007 · 정본 PDF 첨부", "어제", 1],
  ["h", "이번 주"],
  ["배포", "CRO 배포 완료", "DC-2026-0007 · CDA 체결 기관 5곳에 전달", "9월 5일", 0],
  ["비교", "비교표가 도착했습니다", "DC-2026-0005 · 4곳 회신 · 총액 오름차순", "9월 3일", 0],
  ["계약", "KTR이 연락처를 확인했습니다", "DC-2026-0003 · 계약 진행", "9월 2일", 0],
  ["접수", "접수되었습니다", "DC-2026-0007 · 배포 예정 9월 5일", "9월 4일", 0],
];

/* ── 표기 헬퍼 ─────────────────────────────────────── */

/** 187000000 → "1억 8,700만 원" */
export function won(n: number): string {
  const e = Math.floor(n / 1e8);
  const m = Math.round((n % 1e8) / 1e4);
  return (e ? `${e}억 ` : "") + (m ? `${m.toLocaleString("ko-KR")}만 원` : e ? "" : "0원");
}
export function comma(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}
/** "2026-10-12" → "10월 12일" */
export function md(s: string): string {
  const [, m, d] = s.split("-");
  return `${+m}월 ${+d}일`;
}
/** 데모 기준일(2026-09-07)에서 남은 일수 */
export function dday(s: string): string {
  const t = new Date("2026-09-07");
  const d = new Date(s);
  return `D-${Math.round((d.getTime() - t.getTime()) / 864e5)}`;
}
export function croBySlug(slug: string): Cro {
  return CROS.find((c) => c.slug === slug) ?? CROS[0];
}
