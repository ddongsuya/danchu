/**
 * 단가표에서 고르는 공통 목록 (2026-11-18 사용자 결정: 단추는 목록만, 가격은 기관이 넣는다).
 * 목록에 없으면 기관이 직접 적는다. 가격·기간·설계 값은 넣지 않는다 (중립). 바꿀 때는 PR 로.
 */
import type { PriceCat } from "./price-book";

/** 분류 → 칸 → 고르는 값. 종별 계통처럼 묶음이 있으면 group 으로 나눈다 */
export type PickList = { group?: string; values: string[] }[];

export const PRICE_LISTS: Partial<Record<PriceCat, Record<string, PickList>>> = {
  animal: {
    species: [{ values: ["마우스", "랫드", "기니피그", "토끼", "햄스터"] }],
    strain: [
      { group: "마우스", values: ["C57BL/6", "BALB/c", "ICR", "BALB/c nude", "NOD/SCID", "NSG", "db/db", "ob/ob", "DBA/1"] },
      { group: "랫드", values: ["SD", "Wistar", "F344", "Lewis", "SHR", "ZDF"] },
      { group: "기니피그", values: ["Hartley"] },
      { group: "토끼", values: ["NZW"] },
    ],
    sex: [{ values: ["수컷", "암컷"] }],
  },
  housing: {
    species: [{ values: ["마우스", "랫드", "기니피그", "토끼", "햄스터"] }],
    condition: [{ values: ["일반", "SPF", "격리", "대사 케이지"] }],
  },
  model: {
    method: [{ values: ["화학 유발", "수술", "세포 접종", "면역 유발", "식이 유발", "유전자 모델"] }],
    reagent: [{ values: ["포함", "별도"] }],
  },
  dosing: {
    route: [{ values: ["경구", "복강", "정맥", "피하", "근육", "도포", "비강", "흡입", "지속 주입"] }],
    size: [{ values: ["소동물", "대동물"] }],
  },
  observe: {
    item: [{ values: ["체중", "사료 섭취량", "임상 점수", "종양 크기", "채혈", "부검", "장기 무게"] }],
  },
  molecular: {
    method: [{ values: ["ELISA", "Multiplex", "qPCR", "Western blot", "유세포 분석", "혈액학", "혈액생화학"] }],
    matrix: [{ values: ["혈청", "혈장", "전혈", "조직", "뇨", "분변"] }],
  },
  pathology: {
    stain: [{ values: ["H&E", "특수 염색", "IHC", "IF"] }],
    reading: [{ values: ["포함", "별도"] }],
  },
  imaging: {
    item: [{ values: ["영상 촬영", "행동 평가", "인지 평가", "통증 평가"] }],
  },
  report: {
    item: [{ values: ["최종 보고서", "중간 보고", "번역", "통계 분석"] }],
    lang: [{ values: ["국문", "영문", "국영문"] }],
  },
};

/** 그 칸에 고를 목록이 있는지, 값이 목록에 있는지 (목록 밖 값도 저장은 된다) */
export function inList(cat: PriceCat, field: string, value: string): boolean {
  return (PRICE_LISTS[cat]?.[field] ?? []).some((g) => g.values.includes(value));
}
