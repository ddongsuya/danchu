import type { CompareCol, CompareRowDef } from "@/components/CompareBoard";
export const UX_ROWS: CompareRowDef[] = [
  { seq: 1, name: "반복투여 4주", category: "일반독성" },
  { seq: 2, name: "복귀돌연변이", category: "유전독성" },
];
/** Explicitly synthetic data, used only behind DANCHU_DESIGN_PREVIEW=1. */
export const UX_COLS: CompareCol[] = [
  {
    id: "preview-a",
    name: "예시 기관 A",
    total: 12000000,
    weeks: 8,
    final: 15,
    finalReport: 12,
    start: "2026-11-01",
    valid: "2026-11-30",
    pay: "선급 30%, 잔금 70%",
    includes: ["임상병리", "조직병리(검경 포함)"],
    note: "영문 보고서 별도",
    glpOk: true,
    glpMissing: [],
    glp: ["식약처(KGLP)"],
    unavailable: [],
    conditional: 0,
    items: [
      {
        seq: 1,
        avail: "가능",
        amount: 10000000,
        weeks: 8,
        design: "설계 예시 · 회복군 별도 협의",
      },
      { seq: 2, avail: "가능", amount: 2000000, weeks: 4 },
    ],
    hasPdf: true,
    selected: false,
    auto: false,
  },
  {
    id: "preview-b",
    name: "예시 기관 B",
    total: 9000000,
    weeks: 7,
    final: 11,
    finalReport: 11,
    start: null,
    valid: null,
    pay: null,
    includes: [],
    note: "반복투여 시험만 수행",
    glpOk: false,
    glpMissing: ["식약처(KGLP)"],
    glp: [],
    unavailable: ["복귀돌연변이"],
    conditional: 1,
    items: [
      {
        seq: 1,
        avail: "조건부 가능",
        amount: 9000000,
        weeks: 7,
        note: "시험물질 입고 일정 확인 필요",
      },
      { seq: 2, avail: "불가", amount: null, weeks: null },
    ],
    hasPdf: false,
    selected: false,
    auto: true,
  },
];

/** 전체 일정 미리보기용 임의 값. 어느 기관의 실제 기간도 아니다 */
export const UX_SCHEDULE = {
  rows: [
    { seq: 1, name: "예시 시험 가", category: "일반독성" },
    { seq: 2, name: "예시 시험 나", category: "일반독성" },
    { seq: 3, name: "예시 시험 다", category: "유전독성" },
    { seq: 4, name: "예시 시험 라", category: "안전성약리" },
  ],
  items: [
    { seq: 1, avail: "가능", weeks: "4", afterSeqs: [101], reportWeeks: "2" },
    { seq: 2, avail: "가능", weeks: "9", afterSeqs: [1, 102], reportWeeks: "3", translationWeeks: "3" },
    { seq: 3, avail: "가능", weeks: "5", afterSeqs: [101], reportWeeks: "2" },
    { seq: 4, avail: "가능", weeks: "3", afterSeqs: [], reportWeeks: "2" },
  ],
  steps: [
    { seq: 101, name: "예시 단계 A", weeks: "2", after: [] },
    { seq: 102, name: "예시 단계 B", weeks: "3", after: [101] },
  ],
};
