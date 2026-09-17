/**
 * 패키지 프리셋 — 개발 분야별로 흔히 묶이는 시험 항목 세트.
 * - 기관: 카탈로그에서 프리셋을 고르면 해당 항목의 조합이 한 번에 만들어져 채우기만 하면 된다
 * - 의뢰자: 요청서에서 프리셋을 고르면 시험 항목·세부 항목이 미리 선택된다
 * 항목명은 요청서 스키마(DETAILS)의 세부 항목과 정확히 같아야 한다 (catalogItems 로 검증).
 */
import { catalogItems, itemKey } from "./catalog";

export type PresetItem = {
  category: string;
  item: string;
  /** 기관 조합 기본값·의뢰자 요청서 기본값 */
  species?: string[];
  requestSpecies?: string[];
  route?: string;
  method?: string;
  note?: string;
};

export type Preset = {
  key: string;
  name: string;
  audience: string;
  desc: string;
  items: PresetItem[];
};

const RAT = ["SD 랫드"];
const MOUSE = ["ICR 마우스"];
const DOG = ["비글"];
const IV = ["in vitro(동물 없음)"];

export const PRESETS: Preset[] = [
  {
    key: "ind_small",
    name: "의약품 IND 패키지 (저분자·경구)",
    audience: "의약품",
    desc: "ICH M3(R2) 기준 임상 1상 진입용. 설치류·비설치류 단회/반복, 유전독성 3종, 안전성약리 코어배터리, TK.",
    items: [
      { category: "일반독성", item: "단회(급성)투여독성", species: RAT, requestSpecies: ["랫드"], route: "경구(PO)", method: "ICH M3 단회 설계(관찰 14일)" },
      { category: "일반독성", item: "단회(급성)투여독성", species: DOG, requestSpecies: ["개(비글)"], route: "경구(PO)", method: "ICH M3 단회 설계(관찰 14일)" },
      { category: "일반독성", item: "용량결정(DRF) 2주", species: RAT, requestSpecies: ["랫드"], route: "경구(PO)", method: "ICH M3/S4 반복투여 설계" },
      { category: "일반독성", item: "용량결정(DRF) 2주", species: DOG, requestSpecies: ["개(비글)"], route: "경구(PO)", method: "ICH M3/S4 반복투여 설계" },
      { category: "일반독성", item: "반복투여 4주", species: RAT, requestSpecies: ["랫드"], route: "경구(PO)", method: "ICH M3/S4 반복투여 설계", note: "회복군 2주 · TK 병행" },
      { category: "일반독성", item: "반복투여 4주", species: DOG, requestSpecies: ["개(비글)"], route: "경구(PO)", method: "ICH M3/S4 반복투여 설계", note: "회복군 2주 · TK 병행" },
      { category: "유전독성", item: "복귀돌연변이(Ames, TG 471)", species: IV, method: "ICH S2(R1)" },
      { category: "유전독성", item: "염색체이상 in vitro(TG 473)", species: IV, method: "ICH S2(R1)" },
      { category: "유전독성", item: "소핵 in vivo(랫드)", species: RAT, requestSpecies: ["랫드"], route: "경구(PO)", method: "ICH S2(R1)" },
      { category: "안전성약리", item: "hERG(in vitro)", species: IV, method: "ICH S7B" },
      { category: "안전성약리", item: "심혈관계(Telemetry)", species: DOG, requestSpecies: ["개(비글)"], route: "경구(PO)", method: "ICH S7A" },
      { category: "안전성약리", item: "호흡기계(Whole body plethysmography)", species: RAT, requestSpecies: ["랫드"], route: "경구(PO)", method: "ICH S7A" },
      { category: "안전성약리", item: "중추신경계(FOB)", species: RAT, requestSpecies: ["랫드"], route: "경구(PO)", method: "ICH S7A" },
      { category: "PK/TK/ADME·생체시료분석", item: "TK(독성동태)", species: RAT, requestSpecies: ["랫드"], method: "ICH M10 생체시료분석법 검증" },
      { category: "조제물분석", item: "함량", method: "ICH Q2(R2)" },
      { category: "조제물분석", item: "균질성", method: "ICH Q2(R2)" },
      { category: "조제물분석", item: "안정성", method: "ICH Q2(R2)" },
    ],
  },
  {
    key: "ind_bio",
    name: "바이오의약품 IND 패키지",
    audience: "의약품",
    desc: "ICH S6(R1) 기준. 약리학적 관련 종 단회·반복(회복군·TK·ADA), 국소내성, 면역독성, 안전성약리(반복투여 병행).",
    items: [
      { category: "일반독성", item: "단회(급성)투여독성", species: RAT, requestSpecies: ["랫드"], route: "정맥(IV)", method: "ICH M3 단회 설계(관찰 14일)" },
      { category: "일반독성", item: "반복투여 4주", species: RAT, requestSpecies: ["랫드"], route: "정맥(IV)", method: "ICH M3/S4 반복투여 설계", note: "회복군 · TK · ADA" },
      { category: "일반독성", item: "반복투여 4주", species: ["원숭이(영장류)"], requestSpecies: ["원숭이(영장류)"], route: "정맥(IV)", method: "ICH M3/S4 반복투여 설계", note: "회복군 · TK · ADA · 안전성약리 병행" },
      { category: "국소내성", item: "국소내성", species: ["NZW 토끼"], requestSpecies: ["토끼"], route: "정맥(IV)", method: "ICH M3 국소내성" },
      { category: "항원성·면역독성", item: "체액성 면역독성(TDAR)", species: RAT, requestSpecies: ["랫드"], route: "정맥(IV)", method: "ICH S8 면역독성" },
      { category: "PK/TK/ADME·생체시료분석", item: "TK(독성동태)", species: RAT, requestSpecies: ["랫드"], method: "ICH M10 생체시료분석법 검증" },
      { category: "PK/TK/ADME·생체시료분석", item: "분석법 검증(Full)", species: IV, method: "ICH M10 생체시료분석법 검증", note: "PK·ADA 분석법" },
    ],
  },
  {
    key: "hfs",
    name: "건강기능식품 개별인정형",
    audience: "건강기능식품",
    desc: "식약처 건강기능식품 기능성 원료 인정 기준. 급성 경구, 4주 DRF, 13주 반복(회복군), 유전독성 3종.",
    items: [
      { category: "일반독성", item: "단회(급성)투여독성", species: RAT, requestSpecies: ["랫드"], route: "경구(PO)", method: "OECD TG 423 급성독성등급법" },
      { category: "일반독성", item: "용량결정(DRF) 4주", species: RAT, requestSpecies: ["랫드"], route: "경구(PO)", method: "OECD TG 407 (설치류 28일)" },
      { category: "일반독성", item: "반복투여 13주", species: RAT, requestSpecies: ["랫드"], route: "경구(PO)", method: "OECD TG 408 (설치류 90일)", note: "회복군 4주" },
      { category: "유전독성", item: "복귀돌연변이(Ames, TG 471)", species: IV, method: "OECD TG 기준" },
      { category: "유전독성", item: "염색체이상 in vitro(TG 473)", species: IV, method: "OECD TG 기준" },
      { category: "유전독성", item: "소핵 in vivo(마우스)", species: MOUSE, requestSpecies: ["마우스"], route: "경구(PO)", method: "OECD TG 기준" },
    ],
  },
  {
    key: "cosmetic",
    name: "화장품 원료 안전성 (동물대체)",
    audience: "화장품",
    desc: "식약처 화장품 안전성 평가 가이드라인. 피부감작 3종(DPRA·KeratinoSens·h-CLAT), 피부·안자극 대체시험, 광독성, 유전독성.",
    items: [
      { category: "동물대체시험", item: "피부감작 DPRA(TG 442C)", species: IV, method: "OECD TG 기준" },
      { category: "동물대체시험", item: "피부감작 KeratinoSens(TG 442D)", species: IV, method: "OECD TG 기준" },
      { category: "동물대체시험", item: "피부감작 h-CLAT(TG 442E)", species: IV, method: "OECD TG 기준" },
      { category: "동물대체시험", item: "피부자극 인체피부모델(TG 439)", species: IV, method: "OECD TG 기준" },
      { category: "동물대체시험", item: "안자극 각막모델(TG 492)", species: IV, method: "OECD TG 기준" },
      { category: "동물대체시험", item: "광독성 3T3 NRU(TG 432)", species: IV, method: "OECD TG 기준" },
      { category: "유전독성", item: "복귀돌연변이(Ames, TG 471)", species: IV, method: "OECD TG 기준" },
      { category: "유전독성", item: "소핵 in vitro(TG 487)", species: IV, method: "OECD TG 기준" },
    ],
  },
  {
    key: "md_basic",
    name: "의료기기 생물학적 안전성 (표면접촉·단기)",
    audience: "의료기기",
    desc: "ISO 10993-1 기준 표면접촉·24시간 이내 기기. 세포독성, 감작성, 자극성, 급성전신독성, 발열성, 화학적 특성.",
    items: [
      { category: "의료기기 생물학적 안전성", item: "세포독성(10993-5)", species: IV, method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "감작성(10993-10)", species: ["기니피그"], requestSpecies: ["기니피그"], method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "자극성·피내반응(10993-23)", species: ["NZW 토끼"], requestSpecies: ["토끼"], method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "급성전신독성(10993-11)", species: MOUSE, requestSpecies: ["마우스"], method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "발열성(10993-11)", species: ["NZW 토끼"], requestSpecies: ["토끼"], method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "화학적 특성 분석(10993-18)", species: IV, method: "ISO 10993" },
    ],
  },
  {
    key: "md_implant",
    name: "의료기기 생물학적 안전성 (이식·장기접촉)",
    audience: "의료기기",
    desc: "ISO 10993-1 기준 이식·30일 초과 접촉 기기. 기본 6종에 아급성·아만성, 유전독성, 이식, 혈액적합성 추가.",
    items: [
      { category: "의료기기 생물학적 안전성", item: "세포독성(10993-5)", species: IV, method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "감작성(10993-10)", species: ["기니피그"], requestSpecies: ["기니피그"], method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "자극성·피내반응(10993-23)", species: ["NZW 토끼"], requestSpecies: ["토끼"], method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "급성전신독성(10993-11)", species: MOUSE, requestSpecies: ["마우스"], method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "아급성·아만성독성(10993-11)", species: RAT, requestSpecies: ["랫드"], method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "유전독성(10993-3)", species: IV, method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "이식(10993-6)", species: ["NZW 토끼"], requestSpecies: ["토끼"], method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "혈액적합성(10993-4)", species: IV, method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "발열성(10993-11)", species: ["NZW 토끼"], requestSpecies: ["토끼"], method: "ISO 10993" },
      { category: "의료기기 생물학적 안전성", item: "화학적 특성 분석(10993-18)", species: IV, method: "ISO 10993" },
    ],
  },
  {
    key: "chem_reach",
    name: "화학물질 등록 기본 (화평법 1~10톤)",
    audience: "화학물질",
    desc: "화평법 등록 기본 자료. 급성 경구·경피, 피부·안 자극(대체시험), 피부감작, 유전독성 2종, 28일 반복, 생식 스크리닝, 생태독성.",
    items: [
      { category: "일반독성", item: "단회(급성)투여독성", species: RAT, requestSpecies: ["랫드"], route: "경구(PO)", method: "OECD TG 423 급성독성등급법" },
      { category: "일반독성", item: "단회(급성)투여독성", species: RAT, requestSpecies: ["랫드"], route: "경피·피부", method: "OECD TG 420 고정용량법", note: "TG 402 급성경피" },
      { category: "동물대체시험", item: "피부부식 인체피부모델(TG 431)", species: IV, method: "OECD TG 기준" },
      { category: "동물대체시험", item: "피부자극 인체피부모델(TG 439)", species: IV, method: "OECD TG 기준" },
      { category: "동물대체시험", item: "안자극 BCOP(TG 437)", species: IV, method: "OECD TG 기준" },
      { category: "항원성·면역독성", item: "피부감작성 LLNA", species: MOUSE, requestSpecies: ["마우스"], route: "경피·피부", method: "OECD TG 429 LLNA" },
      { category: "유전독성", item: "복귀돌연변이(Ames, TG 471)", species: IV, method: "OECD TG 기준" },
      { category: "유전독성", item: "염색체이상 in vitro(TG 473)", species: IV, method: "OECD TG 기준" },
      { category: "일반독성", item: "반복투여 4주", species: RAT, requestSpecies: ["랫드"], route: "경구(PO)", method: "OECD TG 407 (설치류 28일)" },
      { category: "생식발생독성", item: "생식발생 스크리닝", species: RAT, requestSpecies: ["랫드"], route: "경구(PO)", method: "OECD TG 421/422 스크리닝" },
      { category: "환경유해성", item: "조류 생장저해(TG 201)", species: IV, method: "OECD TG 기준" },
      { category: "환경유해성", item: "물벼룩 급성 유영저해(TG 202)", species: IV, method: "OECD TG 기준" },
      { category: "환경유해성", item: "어류 급성독성(TG 203)", species: ["송사리"], method: "OECD TG 기준" },
      { category: "환경유해성", item: "생분해성(TG 301)", species: IV, method: "OECD TG 기준" },
    ],
  },
];

/** 항목명이 스키마와 어긋난 프리셋 항목은 버린다 (개발 중 실수 방지) */
export function presetItems(p: Preset): (PresetItem & { key: string })[] {
  const valid = new Set(catalogItems().map((it) => it.key));
  return p.items.map((it) => ({ ...it, key: itemKey(it.category, it.item) })).filter((it) => valid.has(it.key));
}

export function presetByKey(key: string): Preset | undefined {
  return PRESETS.find((p) => p.key === key);
}
