import type { InviteItem } from "@/components/cro/InviteList";
import type { AdminFunnel } from "@/components/admin/AdminHero";
import type { CompareCol, CompareRowDef } from "@/components/CompareBoard";
import type { Funnel } from "@/lib/request-story";

/** 비교 보고서 미리보기용 예시 (DANCHU_DESIGN_PREVIEW=1 에서만). 실제 기관·금액이 아니다. 항목 금액 합이 총액과 맞게 만든 숫자다 */
export const REPORT_ROWS: CompareRowDef[] = [
  { seq: 1, name: "반복투여 4주 · 설치류", category: "일반독성" },
  { seq: 2, name: "반복투여 4주 · 비설치류", category: "일반독성" },
  { seq: 3, name: "복귀돌연변이(Ames, TG 471)", category: "유전독성" },
  { seq: 4, name: "염색체이상 in vitro(TG 473)", category: "유전독성" },
  { seq: 5, name: "소핵 in vivo(랫드)", category: "유전독성" },
  { seq: 6, name: "hERG(in vitro)", category: "안전성약리" },
  { seq: 7, name: "TK(독성동태)", category: "PK/TK/ADME·생체시료분석" },
];

const M = 10000;
const base = { start: "2026-11-16", valid: "2026-11-30", pay: "선급 30%, 잔금 70%", includes: ["임상병리", "조직병리(검경 포함)"], note: null, glpOk: true, glpMissing: [], glp: ["식약처(KGLP)"], hasPdf: true, selected: false, auto: false };
const items = (v: [number, number][], tk: string) => [
  ...v.map(([a, w], i) => ({ seq: i + 1, avail: "가능", amount: a * M, weeks: w })),
  { seq: 7, avail: tk, amount: null, weeks: null },
];
export const REPORT_COLS: CompareCol[] = [
  { ...base, id: "rp-a", name: "예시 기관 A", total: 32460 * M, weeks: 13, final: 35, finalReport: 30, unavailable: ["TK(독성동태)"], conditional: 0, items: items([[9800, 6], [14200, 13], [1600, 3], [2100, 4], [1900, 4], [2860, 3]], "불가") },
  { ...base, id: "rp-b", name: "예시 기관 B", total: 36850 * M, weeks: 20, final: 30, finalReport: 26, unavailable: ["TK(독성동태)"], conditional: 0, items: items([[11500, 20], [15800, 13], [1800, 3], [2400, 4], [2050, 4], [3300, 3]], "불가") },
];

export const STORY_FUNNEL: Funnel = { sent: 5, opened: 4, joined: 3, submitted: 2, rest: 2 };


/** 기관 홈 미리보기 예시 (날짜는 오늘 기준으로 만든다) */
export function croItems(now: number): InviteItem[] {
  const d = (n: number) => new Date(now + n * 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const exp = (n: number) => new Date(now + n * 864e5).toISOString();
  const base = { client: "바이오 벤처 (선정 시 공개)", purpose: "식약처(MFDS)", cancelled: false, sentAt: exp(-10) };
  return [
    { ...base, id: "c8", no: "DEMO-008", substance: "예시 물질 E", tags: ["일반독성", "유전독성"], replyBy: d(2), expiresAt: exp(3), stage: "draft", rfqStatus: "quoted", total: null, quoteStatus: "draft" },
    { ...base, id: "c9", no: "DEMO-009", substance: "", tags: ["안전성약리"], replyBy: d(5), expiresAt: exp(6), stage: "undecided", rfqStatus: "distributed", total: null, quoteStatus: null },
    { ...base, id: "c5", no: "DEMO-005", substance: "예시 물질 A", tags: ["일반독성"], replyBy: d(1), expiresAt: exp(2), stage: "submitted", rfqStatus: "quoted", total: 32460 * 10000, quoteStatus: "submitted" },
    { ...base, id: "c6", no: "DEMO-006", substance: "예시 물질 B", tags: ["일반독성"], replyBy: d(-30), expiresAt: exp(-29), stage: "submitted", rfqStatus: "selected", total: 32460 * 10000, quoteStatus: "submitted", awarded: true, client: "예시 의뢰사" },
    { ...base, id: "c1", no: "DEMO-001", substance: "", tags: ["유전독성"], replyBy: d(-20), expiresAt: exp(-19), stage: "declined", rfqStatus: "distributed", total: null, quoteStatus: null },
  ];
}

export const ADMIN_FUNNEL: AdminFunnel = {
  reqs: 8, sent: 16, opened: 6, joined: 4, submitted: 3, selected: 1,
  per: [
    { rfq_no: "DEMO-007", sent: 2, joined: 0, submitted: 0 },
    { rfq_no: "DEMO-006", sent: 2, joined: 2, submitted: 2 },
    { rfq_no: "DEMO-005", sent: 2, joined: 0, submitted: 0 },
    { rfq_no: "DEMO-008", sent: 3, joined: 2, submitted: 1 },
    { rfq_no: "DEMO-004", sent: 2, joined: 0, submitted: 0 },
  ],
};

/** 기관 요청 이야기 미리보기 (회신 6개 중 4개 작성) */
export function croStoryFixture(now: number) {
  const d = (n: number) => new Date(now + n * 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const rows = [
    { seq: 1, name: "반복투여 13주 · 설치류", category: "일반독성" },
    { seq: 2, name: "반복투여 13주 · 비설치류", category: "일반독성" },
    { seq: 3, name: "복귀돌연변이(Ames, TG 471)", category: "유전독성" },
    { seq: 4, name: "소핵 in vivo(랫드)", category: "유전독성" },
    { seq: 5, name: "TK(독성동태)", category: "PK/TK/ADME·생체시료분석" },
    { seq: 6, name: "조제물분석", category: "조제물분석" },
  ];
  const items = rows.map((r) => ({ seq: r.seq, avail: r.seq <= 4 ? "가능" : "", amount: r.seq <= 4 ? "10000000" : "", weeks: r.seq <= 4 ? "13" : "" }));
  return {
    rfq: { full: true, no: "DEMO-008", substance: "예시 물질 E", categories: ["일반독성", "유전독성"], client: "바이오 벤처 (선정 시 공개)", masked: false, identityMasked: true, ddayLabel: "D-2", urgent: true, confid: "일반", overview: [["제출처", "식약처(MFDS)"]], rows, common: [], situation: [], ask: [], attachments: "없음", replyBy: d(2), authorities: ["식약처(MFDS)"], files: [] },
    draft: { items, note: "", pdfName: "", status: "draft", common: {} },
    inviteId: "x", rfqId: "x", croName: "예시 기관 A", croOrgId: null, token: "preview", expired: false, locked: false, declined: false, closed: false, closedReason: null,
    joined: true, withdrawn: false, canRejoin: false, operator: false, seats: null, joinBy: null,
  };
}
