/**
 * 세미 컨설팅 — 의뢰자의 상황(물질·단계·임상 계획·보유 자료)을 묻고,
 * 공개 가이드라인에 근거해 시험 구성과 확인할 점을 제안한다.
 *
 * 원칙 (기술문서/10_질문흐름_설계_합성의약품.md)
 * - 중립: 가이드라인이 요구하는 것만 제안한다. 기관마다 다른 부분은 값을 정하지 않고 "기관에 물을 것"으로 넘긴다.
 * - 제안은 미리 채운 선택일 뿐이다. 의뢰자가 빼거나 더한다.
 * - 모든 제안과 안내에 근거 조항을 붙인다.
 *
 * 1차 범위: 합성의약품. 규칙 번호(R-…)는 기술 문서의 규칙과 같다.
 */
import { repeatDoseFor, type ClinDuration, type Stage as TableStage } from "./design-guide";
import type { Values } from "./rfq-schema";

export const ADVISOR_DISCLAIMER = "공개 가이드라인에 근거한 참고용 제안입니다. 최종 시험 구성과 설계는 시험기관 및 규제기관 상담으로 확정하세요.";

export type Answers = Record<string, string | string[] | undefined>;

export type Question = {
  id: string;
  step: 1 | 2 | 3;
  q: string;
  sub?: string;
  multi?: boolean;
  options: string[];
  required?: boolean;
  /** 앞 답에 따라 묻지 않는 경우 */
  when?: (a: Answers) => boolean;
};

export const PRODUCTS = ["합성의약품", "바이오의약품", "세포·유전자치료제", "건강기능식품", "화장품", "의료기기", "화학물질·농약"] as const;
/** 지금 제안을 만들 수 있는 유형 */
export const SUPPORTED_PRODUCTS: readonly string[] = ["합성의약품", "바이오의약품", "세포·유전자치료제", "건강기능식품", "화장품", "의료기기", "화학물질·농약"];
const HF = "건강기능식품";
/** 의약품 질문(단계, 임상 계획)은 건강기능식품에는 묻지 않는다 */
const NON_PHARMA = [HF, "화장품", "의료기기", "화학물질·농약"];
const pharma = (a: Answers) => !NON_PHARMA.includes(String(a.product ?? ""));
const BIO_TYPES = ["단클론항체", "재조합 단백질·펩타이드", "항체약물접합체", "백신", "동등생물의약품", "세포·유전자치료제"];

const PRIOR = [
  "없음",
  "용량결정시험(DRF)",
  "반복투여 2주 (GLP)",
  "반복투여 4주 (GLP)",
  "반복투여 13주 (GLP)",
  "단회투여독성 (GLP)",
  "복귀돌연변이 (GLP)",
  "체외 염색체 손상 시험 (GLP)",
  "체내 소핵 (GLP)",
  "hERG (GLP)",
  "hERG (Non-GLP 선별)",
  "안전성약리 코어배터리 (GLP)",
  "배·태자 발생시험 (GLP)",
  "수태능 시험 (GLP)",
  "체외 대사·혈장단백결합 자료",
  "생체시료 분석법 검증",
  "조제물 분석법 검증",
];

/** 의료기기: 접촉 부위와 기간 → 공통기준규격 표 1, 표 2 */
const MD_COLS: [string, string, string][] = [
  ["md-cyto", "세포독성", "세포독성(10993-5)"],
  ["md-sens", "감작성", "감작성(10993-10)"],
  ["md-irr", "자극성·피내반응", "자극성·피내반응(10993-23)"],
  ["md-acute", "급성 전신독성", "급성전신독성(10993-11)"],
  ["md-sub", "아급성·아만성 독성", "아급성·아만성독성(10993-11)"],
  ["md-geno", "유전독성", "유전독성(10993-3)"],
  ["md-impl", "이식", "이식(10993-6)"],
  ["md-hemo", "혈액적합성", "혈액적합성(10993-4)"],
];
/** o 지정 시험, t 추가로 적용될 수 있는 시험, - 해당 없음. 열 순서는 MD_COLS */
const MD_TABLE: Record<string, [string, string, string]> = {
  "표면접촉 · 피부": ["ooo-----", "ooo-----", "ooo-----"],
  "표면접촉 · 점막": ["ooo-----", "ooott-t-", "oootoot-"],
  "표면접촉 · 파열·외상 표면": ["ooot----", "ooott-t-", "oootoot-"],
  "체내외 연결 · 간접 혈액경로": ["oooo---o", "oooot--o", "ootoooto"],
  "체내외 연결 · 조직·뼈·상아질": ["ooot----", "ooooooo-", "ooooooo-"],
  "체내외 연결 · 순환 혈액": ["oooo-t-o", "oooooooo", "oooooooo"],
  "이식 · 조직·뼈": ["ooot----", "ooooooo-", "ooooooo-"],
  "이식 · 혈액": ["ooooo-oo", "oooooooo", "oooooooo"],
};

export const QUESTIONS: Question[] = [
  { id: "product", step: 1, q: "무엇을 개발하시나요?", options: [...PRODUCTS], required: true },
  { id: "bioType", step: 1, q: "어떤 바이오의약품인가요?", options: BIO_TYPES, required: true, when: (a) => a.product === "바이오의약품" },
  { id: "bioSpecies", step: 1, q: "약리 활성이 나타나는 동물종(관련 종)을 확인했나요?", sub: "바이오의약품의 독성시험은 관련 종에서 합니다.", options: ["설치류와 비설치류 모두", "영장류만", "설치류만", "관련 종 없음", "아직 확인 안 함"], required: true, when: (a) => a.product === "바이오의약품" && a.bioType !== "백신" && a.bioType !== "세포·유전자치료제" },
  { id: "stage", step: 1, when: pharma, q: "어느 단계를 준비하시나요?", sub: "단계에 따라 필요한 시험 범위가 달라집니다.", options: ["1상 진입", "2상", "3상", "품목허가", "자체 연구"], required: true },
  { id: "auth", step: 1, q: "어디에 제출하시나요?", sub: "해당하는 곳을 모두 고르세요.", multi: true, options: ["식약처", "미국 FDA", "유럽 EMA", "일본 PMDA", "기타"], required: true, when: (a) => pharma(a) && a.stage !== "자체 연구" },
  { id: "indication", step: 1, when: pharma, q: "적응증은 어디에 해당하나요?", options: ["진행암", "중대하거나 생명을 위협하는 질환", "그 외"], required: true },
  { id: "route", step: 2, when: pharma, q: "임상 투여경로는 무엇인가요?", options: ["경구", "정맥", "피하", "근육", "국소 적용(피부·점안 등)", "흡입", "기타"], required: true },
  { id: "duration", step: 2, when: pharma, q: "임상에서 얼마나 투여할 예정인가요?", sub: "반복투여독성 기간을 정합니다.", options: ["단회", "2주 이내", "1개월 이내", "3개월 이내", "6개월 이내", "6개월 초과·만성", "미정"], required: true },
  { id: "freq", step: 2, when: pharma, q: "임상 투여 빈도는요?", options: ["1일 1회", "1일 2회 이상", "주 1회", "간헐", "지속주입", "미정"] },
  { id: "wocbp", step: 2, when: pharma, q: "임상에 가임 여성이 포함되나요?", options: ["예", "아니오", "미정"], required: true },
  { id: "wScale", step: 2, q: "가임 여성은 몇 명에게, 얼마 동안 투여하나요?", sub: "규모가 작고 짧으면 예비 시험으로 뒷받침할 수 있습니다.", options: ["150명 이하이고 3개월 이하", "그보다 많거나 김", "미정"], when: (a) => pharma(a) && a.wocbp === "예" },
  { id: "contra", step: 2, q: "고효율 피임을 임상 조건으로 두나요?", sub: "실패율이 연 1% 미만인 피임법을 말합니다.", options: ["예", "아니오", "미정"], when: (a) => pharma(a) && a.wocbp === "예" },
  { id: "ped", step: 2, when: pharma, q: "소아를 임상에 포함하거나 소아 적응증을 개발하나요?", options: ["아니오", "예 · 2세 미만 포함", "예 · 2세 이상", "미정"] },
  { id: "cns", step: 1, when: (a) => pharma(a) && a.product !== "바이오의약품", q: "약물이 중추신경계에 작용하나요?", sub: "뇌에 들어가 작용하거나, 부작용으로 중추신경계에 영향을 주는 경우입니다.", options: ["예", "아니오", "모름"] },
  { id: "hfKind", step: 1, q: "원료는 어떤 성격인가요?", sub: "독성시험이 필요한지는 원료의 성격으로 정해집니다.", options: ["섭취 경험이 있는 원료 자체", "단순 추출물 (물·주정·이산화탄소)", "그 밖의 추출·정제·발효", "합성 원료", "섭취 경험이 없는 원료"], required: true, when: (a) => a.product === HF },
  { id: "hfAdverse", step: 1, q: "알려진 부작용이 있나요?", options: ["예", "아니오", "모름"], when: (a) => a.product === HF },
  { id: "hfIntake", step: 2, q: "제안하는 섭취량이 평소 섭취량보다 많은가요?", sub: "식품으로 먹던 원료는 평균 섭취량의 3배 또는 극단 섭취량과 비교합니다.", options: ["예", "아니오", "근거 자료 없음"], required: true, when: (a) => a.product === HF },
  { id: "hfFood", step: 2, q: "식품이나 식품첨가물로 쓸 수 있는 원료인가요?", options: ["예", "아니오", "모름"], when: (a) => a.product === HF && (a.hfKind === "그 밖의 추출·정제·발효" || a.hfKind === "합성 원료") },
  { id: "hfMarker", step: 2, q: "지표 성분과 분석법이 있나요?", sub: "조제물분석에 필요합니다.", options: ["있음", "없음"], when: (a) => a.product === HF },
  { id: "hfComplex", step: 2, q: "여러 원료를 섞은 복합원료인가요?", options: ["예", "아니오"], when: (a) => a.product === HF },
  { id: "cosPurpose", step: 1, q: "어떤 목적의 시험인가요?", options: ["기능성화장품 심사", "새 원료의 사용기준 지정", "자율 안전성 확인", "수출 (상대국 요구)"], required: true, when: (a) => a.product === "화장품" },
  { id: "cosListed", step: 2, q: "원료가 고시, 국제화장품원료집, 식품공전에 실려 있나요?", sub: "실려 있는 원료로 제조하면 안전성 자료를 면제받을 수 있습니다.", options: ["예", "아니오", "모름"], required: true, when: (a) => a.product === "화장품" },
  { id: "cosUv", step: 2, q: "자외선을 흡수하는 원료인가요?", sub: "흡수하지 않으면 광독성 자료가 면제됩니다.", options: ["예", "아니오", "모름"], when: (a) => a.product === "화장품" },
  { id: "mdContact", step: 1, q: "기기가 몸의 어디에 닿나요?", options: Object.keys(MD_TABLE), required: true, when: (a) => a.product === "의료기기" },
  { id: "mdDuration", step: 2, q: "얼마 동안 닿나요?", sub: "둘 이상에 해당하면 더 긴 쪽을 고르세요.", options: ["A · 24시간 이내", "B · 24시간 이상 30일 이내", "C · 30일 초과"], required: true, when: (a) => a.product === "의료기기" },
  { id: "chType", step: 1, q: "어떤 물질인가요?", options: ["일반 화학물질", "농약 원제", "농약 품목"], required: true, when: (a) => a.product === "화학물질·농약" },
  { id: "chTon", step: 2, q: "연간 제조·수입량은 얼마인가요?", sub: "등록 톤수에 따라 제출 자료가 정해집니다.", options: ["1톤 이상 10톤 미만", "10톤 이상 100톤 미만", "100톤 이상 1,000톤 미만", "1,000톤 이상"], required: true, when: (a) => a.product === "화학물질·농약" && a.chType === "일반 화학물질" },
  { id: "chGas", step: 2, q: "기체이거나 주로 흡입으로 노출되나요?", options: ["예", "아니오"], when: (a) => a.product === "화학물질·농약" && a.chType === "일반 화학물질" },
  { id: "prior", step: 3, when: (a) => !["화장품", "의료기기", "화학물질·농약"].includes(String(a.product ?? "")), q: "이미 가진 시험 자료를 모두 골라 주세요", sub: "가진 시험은 제안에서 제외합니다.", multi: true, options: PRIOR, required: true },
];

export function visibleQuestions(a: Answers): Question[] {
  return QUESTIONS.filter((q) => !q.when || q.when(a));
}

/* ── 제안 ─────────────────────────────────────────────── */

export type Suggest = {
  /** 고유 키 */
  key: string;
  label: string;
  /** 요청서 대분류·세부 항목 (DETAILS 와 정확히 일치) */
  category: string;
  item: string;
  reason: string;
  basis: string;
  rule: string;
  /** 기본 포함 여부 */
  on: boolean;
  /** 요청서 세부 조건에 함께 채울 값 (대분류.필드id → 값) */
  fill?: Record<string, string | string[]>;
};

export type Note = { text: string; basis: string; rule: string; /** 화면에서 묶는 분야 */ topic?: string };

const TOPIC_BY_RULE: [string, string][] = [["R-A14", "의존성"], ["R-A13", "안전성약리"], ["R-A3", "소아"], ["R-B2", "약물동태"], ["R-A12", "광안전성"], ["R-A11", "국소독성·국소내성"], ["R-A1-", "일반독성"], ["R-A4", "유전독성"], ["R-A5", "생식·발생독성"], ["R-A6", "발암성"], ["R-A8", "항원성·감작성"], ["R-A9", "면역독성"], ["R-B1", "독성동태"], ["R-B3", "분석"], ["R-B4", "분석"]];
function topicOf(n: Note): string {
  const hit = TOPIC_BY_RULE.find(([p]) => n.rule.startsWith(p));
  if (hit) return hit[1];
  if (/진행암/.test(n.text)) return "항암제";
  if (/가임 여성|수태능|생식/.test(n.text)) return "생식·발생독성";
  return "제출·보고서";
}
export type Later = { label: string; when: string; basis: string };

export type Advice = {
  supported: boolean;
  message?: string;
  tests: Suggest[];
  owned: string[];
  later: Later[];
  notes: Note[];
  /** 가이드라인이 정하지 않아 기관 회신에서 확인할 항목 */
  askCro: string[];
  /** 독성시험 착수 전에 끝나야 하는 것 */
  prereq: string[];
};

const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const has = (a: Answers, id: string, v: string) => arr(a[id]).includes(v);

export function advise(a: Answers): Advice {
  const product = String(a.product ?? "");
  if (!SUPPORTED_PRODUCTS.includes(product)) {
    return {
      supported: false,
      message: `${product || "이 유형"}의 제안은 준비 중입니다. 지금은 시험 항목을 직접 골라 요청해 주세요. 패키지로 시작하면 항목을 한 번에 채울 수 있습니다.`,
      tests: [], owned: [], later: [], notes: [], askCro: [], prereq: [],
    };
  }
  if (product === HF) return adviseHf(a);
  if (product === "화장품") return adviseCosmetic(a);
  if (product === "의료기기") return adviseDevice(a);
  if (product === "화학물질·농약") return adviseChemical(a);
  if (product === "바이오의약품" || product === "세포·유전자치료제") return adviseBio(product === "세포·유전자치료제" ? { ...a, bioType: "세포·유전자치료제" } : a);

  const tests: Suggest[] = [];
  const notes: Note[] = [];
  const later: Later[] = [];
  const askCro = new Set<string>();
  const prereq: string[] = [];

  const stage = String(a.stage ?? "");
  const research = stage === "자체 연구";
  const approval = stage === "품목허가";
  const auth = arr(a.auth);
  const mfds = auth.includes("식약처");
  const overseas = auth.some((x) => x !== "식약처");
  const onc = a.indication === "진행암";
  const topical = String(a.route ?? "").startsWith("국소");
  const prior = arr(a.prior);
  const owned = prior.filter((p) => p !== "없음");
  const own = (s: string) => owned.some((p) => p.startsWith(s));
  const dur = String(a.duration ?? "미정");
  const glp = research ? "미정" : "GLP";

  /* ── 일반독성 ── */
  const tableStage: TableStage = approval ? "품목허가 신청" : "임상시험 진입";
  // 진행암(ICH S9): 기간을 임상 투여기간이 아니라 임상 일정과 단계로 정한다
  const oncLate = onc && (approval || stage === "3상");
  const repeatItems = onc ? [oncLate ? "반복투여 13주" : "반복투여 4주"] : dur === "미정" ? ["반복투여 4주"] : repeatDoseFor(dur as ClinDuration, tableStage).items;
  const species = ["랫드", "개(비글)"];

  if (onc) {
    notes.push({ text: oncLate ? "진행암 의약품은 3상 개시 전에 임상 일정을 따른 3개월 반복투여독성시험을 제출하며, 대부분 이것으로 허가까지 충분합니다." : "진행암 의약품의 1상용 독성시험은 임상 투여 일정에 맞춥니다. 매일 투여를 기준으로 4주를 제안했습니다. 주 1회면 주 1회 4~5회, 3~4주 1회면 단회 투여 설계가 됩니다.", basis: oncLate ? "ICH S9 §3.4" : "ICH S9 §3.3 표 1", rule: "" });
    notes.push({ text: "진행암 의약품은 회복성 평가는 필요하지만 회복군을 자동으로 넣지는 않습니다. 회복군을 뺄지 검토하세요.", basis: "ICH S9 §2.4", rule: "" });
  } else if (dur === "미정") {
    notes.push({ text: "임상 투여기간이 정해지지 않아 1상에 흔한 4주로 제안했습니다. 1상이 2주 이내라면 2주 시험으로도 진입할 수 있지만, 이후 임상이 길어지면 시험을 다시 해야 합니다.", basis: "ICH M3(R2) 표 1", rule: "R-A1-03" });
  }
  const split = repeatItems.length === 2; // 만성: 설치류와 비설치류의 기간이 다르다
  for (const [i, it] of repeatItems.entries()) {
    const who = split ? (i === 0 ? "설치류" : "비설치류") : "설치류와 비설치류";
    const weeks = parseInt(it.replace(/\D/g, ""), 10);
    const already = own(`반복투여 ${weeks}주`);
    if (already) continue;
    const firstGlp = !own("반복투여");
    tests.push({
      key: `repeat-${weeks}`, label: `${it} · ${who}`, category: "일반독성", item: it,
      reason: onc ? (oncLate ? "3상 개시 전 제출. 임상 일정을 따른 3개월 시험" : "임상 투여 일정에 맞춘 1상용 독성시험") : approval ? "적응 투여기간에 맞는 허가용 반복투여독성" : "임상 투여기간 이상으로 두 종에서 표적 장기와 무독성량을 확인",
      basis: onc ? (oncLate ? "ICH S9 §3.4" : "ICH S9 §3.3 표 1") : approval ? "ICH M3(R2) 표 2 · 고시 별표 2 ③" : "ICH M3(R2) 표 1 · 고시 별표 2 ③", rule: approval ? "R-A1-02" : "R-A1-01", on: true,
      fill: { "일반독성.species": split ? [species[i]] : species, "일반독성.tk": research ? "미정" : "포함", "일반독성.formulation": research ? "미정" : "포함", "일반독성.histopath": "포함", "일반독성.glpLevel": glp, "일반독성.recovery": firstGlp ? (weeks >= 13 ? "4주" : "2주") : "미정" },
    });
    if (firstGlp) notes.push({ text: "첫 GLP 반복투여독성이므로 회복 평가를 포함해 제안했습니다. 한 번 가역성을 확인하면 이후 시험에서는 생략할 수 있습니다.", basis: "고시 별표 2 ② 4 · ICH M3(R2) 질의응답 3장", rule: "R-A1-12" });
    if (weeks >= 13 && !own("반복투여")) notes.push({ text: `${weeks}주 시험을 하기 전에 더 짧은 반복투여독성시험이 먼저 필요합니다. 보유 자료가 없다면 4주 시험을 함께 검토하세요.`, basis: "고시 별표 2 ② 2", rule: "R-A1-04" });
  }
  if (!own("용량결정시험") && !own("반복투여")) {
    tests.push({ key: "drf", label: "용량결정시험(DRF) 2주", category: "일반독성", item: "용량결정(DRF) 2주", reason: "본시험의 고용량과 용량 간격을 정하는 예비시험", basis: "고시 별표 2 ② 3", rule: "R-A1-05", on: true });
    askCro.add("용량결정시험의 구성과 본시험 견적 포함 여부");
  }
  if (!own("단회투여독성") && !research) {
    if (mfds) {
      tests.push({ key: "single", label: "단회투여독성", category: "일반독성", item: "단회(급성)투여독성", reason: "식약처 제출. 독성시험기준의 시험 항목", basis: "고시 별표 1", rule: "R-A1-06", on: true });
      notes.push({ text: overseas ? "단회투여독성은 해외 제출에는 별도 시험이 권고되지 않습니다. 식약처 제출분은 용량결정시험으로 인정받을 수 있는지 제출 전에 확인하세요." : "용량결정시험을 단회투여독성으로 인정받을 수 있습니다. 제출 전에 식약처와 확인하면 별도 시험을 줄일 수 있습니다.", basis: "고시 별표 1 ① 1 · ICH M3(R2) §4", rule: "R-A1-06" });
    } else {
      tests.push({ key: "single", label: "단회투여독성", category: "일반독성", item: "단회(급성)투여독성", reason: "해외 제출만이면 별도 단회시험은 권고되지 않음", basis: "ICH M3(R2) §4", rule: "R-A1-07", on: false });
    }
  }
  if (tests.some((t) => t.key.startsWith("repeat"))) {
    askCro.add("회복 동물의 지정 방식과 투여 종료 시·회복 종료 시 부검 동물 수");
    askCro.add("조직병리 확대 판독과 특수염색의 견적 포함 여부");
    if (!research) {
      askCro.add("독성동태의 채혈 방식(위성군·미량채혈), 시점 수, 예상 검체 수");
      notes.push({ text: "독성동태를 반복투여독성에 병행하도록 제안했습니다. 투여 첫날과 종료 무렵에 평가합니다.", basis: "고시 별표 2 ⑤ · ICH S3A §4.3", rule: "R-B1-01" });
    }
  }
  if (a.freq === "지속주입") notes.push({ text: "지속주입은 카테터 수술과 전용 장비가 필요해 수행 가능한 기관이 제한됩니다.", basis: "", rule: "R-A1-17" });
  if (dur === "6개월 초과·만성") {
    notes.push({ text: auth.length === 1 && auth[0] === "유럽 EMA" ? "유럽 제출만이면 비설치류 만성시험은 6개월로 가능합니다." : "비설치류 만성시험은 9개월이 기준입니다. 면역원성, 간헐적 단기 노출 등 일부 경우에는 6개월이 인정됩니다.", basis: "ICH M3(R2) 표 1 주석 d · 고시 [주5]", rule: "R-A1-10" });
    if (a.indication !== "그 외") notes.push({ text: "중대하거나 생명을 위협하는 적응증은 만성시험 자료의 제출 시기가 완화될 수 있습니다.", basis: "ICH M3(R2) 표 1 주석 b", rule: "R-A1-11" });
  }

  /* ── 유전독성 ── */
  if (!research) {
    const single = dur === "단회";
    const full = stage !== "1상 진입" || a.wocbp === "예";
    // 국내: 체외 돌연변이와 염색체 손상 시험은 1상 전, 체내 소핵은 체외 음성이면 2상 전까지 (임상규정 별표 1 주 5)
    const krFirst = mfds && stage === "1상 진입";
    if (!own("복귀돌연변이")) tests.push({ key: "ames", label: "복귀돌연변이(Ames)", category: "유전독성", item: "복귀돌연변이(Ames, TG 471)", reason: "유전자 돌연변이 평가. 첫 임상 전 필요", basis: "ICH M3(R2) §9 · 고시 별표 4", rule: "R-A4-02", on: true, fill: { "유전독성.glpLevel": "GLP" } });
    if (!own("체외 염색체 손상")) tests.push({ key: "invitro-ca", label: "체외 염색체 손상 시험 (염색체이상 또는 소핵)", category: "유전독성", item: "염색체이상 in vitro(TG 473)", reason: single && !full ? "단회 투여 임상은 복귀돌연변이로 진입할 수 있습니다. 반복 투여 임상 전에 필요" : "반복 투여 임상 전에 염색체 손상 평가가 필요", basis: "ICH M3(R2) §9", rule: single && !full ? "R-A4-02" : "R-A4-03", on: !(single && !full) || krFirst });
    if (mfds) notes.push({ text: "국내는 체외 돌연변이 시험과 체외 염색체 손상 시험을 1상 전에 제출합니다. 체외 결과가 양성 또는 의양성이면 체내 소핵시험도 1상 전에, 음성이면 2상 전까지 제출합니다.", basis: "의약품 임상시험 계획 승인에 관한 규정 별표 1 주 5", rule: "R-A4-03" });
    if (!own("체내 소핵")) {
      tests.push({ key: "invivo-mn", label: "체내 소핵", category: "유전독성", item: "소핵 in vivo(랫드)", reason: full ? "전체 배터리. 2상 전 또는 가임 여성 포함 전에 필요" : "전체 배터리는 2상 전까지. 반복투여독성에 통합하면 동물을 따로 쓰지 않습니다", basis: "ICH M3(R2) §9, §11.3 · ICH S2(R1) §4.3.2", rule: full ? "R-A4-04" : "R-A4-05", on: full });
      if (!full) later.push({ label: "유전독성 전체 배터리 (체내 시험 포함)", when: "2상 개시 전, 또는 가임 여성 포함 전", basis: "ICH M3(R2) §9" });
      notes.push({ text: "체내 소핵시험은 반복투여독성시험에 통합할 수 있습니다. 통합하려면 독성시험의 최고용량이 조건을 충족해야 하며, 임상 노출 배수만으로 정한 용량은 인정되지 않습니다.", basis: "ICH S2(R1) §4.3.2 · 고시 [주40]", rule: "R-A4-06" });
    }
    askCro.add("유전독성의 용량 설정 예비시험·확인 시험 포함 여부");
    // 진행암: 임상 진입에는 필수가 아니고 허가 신청 때 필요 (ICH S9 §2.6, 원문 확인)
    if (onc && !approval) {
      for (const t of tests) if (t.category === "유전독성") { t.on = false; t.reason = "진행암 환자 대상 임상에는 필수가 아닙니다. 허가 신청 때 필요"; t.basis = "ICH S9 §2.6"; t.rule = ""; }
      const i = later.findIndex((l) => l.label.startsWith("유전독성"));
      if (i >= 0) later.splice(i, 1);
      later.push({ label: "유전독성시험", when: "품목허가 신청 전", basis: "ICH S9 §2.6" });
    }
  }

  /* ── 안전성약리 ── */
  if (!research) {
    if (onc) {
      notes.push({ text: "진행암 환자 대상 항암제는 독립된 안전성약리시험이 요구되지 않습니다. 반복투여독성의 상세 임상 관찰과 비설치류 심전도로 평가합니다. 항암제는 기준(ICH S9)이 따로 있어 시험 구성 전반이 달라질 수 있습니다.", basis: "ICH S9 §2.2", rule: "R-A13-07" });
    } else if (topical) {
      notes.push({ text: "국소 적용제는 전신 노출이 낮음이 입증되면 안전성약리시험을 생략할 수 있습니다. 전신 노출 자료가 먼저 필요합니다.", basis: "ICH S7A §2.9", rule: "R-A13-09" });
    } else {
      if (!own("안전성약리 코어배터리")) {
        tests.push({ key: "sp-cns", label: "안전성약리 · 중추신경계", category: "안전성약리", item: "중추신경계(FOB)", reason: "코어배터리. 초회 사람 투여 전 필요", basis: "ICH S7A §2.7.1, §2.10.1", rule: "R-A13-01", on: true, fill: { "안전성약리.glpLevel": "GLP" } });
        tests.push({ key: "sp-resp", label: "안전성약리 · 호흡기계", category: "안전성약리", item: "호흡기계(Whole body plethysmography)", reason: "코어배터리. 호흡 기능은 정량 측정이 필요", basis: "ICH S7A §2.7.3", rule: "R-A13-01", on: true });
        tests.push({ key: "sp-cv", label: "안전성약리 · 심혈관계 (비설치류 텔레메트리)", category: "안전성약리", item: "심혈관계(Telemetry)", reason: "코어배터리. 혈압·심박수·심전도", basis: "ICH S7A §2.7.2 · ICH S7B §3.1.3", rule: "R-A13-01", on: true });
        notes.push({ text: "심혈관 시험은 비설치류로 합니다. 성체 랫드와 마우스는 QT 평가에 부적절합니다. 독성시험의 비설치류와 같은 종이 바람직합니다.", basis: "ICH S7B §3.1.3 · 질의응답 3.1", rule: "R-A13-03" });
        askCro.add("텔레메트리 동물 수와 설계(교차·병행), 노출 확인 포함 여부");
      }
      if (!own("hERG (GLP)")) {
        tests.push({ key: "herg", label: "hERG (체외)", category: "안전성약리", item: "hERG(in vitro)", reason: "심실 재분극 지연 평가. 체내 QT 시험과 함께 수행", basis: "ICH S7B §1.4", rule: "R-A13-01", on: true });
        if (own("hERG (Non-GLP")) notes.push({ text: "보유한 hERG 자료가 선별용이라 제출용 GLP 시험이 따로 필요합니다.", basis: "ICH S7B §1.4", rule: "R-A13-15" });
        askCro.add("hERG 방식(수동·자동), 농도 수, 농도 검증 포함 여부");
      }
      if (mfds) notes.push({ text: "국내 제출용 안전성약리 코어배터리는 GLP 자료여야 합니다.", basis: "의약품 품목허가·신고·심사 규정 제7조제5호", rule: "R-A13-02" });
    }
  }

  /* ── 분석 ── */
  const glpTox = !research && tests.some((t) => t.category === "일반독성" && t.on);
  if (glpTox) {
    if (!own("생체시료 분석법 검증")) {
      tests.push({ key: "ba-val", label: "생체시료 분석법 검증", category: "PK/TK/ADME·생체시료분석", item: "분석법 검증(Full)", reason: "독성동태 검체를 분석하려면 검증된 분석법이 필요", basis: "ICH M10 §1.3 · ICH S3A §3.10", rule: "R-B1-05", on: true });
      prereq.push("생체시료 분석법 검증 (독성시험 착수 전 완료)");
      askCro.add("생체시료 분석법 검증의 종류(전체·부분)와 횟수, 종별 구분");
    }
    tests.push({ key: "tk", label: "독성동태(TK) 검체 분석", category: "PK/TK/ADME·생체시료분석", item: "TK(독성동태)", reason: "동물의 실제 노출을 측정해 사람 노출과 비교", basis: "ICH S3A §2 · 고시 별표 2 ⑤", rule: "R-B1-01", on: true });
    tests.push({ key: "form-conc", label: "조제물분석 · 함량", category: "조제물분석", item: "함량", reason: "투여한 조제물의 농도 확인. GLP 시험에 따라옵니다", basis: "OECD GLP 원칙 II.6.2.5 · 비임상시험관리기준 제24조", rule: "R-B4-01", on: true });
    tests.push({ key: "form-stab", label: "조제물분석 · 안정성", category: "조제물분석", item: "안정성", reason: "조제 후 투여까지 농도가 유지되는지. 조제 주기를 정합니다", basis: "OECD GLP 원칙 II.6.2.5", rule: "R-B4-06", on: true });
    tests.push({ key: "form-homo", label: "조제물분석 · 균질성", category: "조제물분석", item: "균질성", reason: "현탁액 등 용액이 아닌 조제물에 필요. 진용액이면 빼세요", basis: "OECD GLP 원칙 II.6.2.5", rule: "R-B4-02", on: true });
    if (!own("조제물 분석법 검증")) prereq.push("조제물 분석법 검증 (독성시험 착수 전 완료)");
    prereq.push("조제물 안정성 확인 (결과에 따라 조제 주기가 정해짐)");
    askCro.add("조제물 분석법 검증 횟수와 구분 (체외 유전독성·체외 약리·체내 등 부형제별)");
    askCro.add("조제물분석의 허용 기준, 분석 횟수, 독성시험 금액 포함 여부");
    notes.push({ text: "분석법 검증은 부형제가 다르면 각각 필요합니다. 체외 시험과 체내 시험은 따로이며, 횟수는 기관마다 다릅니다. 회신에서 확인하세요.", basis: "기술문서 B4", rule: "R-B4-16" });
  }

  /* ── 나중 단계 ── */
  /* ── 생식·발생독성 (기술문서 A5) ── */
  if (!research) {
    const REPRO = "생식발생독성";
    const efdFill = { "생식발생독성.species": ["랫드", "토끼"], "생식발생독성.tk": "포함", "생식발생독성.glpLevel": "GLP" };
    const late = stage === "3상" || approval;
    if (onc) {
      if (approval) tests.push({ key: "efd", label: "배·태자 발생시험", category: REPRO, item: "배·태자발생(Seg. II)", reason: "진행암 의약품은 허가 신청 때 필요. 수태능과 출생 전후 시험은 필요 없음", basis: "ICH S9 §2.5", rule: "R-A5-16", on: true, fill: efdFill });
      else later.push({ label: "배·태자 발생시험", when: "품목허가 신청 전. 유전독성이 있고 빠르게 분열하는 세포를 표적하는 약물은 예외", basis: "ICH S9 §2.5" });
    } else {
      if ((a.wocbp === "예" || late) && !own("배·태자 발생시험")) {
        const noW = a.wocbp === "아니오" && !approval;
        const small = a.wocbp === "예" && a.wScale === "150명 이하이고 3개월 이하" && a.contra === "예";
        const noContra = a.wocbp === "예" && a.contra === "아니오";
        const euJp = auth.includes("유럽 EMA") || auth.includes("일본 PMDA");
        tests.push({ key: "efd", label: "배·태자 발생시험 · 랫드와 토끼", category: REPRO, item: "배·태자발생(Seg. II)", reason: noContra ? "고효율 피임 없이 가임 여성을 포함하려면 먼저 완료" : small && !late ? "예비 시험으로 제한적 포함이 가능한 조건입니다. 본시험은 이후 단계에 필요" : noW ? "임상에 가임 여성을 포함하지 않으면 허가 신청 전까지. 필요하면 체크하세요" : late ? "3상 전까지 필요" : euJp ? "유럽·일본은 가임 여성 노출 전에 본시험을 완료" : "미국은 피임 조치 아래 3상 전까지 미룰 수 있음. 필요하면 체크하세요", basis: "ICH M3(R2) §11.3 · ICH S5(R3) 부록 1 표 3", rule: euJp ? "R-A5-04" : "R-A5-05", on: noContra || (!noW && (late || (euJp && !small))), fill: efdFill });
        if (!late) {
          tests.push({ key: "pefd", label: "예비 배·태자 발생시험 · 2종", category: REPRO, item: "배·태자발생 예비(pEFD)", reason: "피임 조치가 있으면 가임 여성 150명 이하, 3개월 이하 투여를 본시험 전에 뒷받침", basis: "ICH M3(R2) §11.3, 주석 4", rule: "R-A5-02", on: small, fill: { "생식발생독성.species": ["랫드", "토끼"] } });
          notes.push({ text: "가임 여성 포함 시 필요한 시험은 인원, 투여기간, 피임 조치, 제출 지역에 따라 달라집니다. 단기(예: 2주) 임상에서 임신 위험을 집중 관리하면 발생독성시험 없이 포함할 수 있는 경우도 있습니다.", basis: "ICH M3(R2) §11.3", rule: "R-A5-02" });
          if (mfds) notes.push({ text: "국내 규정은 수컷·암컷 생식독성 자료를 3상 시작 전까지 내도록 하지만, 가임 여성을 임상에 포함할 때의 배·태자 발생시험 시기는 명시하지 않습니다. 제출 전에 식약처와 확인하세요.", basis: "의약품 임상시험 계획 승인에 관한 규정 별표 1 주 3, 4", rule: "R-A5-06" });
        }
        if (noContra) {
          notes.push({ text: "고효율 피임을 하지 않는 가임 여성을 포함하려면 모든 여성 생식독성시험과 유전독성 표준 배터리를 먼저 완료해야 합니다. 수태능과 출생 전후 발생시험의 시기도 함께 검토하세요.", basis: "ICH M3(R2) §11.3", rule: "" });
          for (const t of tests) if (t.category === "유전독성") t.on = true;
        }
        if (small && !late) notes.push({ text: "예비 시험을 임상 진입 근거로 쓰려면 군당 임신동물 최소 6마리, 기관형성기 투여, 태자 생존·체중·외표·내장 검사를 갖추고 높은 과학적 수준 또는 GLP로 수행해야 합니다.", basis: "ICH M3(R2) 주석 4", rule: "R-A5-02" });
        notes.push({ text: "한 종에서 명백한 기형이나 배·태자 치사가 나오면 두 번째 종 시험은 필요 없을 수 있습니다. 일정에 여유가 있으면 순차 착수를 검토하세요.", basis: "ICH S5(R3) §4.2", rule: "R-A5-10" });
        prereq.push("토끼 혈장 생체시료 분석법 검증 (토끼 독성동태 포함 시)");
        askCro.add("임신동물 확보 방식과 교배 시작 동물 수");
        askCro.add("생식독성 독성동태의 채혈 방식(본시험 동물·위성군)과 예상 검체 수");
        askCro.add("태자 검사 범위(전수·절반)와 용량설정시험의 견적 포함 여부");
      } else if (!own("배·태자 발생시험")) {
        later.push({ label: "배·태자 발생시험", when: "가임 여성을 임상에 포함하기 전 (지역과 조건에 따라 다름)", basis: "ICH M3(R2) §11.3" });
      }
      if (late && !own("수태능 시험")) {
        tests.push({ key: "feed", label: "수태능 및 초기배 발생시험", category: REPRO, item: "수태능·초기배발생(Seg. I)", reason: "대규모 또는 장기 임상(예: 3상) 개시 전에 완료", basis: "ICH M3(R2) §11.1, §11.3", rule: "R-A5-07", on: true });
        notes.push({ text: mfds ? "수태능 시험의 수컷 교배 전 투여는 국내 기준으로 4주가 기본이며, 2주로 하려면 타당성 설명이 필요합니다." : "수태능 시험의 수컷 교배 전 투여는 반복투여독성에서 막는 소견이 없으면 2주로 할 수 있습니다.", basis: mfds ? "고시 별표 3 ⑤2가(1)5, 별표 13 주18" : "ICH S5(R3) 부록 1 표 2", rule: mfds ? "R-A5-11" : "R-A5-12" });
      } else if (!late) {
        later.push({ label: "수태능 및 초기배 발생시험", when: "3상 등 대규모·장기 임상 개시 전. 그 전에는 반복투여독성의 생식기관 조직검사가 근거", basis: "ICH M3(R2) §11.1, 주석 2" });
      }
      if (approval) {
        tests.push({ key: "ppnd", label: "출생 전후 발생시험", category: REPRO, item: "출생전후발생(Seg. III)", reason: "허가 신청 시 제출", basis: "ICH M3(R2) §11.3", rule: "R-A5-08", on: true });
        askCro.add("출생 전후 발생시험의 행동·기능 검사 항목과 방법");
      } else {
        later.push({ label: "출생 전후 발생시험", when: "품목허가 신청 시", basis: "ICH M3(R2) §11.3" });
      }
    }
  }
  if (!approval && !research && (onc ? !oncLate : ["1개월 이내", "2주 이내", "단회", "미정"].includes(dur))) later.push(onc ? { label: "반복투여 13주 (임상 일정을 따른 3개월 시험)", when: "3상 개시 전", basis: "ICH S9 §3.4" } : { label: "더 긴 반복투여독성 (13주 이상)", when: "임상 투여기간이 늘어날 때", basis: "ICH M3(R2) 표 1" });
  /* ── 약물동태 (기술문서 B2) ── */
  if (!research) {
    const PK = "PK/TK/ADME·생체시료분석";
    if (!own("체외 대사")) {
      tests.push({ key: "adme-met", label: "체외 대사 (동물과 사람 비교)", category: PK, item: "체외 대사 안정성·종간 비교", reason: "임상 개시 전에 동물과 사람의 체외 대사 자료가 필요. 독성시험 동물종이 적절한지 판단하는 근거", basis: "ICH M3(R2) §3", rule: "R-B2-01", on: true });
      tests.push({ key: "adme-ppb", label: "혈장단백결합", category: PK, item: "혈장단백결합", reason: "임상 개시 전 필요", basis: "ICH M3(R2) §3", rule: "R-B2-01", on: true });
    }
    const beyond1 = stage !== "1상 진입";
    const ddiWhy = beyond1 ? "더 큰 규모의 환자 시험 전에 필요" : "환자 대상 시험이 커지기 전까지. 지금 하려면 체크하세요";
    tests.push({ key: "ddi-inh", label: "효소 억제 체외 시험", category: PK, item: "CYP 억제", reason: ddiWhy, basis: "ICH M12 §1.4", rule: "R-B2-04", on: beyond1 });
    tests.push({ key: "ddi-ind", label: "효소 유도 체외 시험", category: PK, item: "CYP 유도", reason: ddiWhy, basis: "ICH M12 §1.4", rule: "R-B2-04", on: beyond1 });
    notes.push({ text: "약물동태 시험은 대부분 GLP 요구가 없고, 체외 상호작용 시험은 GLP가 요구되지 않습니다. 다만 국내 허가 자료는 분석방법과 밸리데이션이 포함돼야 합니다.", basis: "ICH M12 §7.3.1 · 품목허가·신고·심사 규정 제7조제5호", rule: "R-B2-09" });
    if (!beyond1) notes.push({ text: "반복투여독성의 독성동태 검체를 보관해 두면, 나중에 사람 대사체가 확인됐을 때 동물 노출과 비교하는 데 쓸 수 있습니다. 사람 노출의 10%를 넘는 대사체는 동물에서 충분히 노출됐는지 3상 전에 확인합니다.", basis: "ICH M3(R2) §3, 질의응답 2장", rule: "R-B2-06" });
    later.push({ label: stage === "3상" || approval ? "동물 조직분포·배설 시험, 사람 물질수지 시험" : "동물 조직분포·배설 등 추가 약물동태", when: "3상 전. 방사성 표지 물질이 필요하면 합성 기간을 감안", basis: "ICH M3(R2) §3 · ICH M12 §1.4" });
    askCro.add("약물동태·체외 시험의 설계(동물 수, 시점, 농도)와 예상 검체 수, 분석법 검증 포함 여부");
  }

  /* ── 소아, 의존성 (기술문서 A3, A14) ── */
  if (!research) {
    const ped = String(a.ped ?? "");
    if (ped.startsWith("예")) {
      tests.push({ key: "juv", label: "발육기동물 독성시험", category: "일반독성", item: "발육기동물 독성", reason: (ped.includes("2세 미만") ? "2세 미만이 대상이면 필요할 가능성이 높은 조건입니다. " : "") + "기존 자료가 부족할 때만 필요하며, 규제기관과 먼저 협의하세요", basis: "ICH S11 §1.4, §2.2 · ICH M3(R2) §12", rule: "R-A3-02", on: false });
      notes.push({ text: "발육기동물시험이 필요한지는 최연소 대상 연령, 발달 중인 장기에 대한 영향, 기존 자료, 약리 표적, 임상 투여기간을 함께 보고 판단합니다. 단기 소아 약동학 시험에는 일반적으로 필요 없고, 장기 소아 임상에 필요하면 임상 개시 전에 완료합니다.", basis: "ICH S11 §2.2 · ICH M3(R2) §12", rule: "R-A3-02" });
      askCro.add("발육기동물시험의 새끼 확보·한배 배정 방법, 가능한 최소 투여 일령, 수행 가능한 추가 평가항목");
    }
    if (a.cns === "예") {
      if (stage === "3상" || approval) tests.push({ key: "dep", label: "의존성 평가 (금단 평가 등)", category: "안전성약리", item: "의존성 · 금단 평가", reason: "중추신경계에 작용하는 약물은 남용 가능성을 검토합니다. 신호가 있거나 새로운 작용기전이면 시험이 필요. 해당하면 체크하세요", basis: "ICH M3(R2) §15 · 품목허가·신고·심사 규정 제7조제4호다목", rule: "R-A14-03", on: false });
      else later.push({ label: "의존성 평가 (자가투여, 약물변별, 금단)", when: "3상 전. 신호가 있거나 새로운 작용기전일 때", basis: "ICH M3(R2) §15" });
      notes.push({ text: "중추신경계 작용 약물은 수용체 결합과 행동 관찰 같은 조기 지표를 사람 최초 투여 전에 확보합니다. 안전성약리와 반복투여독성의 관찰 결과를 함께 씁니다. 미국과 유럽은 자가투여 방식과 GLP 요구가 다르고, 국내는 시험방법 규정이 없습니다. 금단 평가는 반복투여독성의 회복군에 넣을 수 있습니다.", basis: "ICH M3(R2) §15", rule: "R-A14-02" });
    }
  }

  /* ── 흡입 경로 (기술문서 A2) ── */
  if (String(a.route ?? "") === "흡입" && !research) {
    for (const t of tests) if (t.key.startsWith("repeat") || t.key === "drf" || t.key === "single") { t.label = t.label.replace("반복투여", "반복 흡입").replace("단회투여독성", "단회 흡입독성"); t.basis += " · 고시 별표 10, 11"; }
    notes.push({ text: "흡입 경로는 흡입독성시험으로 수행합니다. 수행 가능한 기관이 제한되고, 에어로졸 발생 조건 설정과 챔버 농도 분석법이 먼저 필요합니다. 시험물질 소요량이 경구 시험보다 훨씬 많습니다.", basis: "고시 별표 10, 11 · OECD TG 412, 413", rule: "R-A1-17" });
    notes.push({ text: "흡입제의 고용량은 혈중 노출과 폐 침착 계산량을 함께 봅니다. 전신작용은 임상 노출의 50배와 폐 침착량의 10배, 국소작용은 폐 침착량의 50배와 임상 노출의 10배입니다.", basis: "고시 별표 13 주61 · ICH M3(R2) 질의응답", rule: "R-A1-17" });
    if (overseas) notes.push({ text: "OECD 2018년 개정 시험법은 기관지폐포세척이 필수입니다. 국내 고시에는 없으므로 어느 기준으로 할지 정해야 합니다.", basis: "OECD TG 412, 413", rule: "R-A1-17" });
    prereq.push("에어로졸 발생 조건 설정과 챔버 농도 분석법 (흡입독성 착수 전)");
    askCro.add("흡입 노출 방식(비부·전신), 입자 크기 측정, 기관지폐포세척 포함 여부, 예상 시험물질 소요량");
  }

  /* ── 발암성 (기술문서 A6) ── */
  if (!research && !onc) {
    const longUse = ["3개월 이내", "6개월 이내", "6개월 초과·만성"].includes(dur);
    if (longUse && (stage === "3상" || approval)) {
      tests.push({ key: "carc", label: "발암성시험 (장기 설치류 1건 + 추가 시험 1건)", category: "발암성·종양원성", item: "장기발암성(2년)", reason: "임상 사용이 6개월 이상 예상되면 허가 신청 때 필요. 3개월 투여 적응증도 대부분 해당. 국내 기준은 대다수 사용례가 6개월 초과. 필요하면 체크하세요", basis: "ICH S1A §4.1 · ICH M3(R2) §10 · 품목허가·신고·심사 규정 제7조제4호다목", rule: "R-A6-02", on: false });
      notes.push({ text: "발암성시험은 명백한 유전독성 물질, 기대여명이 짧은 환자 대상 의약품에는 필요 없을 수 있습니다. 이미 가진 자료로 평가해 2년 랫드 시험을 생략할 수 있는 경우도 있으나 규제기관 협의가 필요하고, 국내 고시에는 이 접근이 없습니다. 용량은 착수 전에 규제기관과 협의하는 것이 일반적입니다.", basis: "ICH S1A §4.3, §4.4 · ICH S1B(R1) 부록", rule: "R-A6-10" });
      prereq.push("발암성 용량설정시험 (본시험과 같은 계통·경로의 90일 시험. 마우스 시험을 하면 마우스에서도)");
      askCro.add("발암성시험의 동물 계통과 배경자료 보유 기간, 형질전환 마우스 시험의 표준 설계");
    } else if (longUse) {
      later.push({ label: "발암성시험", when: "품목허가 신청 시. 2년 투여와 용량설정시험 기간을 감안해 착수 시점을 미리 검토", basis: "ICH S1A §4.1 · ICH M3(R2) §10" });
    }
  }

  /* ── 면역독성·항원성·국소내성·광안전성 (기술문서 A8~A12) ── */
  if (!research) {
    const routeA = String(a.route ?? "");
    const parenteral = ["정맥", "피하", "근육"].includes(routeA);
    if (tests.some((t) => t.key.startsWith("repeat") && t.on)) {
      notes.push({ text: "면역독성은 먼저 반복투여독성시험 안에서 평가합니다. 흉선·비장 중량과 림프절·골수 조직병리가 견적에 포함됐는지 확인하세요. 추가 면역독성시험은 소견이나 약리작용으로 우려가 있을 때만 하며, 통상 3상 전까지입니다.", basis: "ICH S8 §2.1, §4, 부록 §1", rule: "R-A9-01" });
      if (parenteral) {
        notes.push({ text: "주사제의 국소내성은 반복투여독성시험에서 임상 제형 또는 유사 제형으로 투여 부위를 조직병리 검사하면 별도 시험을 생략할 수 있습니다.", basis: "ICH M3(R2) §8 · 고시 별표 9", rule: "R-A11-02" });
        askCro.add("투여 부위 조직병리의 채취 방법과 견적 포함 여부");
      }
    }
    if (routeA === "정맥" && (auth.includes("유럽 EMA") || auth.includes("일본 PMDA"))) later.push({ label: "정맥 주위 단회 투여 국소내성 시험", when: "3상 전. 유럽·일본은 권장, 미국은 일반적으로 권장하지 않음", basis: "ICH M3(R2) §8" });
    if (topical) {
      tests.push({ key: "skin-irr", label: "피부자극시험", category: "국소독성", item: "피부 1차 자극", reason: "피부·점막에 직접 적용하는 의약품. 피부에 쓰지 않는 제품이면 빼세요", basis: "품목허가·신고·심사 규정 · 고시 별표 8", rule: "R-A11-06", on: true });
      tests.push({ key: "eye-irr", label: "안점막자극시험", category: "국소독성", item: "안점막 자극(세안군 비적용)", reason: "점안제이거나 눈에 닿을 수 있는 제품이면 체크하세요", basis: "고시 별표 8 · 제4조", rule: "R-A11-07", on: false });
      tests.push({ key: "skin-sens", label: "피부감작성시험", category: "항원성·면역독성", item: "피부감작성 GPMT", reason: "피부외용제에 실시. 국내 고시의 시험법은 기니피그 Maximization", basis: "고시 별표 5 ① · EMA 국소내성 가이드라인 §7.5", rule: "R-A8-04", on: true });
      if (mfds && overseas) notes.push({ text: "자극·감작성 시험은 국내 고시와 OECD 시험법의 동물 수가 다릅니다. 어느 설계로 할지 제출처와 확인하세요. 동물을 쓰지 않는 시험으로 대신할 수 있는지도 검토할 수 있습니다.", basis: "고시 별표 5, 8 · OECD TG 404, 405, 406", rule: "R-A11-08" });
      askCro.add("자극·감작성 시험의 동물 수와 판정 기준");
    }
    if (mfds && !onc) {
      tests.push({ key: "asa", label: "항원성시험 · 능동 전신 아나필락시스(ASA)", category: "항원성·면역독성", item: "ASA(능동전신아나필락시스)", reason: "국내 제출 대상은 전신 투여하는 고분자·단백성 의약품과 합텐이 될 가능성이 있는 저분자입니다. 해당 여부는 식약처에 확인하세요. ICH 지역에서는 요구되지 않습니다", basis: "품목허가·신고·심사 규정 제7조제4호다목 · 고시 별표 5 · ICH S8 §1.2", rule: "R-A8-02", on: false });
      tests.push({ key: "pca", label: "항원성시험 · 수동 피부 아나필락시스(PCA)", category: "항원성·면역독성", item: "PCA(수동피부아나필락시스)", reason: "ASA와 같습니다", basis: "고시 별표 5, 별표 13 주44", rule: "R-A8-02", on: false });
      askCro.add("항원성시험의 군 구성 (용량, 보조제 유무, 결합체 포함 여부)");
    }
    notes.push({ text: "광안전성은 흡광도부터 확인합니다. 290~700 nm에서 몰흡광계수가 1000을 넘지 않으면 추가 평가가 필요 없습니다. 넘으면 3상 전까지 시험이나 임상 평가가 필요하고, 그 전 외래 임상에서는 차광 조치를 검토합니다." + (mfds ? " 국내 독성시험기준에는 광독성 규정이 없습니다." : ""), basis: "ICH S10 §2.1, §5 · ICH M3(R2) §14", rule: "R-A12-01" });
  }

  if (!research && stage !== "1상 진입") later.push({ label: "사람 주요 대사체의 노출 평가", when: "3상 전. 사람에서 총 노출의 10%를 넘는 대사체가 있을 때", basis: "ICH M3(R2) §3" });
  if (overseas) notes.push({ text: "해외 제출이 포함되어 있습니다. 영문 보고서가 필요한지, 미국 제출이면 SEND 자료가 필요한지 확인하세요.", basis: "", rule: "R-A1-21" });
  if (research) notes.push({ text: "자체 연구용으로 보고 GLP를 지정하지 않았습니다. 나중에 허가 자료로 쓰려면 GLP로 다시 해야 합니다.", basis: "", rule: "" });

  const seen = new Set<string>();
  const uniq = notes.filter((n) => !seen.has(n.text) && !!seen.add(n.text)).map((n) => ({ ...n, topic: topicOf(n) }));
  return { supported: true, tests, owned, later, notes: uniq, askCro: [...askCro], prereq };
}

/* ── 요청서 값으로 옮기기 ─────────────────────────────── */

const AUTH_MAP: Record<string, string> = { "식약처": "식약처(MFDS)", "미국 FDA": "US FDA", "유럽 EMA": "EMA", "일본 PMDA": "PMDA(일본)", "기타": "기타" };
const ROUTE_MAP: Record<string, string> = { "경구": "경구(PO)", "정맥": "정맥(IV)", "피하": "피하(SC)", "근육": "근육(IM)", "국소 적용(피부·점안 등)": "경피·피부", "흡입": "흡입", "기타": "기타" };

/** 세부 항목 필드 id (일반독성은 items, 생식은 segment) */
const ITEMS_FIELD: Record<string, string> = { "생식발생독성": "segment" };

export function toRequestValues(a: Answers, advice: Advice, selected: Set<string>): Values {
  const v: Values = {};
  const add = (key: string, vals: string[]) => {
    const cur = Array.isArray(v[key]) ? (v[key] as string[]) : [];
    v[key] = [...new Set([...cur, ...vals])];
  };
  const hf = a.product === HF;
  v.purpose = a.stage === "자체 연구" ? "자체 연구용" : "허가자료 제출용";
  if (hf) { v.authority = ["식약처(MFDS)"]; v.route = "경구(PO)"; }
  const pr = String(a.product ?? "");
  if (pr === "화장품" || pr === "의료기기") v.authority = ["식약처(MFDS)"];
  if (pr === "화학물질·농약") v.authority = [String(a.chType ?? "").startsWith("농약") ? "농촌진흥청" : "기후에너지환경부·국립환경과학원"];
  v.devField = pr === "화장품" ? "화장품" : pr === "의료기기" ? "의료기기" : pr === "화학물질·농약" ? (String(a.chType ?? "").startsWith("농약") ? "농약·작물보호제" : "일반화학물질") : hf ? "건강기능식품" : a.product === "바이오의약품" ? (a.bioType === "백신" ? "백신" : "의약품(바이오·생물학적제제)") : "의약품(합성)";
  const auth = arr(a.auth).map((x) => AUTH_MAP[x]).filter(Boolean);
  if (auth.length) v.authority = auth;
  const route = ROUTE_MAP[String(a.route ?? "")];
  if (route) { v.route = route; v.clinRoute = route; }
  if (a.duration && a.duration !== "미정") v.clinDuration = String(a.duration);
  if (auth.some((x) => x !== "식약처(MFDS)")) add("reportLang", ["영문"]);

  for (const t of advice.tests) {
    if (!selected.has(t.key)) continue;
    add("categories", [t.category]);
    if (t.item !== t.category) add(`${t.category}.${ITEMS_FIELD[t.category] ?? "items"}`, [t.item]);
    for (const [k, val] of Object.entries(t.fill ?? {})) {
      if (Array.isArray(val)) add(k, val);
      else if (v[k] === undefined) v[k] = val;
    }
  }

  // 기관과 의뢰자 화면에 함께 전달되는 기록
  v.advisorUsed = "예";
  v.advisorAnswers = visibleQuestions(a)
    .map((q) => { const x = arr(a[q.id]); return x.length ? `${q.q.replace(/\?$/, "")}: ${x.join(", ")}` : ""; })
    .filter(Boolean);
  v.advisorAsk = advice.askCro;
  v.advisorNotes = advice.notes.map((n) => (n.basis ? `${n.text} (${n.basis})` : n.text));
  v.advisorPrereq = advice.prereq;
  return v;
}

/* ── 바이오의약품 (기술문서 F1) ───────────────────────────
 * 합성의약품과 달리 정해진 시험 목록이 없다. 약리학적 관련 종에서 설계가 출발한다.
 * 세포·유전자치료제는 아직 제안하지 않는다.
 */
function adviseBio(a: Answers): Advice {
  const tests: Suggest[] = [];
  const notes: Note[] = [];
  const later: Later[] = [];
  const askCro = new Set<string>();
  const prereq: string[] = [];
  const type = String(a.bioType ?? "");
  if (type === "세포·유전자치료제") {
    return {
      supported: false,
      message: "세포·유전자치료제의 제안은 준비 중입니다. 이 유형은 체내 분포와 종양원성 평가가 핵심이며, 제품 특성에 맞춰 설계합니다. 지금은 시험 항목을 직접 골라 요청해 주세요.",
      tests: [], owned: [], later: [], notes: [], askCro: [], prereq: [],
    };
  }

  const stage = String(a.stage ?? "");
  const research = stage === "자체 연구";
  const approval = stage === "품목허가";
  const late = stage === "3상" || approval;
  const auth = arr(a.auth);
  const mfds = auth.includes("식약처");
  const overseas = auth.some((x) => x !== "식약처");
  const onc = a.indication === "진행암";
  const sp = String(a.bioSpecies ?? "아직 확인 안 함");
  const dur = String(a.duration ?? "미정");
  const owned = arr(a.prior).filter((p) => p !== "없음");
  const own = (s: string) => owned.some((p) => p.startsWith(s));
  const vaccine = type === "백신";
  const similar = type === "동등생물의약품";
  const adc = type === "항체약물접합체";
  const antibody = type === "단클론항체" || adc;
  const PK = "PK/TK/ADME·생체시료분석";
  const glp = research ? "미정" : "GLP";

  // 동물종: 관련 종이 확인된 경우에만 채운다
  const speciesFill: string[] = sp === "영장류만" ? ["원숭이(영장류)"] : sp === "설치류만" ? ["랫드"] : sp === "설치류와 비설치류 모두" ? ["랫드", "원숭이(영장류)"] : [];
  if (sp === "아직 확인 안 함" && !vaccine) {
    prereq.unshift("약리학적 관련 종 확인 (결합 친화도, 기능 활성 비교). 확인 전에는 독성시험 동물종을 정할 수 없음");
    notes.push({ text: "바이오의약품의 독성시험은 약리 활성이 나타나는 동물종(관련 종)에서 해야 합니다. 관련 없는 종의 시험은 권장되지 않습니다. 종 교차반응성 자료부터 확인하세요.", basis: "ICH S6(R1) 1부 §3.3, 2부 §2.1", rule: "R-F1-02" });
  }
  if (sp === "관련 종 없음") {
    notes.push({ text: "관련 종이 없으면 표준 독성시험이 맞지 않습니다. 사람 표적을 발현하는 형질전환 동물이나 상동 단백질을 고려하고, 불가능하면 1종에서 14일 이하의 제한 평가를 합니다. 규제기관과 먼저 협의하세요.", basis: "ICH S6(R1) 1부 §3.3", rule: "R-F1-06" });
  }

  /* 반복투여독성 */
  if (sp !== "관련 종 없음") {
    let item = "반복투여 4주";
    let why = "임상 투여기간에 맞춘 반복투여독성";
    let basis = "ICH S6(R1) 1부 §4.4, 2부 §3.2";
    if (vaccine) { why = "면역반응을 보이는 1종에서 간격 투여. 투여 횟수는 사람 예정 횟수와 같거나 그 이상"; basis = "WHO 백신 비임상 평가 가이드라인 §4.1"; }
    else if (onc) { item = late ? "반복투여 13주" : "반복투여 4주"; basis = late ? "ICH S9 §3.4" : "ICH S9 §3.3"; why = late ? "3상 개시 전 제출. 임상 일정을 따른 3개월 시험" : "임상 투여 일정에 맞춘 1상용 독성시험"; }
    else if (dur === "6개월 초과·만성" || dur === "6개월 이내") { item = "반복투여 26주"; why = "만성 적응증은 6개월로 충분합니다. 9개월 시험은 필요하지 않습니다"; }
    else if (dur === "3개월 이내") item = "반복투여 13주";
    else if (dur === "단회" || dur === "2주 이내") item = "반복투여 2주";
    const weeks = parseInt(item.replace(/\D/g, ""), 10);
    if (!own(`반복투여 ${weeks}주`)) {
      const fill: Record<string, string | string[]> = { "일반독성.tk": research || vaccine ? "미정" : "포함", "일반독성.histopath": "포함", "일반독성.glpLevel": glp, "일반독성.recovery": weeks >= 13 ? "4주" : "2주" };
      if (speciesFill.length && !vaccine) fill["일반독성.species"] = speciesFill;
      tests.push({
        key: "repeat", label: similar ? `${item} (대조약과 비교 설계)` : vaccine ? `${item} · 면역반응을 보이는 1종` : `${item} · 관련 종`, category: "일반독성", item,
        reason: similar ? "관련 종에서 대조약과 비교하는 반복투여독성 1건. 국내는 품질과 약리의 비교동등성이 입증되면 면제할 수 있습니다. 필요하면 체크하세요" : why,
        basis: similar ? "동등생물의약품 평가 가이드라인 §6 · 생물학적제제 등의 품목허가·심사 규정 제24조제5항" : basis,
        rule: similar ? "R-F1-14" : vaccine ? "R-F1-13" : "R-F1-03", on: !similar, fill,
      });
      if (!vaccine) notes.push({ text: "회복 평가는 최소 1개 시험의 1개 용량에 둡니다. 목적은 가역성 확인이며 완전한 회복을 입증할 필요는 없습니다. 고용량은 최대 약리 효과 용량과 임상 최대 노출의 약 10배 중 높은 쪽입니다.", basis: "ICH S6(R1) 2부 §3.1, §3.3", rule: "R-F1-03" });
      if (sp === "설치류와 비설치류 모두" && !vaccine && !similar) notes.push({ text: "관련 종이 설치류와 비설치류 모두이면 1개월 이하 단기 시험은 2종으로 합니다. 두 종의 소견이 비슷하면 장기 시험은 1종(설치류 우선)으로 줄일 수 있습니다.", basis: "ICH S6(R1) 2부 §2.2", rule: "R-F1-05" });
      if (!vaccine) notes.push({ text: "항약물항체 시료는 독성시험에서 미리 채취해 둡니다. 분석은 노출이나 약리 활성이 설명되지 않게 변할 때 합니다. 채취와 분석을 나눠 견적받으세요.", basis: "ICH S6(R1) 2부 4장", rule: "R-F1-07" });
      notes.push({ text: "국소내성은 반복투여독성에서 투여 부위를 평가하면 별도 시험이 필요 없습니다.", basis: vaccine ? "WHO 백신 비임상 평가 가이드라인 §4.1.5" : "ICH S6(R1) 1부 §4.9", rule: "R-F1-03" });
      askCro.add("군당 동물 수, 용량군 수, 회복기 길이 (가이드라인에 수치가 없음)");
      if (!vaccine) askCro.add("항약물항체 시료 채취 시점과 분석 포함 여부");
      if (sp === "영장류만") askCro.add("영장류 확보 예상 기간과 동물비 포함 여부");
      if (vaccine) askCro.add("백신 투여 횟수와 간격, 사용 동물종");
    }
  }

  /* 시험하지 않는 것 */
  notes.push({
    text: vaccine ? "백신 최종 제형에는 유전독성, 발암성, 약동학 시험이 통상 필요하지 않습니다. 신규 면역증강제나 첨가제가 있으면 필요할 수 있습니다." : similar ? "동등생물의약품은 안전성약리, 생식독성, 유전독성, 발암성 시험이 필요하지 않습니다. 대조약의 독성 특성이나 반복투여 결과에 따라 추가될 수 있습니다." : "바이오의약품은 유전독성 표준 배터리, 대사·물질수지 시험이 통상 필요하지 않습니다. 발암성은 표준 시험 대신 가진 자료로 평가합니다.",
    basis: vaccine ? "WHO 백신 비임상 평가 가이드라인 §4.2" : similar ? "동등생물의약품 평가 가이드라인 §6" : "ICH S6(R1) 1부 §4.2, §4.7, 2부 6장", rule: "R-F1-01",
  });

  /* 조직교차반응성 */
  if (antibody && !research) tests.push({ key: "tcr", label: "조직교차반응성 (인체 조직)", category: "기타(임상병리·조직병리 등)", item: "조직교차반응성(인체 조직)", reason: "항체 의약품의 초회 임상 투여를 뒷받침하는 권장 구성요소", basis: "ICH S6(R1) 1부 §3.2, 2부 주석 1", rule: "R-F1-08", on: true });

  /* 안전성약리 */
  if (!research && !vaccine && !similar && !onc && sp !== "관련 종 없음") {
    tests.push({ key: "sp-cv", label: "안전성약리 · 심혈관계", category: "안전성약리", item: "심혈관계(Telemetry)", reason: "바이오의약품은 안전성약리를 독성시험에 통합할 수 있습니다. 독립 시험으로 하려면 체크하세요", basis: "ICH S6(R1) 1부 §4.1", rule: "R-F1-09", on: false });
    askCro.add("안전성약리 항목을 독성시험에 통합하는 방식");
  }

  /* 분석 */
  if (!research && !vaccine && tests.some((t) => t.key === "repeat")) {
    // 반복투여독성을 하지 않으면(동등생물의약품의 기본값) 따라오는 분석도 해제해 둔다
    const withTox = tests.find((t) => t.key === "repeat")!.on;
    if (!own("생체시료 분석법 검증")) {
      tests.push({ key: "ba-val", label: "생체시료 분석법 검증 (약물 농도)", category: PK, item: "분석법 검증(Full)", reason: "독성동태 검체를 분석하려면 검증된 분석법이 필요. 검증된 방법 하나면 통상 충분", basis: "ICH S6(R1) 1부 §4.2.2 · ICH M10", rule: "R-B1-05", on: withTox });
      prereq.push("생체시료 분석법 검증 (독성시험 착수 전 완료)");
    }
    tests.push({ key: "tk", label: "독성동태(TK) 검체 분석", category: PK, item: "TK(독성동태)", reason: "동물의 실제 노출 확인. 항약물항체로 노출이 떨어지는지 함께 봅니다", basis: "ICH S6(R1) 1부 §4.4", rule: "R-B1-01", on: withTox });
    tests.push({ key: "ada", label: "항약물항체(ADA) 분석", category: PK, item: "항약물항체(ADA) 분석", reason: "시료는 채취하되 분석은 조건부입니다. 분석까지 견적에 넣으려면 체크하세요", basis: "ICH S6(R1) 2부 4장", rule: "R-F1-07", on: false });
    tests.push({ key: "form-conc", label: "조제물분석 · 함량", category: "조제물분석", item: "함량", reason: "투여한 조제물의 농도 확인. GLP 시험에 따라옵니다", basis: "OECD GLP 원칙 II.6.2.5", rule: "R-B4-01", on: withTox });
    tests.push({ key: "form-stab", label: "조제물분석 · 안정성", category: "조제물분석", item: "안정성", reason: "조제 후 투여까지 농도가 유지되는지", basis: "OECD GLP 원칙 II.6.2.5", rule: "R-B4-06", on: withTox });
    askCro.add("분석법(약물 농도, 항약물항체) 개발·검증의 견적 포함 여부와 횟수");
    if (adc) {
      notes.push({ text: "항체약물접합체의 독성동태는 접합체와 독소를 측정하고 유리 항체량을 추정합니다. 분석법이 여러 개 필요합니다. 초회 임상 전에 사람과 독성 종의 체외 혈장 안정성 자료가 있어야 합니다.", basis: "ICH S9 질의응답 4.4, 4.5", rule: "R-F1-15" });
      prereq.push("체외 혈장 안정성 시험 (사람과 독성 종)");
      notes.push({ text: "접합체 전체가 평가 대상입니다. 항체 단독이나 링커 단독 시험은 일반적으로 필요하지 않습니다. 독소가 신규이면 비접합 독소를 최소 1종에서 추가로 평가합니다.", basis: "ICH S9 질의응답 4.2, 4.3 · ICH S6(R1) 2부 주석 2", rule: "R-F1-15" });
      if (!onc) notes.push({ text: "항체약물접합체의 기준은 항암제 지침에 있습니다. 항암 이외 적응증의 접합체는 전용 지침을 확인하지 못했으니 규제기관과 협의하세요.", basis: "ICH S9 §4.1", rule: "R-F1-15" });
    }
  }

  /* 동등생물의약품: 체외 비교 */
  if (similar) notes.push({ text: "동등생물의약품의 비임상은 대조약과의 비교가 기본입니다. 수용체 결합과 세포 수준의 체외 비교 시험이 먼저이며, 체외 자료로 충분하면 체내 효력시험 없이 제출할 수 있습니다.", basis: "동등생물의약품 평가 가이드라인 §6 · 생물학적제제 등의 품목허가·심사 규정 별표 1 비고", rule: "R-F1-14" });

  /* 생식·발생독성 */
  if (!research && !similar && !onc) {
    if (vaccine) {
      if (a.wocbp === "예") later.push({ label: "발생독성시험 (출생 전후 발생)", when: "임부나 가임 여성이 접종 대상일 때 고려", basis: "WHO 백신 비임상 평가 가이드라인 §4.2.2" });
    } else if (sp === "영장류만") {
      later.push({ label: "확장 출생 전후 발생시험 (영장류)", when: "피임이 충분하면 3상 중 수행해 허가 신청 시 제출. 불충분하면 3상 개시 전", basis: "ICH S6(R1) 2부 §5.3, §5.4" });
      notes.push({ text: "영장류만 관련 종이면 수태능은 성 성숙 영장류의 3개월 이상 반복투여독성에서 생식기관 평가로 대신합니다. 해당 시험에 성 성숙 동물을 쓰는지 확인하세요.", basis: "ICH S6(R1) 2부 §5.2", rule: "R-F1-10" });
    } else if (sp !== "관련 종 없음") {
      later.push({ label: "생식·발생독성시험 (관련 종에서만)", when: a.wocbp === "예" ? "가임 여성 포함 조건과 제출 지역에 따라. 시기는 합성의약품과 같음" : "가임 여성을 임상에 포함하기 전", basis: "ICH S6(R1) 2부 §5.1, §5.4 · ICH M3(R2) §11" });
    }
  }

  /* 국내 */
  if (mfds && !research && !vaccine && !similar) {
    tests.push({ key: "asa", label: "항원성시험 · 능동 전신 아나필락시스(ASA)", category: "항원성·면역독성", item: "ASA(능동전신아나필락시스)", reason: "국내 규정은 전신 투여하는 단백성 의약품에 항원성 자료를 요구합니다. ICH는 이 시험의 가치가 적다고 봅니다. 필요 여부를 식약처에 확인하세요", basis: "생물학적제제 등의 품목허가·심사 규정 별표 1 비고 4 · ICH S6(R1) 1부 §3.6", rule: "R-F1-12", on: false });
    askCro.add("항원성시험의 군 구성");
  }
  if (mfds) notes.push({ text: "국내 제출 범위는 대부분 개별 판단입니다. 국내 규정은 종 수, 기간, 용량을 정하지 않으며 ICH 가이드라인을 준용할 수 있습니다. 시험 구성을 식약처와 미리 협의하는 것이 안전합니다.", basis: "생물학적제제 등의 품목허가·심사 규정 별표 1, 제43조", rule: "R-F1-12" });
  if (overseas) notes.push({ text: "해외 제출이 포함되어 있습니다. 영문 보고서가 필요한지, 미국 제출이면 SEND 자료가 필요한지 확인하세요.", basis: "", rule: "" });
  if (research) notes.push({ text: "자체 연구용으로 보고 GLP를 지정하지 않았습니다. 나중에 허가 자료로 쓰려면 GLP로 다시 해야 합니다.", basis: "", rule: "" });
  if (onc && !adc) notes.push({ text: "항암 바이오의약품은 ICH S9를 따릅니다. 면역 작용성 의약품의 첫 임상 용량은 최소 예상 생물학적 효과 수준을 고려합니다.", basis: "ICH S6(R1) 2부 §1.3 · ICH S9 §3.1", rule: "R-F1-03" });

  const seen = new Set<string>();
  const uniq = notes.filter((n) => !seen.has(n.text) && !!seen.add(n.text)).map((n) => ({ ...n, topic: n.rule.startsWith("R-F1") ? "바이오의약품" : topicOf(n) }));
  return { supported: true, tests, owned, later, notes: uniq, askCro: [...askCro], prereq };
}

/* ── 건강기능식품 (기술문서 F2) ───────────────────────────
 * 독성시험이 필요한지는 원료의 성격(섭취 경험, 제조 방법, 섭취량)으로 정해진다.
 * 최종 구분은 식약처가 판단한다. 여기서는 해당 가능성을 안내한다.
 */
function adviseHf(a: Answers): Advice {
  const tests: Suggest[] = [];
  const notes: Note[] = [];
  const later: Later[] = [];
  const askCro = new Set<string>();
  const prereq: string[] = [];
  const kind = String(a.hfKind ?? "");
  const adverse = a.hfAdverse === "예";
  const more = a.hfIntake === "예" || a.hfIntake === "근거 자료 없음";
  const food = String(a.hfFood ?? "모름");
  const owned = arr(a.prior).filter((p) => p !== "없음");
  const own = (s: string) => owned.some((p) => p.startsWith(s));
  const BASIS = "건강기능식품 기능성 원료 및 기준·규격 인정에 관한 규정 별표 3";

  // 별표 3 의사결정도
  let need: boolean;
  let why: string;
  if (kind === "섭취 경험이 있는 원료 자체" || kind === "단순 추출물 (물·주정·이산화탄소)") {
    need = adverse || more;
    why = adverse ? "알려진 부작용이 있는 원료" : more ? "제안 섭취량이 평소 섭취량보다 많거나 근거 자료가 없는 경우" : "섭취 경험이 있고 섭취량이 늘지 않은 원료";
  } else if (kind === "그 밖의 추출·정제·발효" || kind === "합성 원료") {
    need = food !== "예" || more;
    why = food !== "예" ? "식품이나 식품첨가물로 쓸 수 있는지 확인되지 않은 원료" : more ? "제안 섭취량이 평소 섭취량보다 많거나 근거 자료가 없는 경우" : "식품으로 쓸 수 있고 섭취량이 늘지 않은 원료";
    if (kind === "합성 원료" && food !== "예") notes.push({ text: "합성 원료가 식품이나 식품첨가물로 쓸 수 없고 천연에 존재하는 단일물질과도 같지 않으면 기능성 원료로 신청할 수 없습니다. 먼저 확인하세요.", basis: BASIS, rule: "R-F2-03" });
  } else {
    need = true;
    why = "섭취 경험이 없는 원료";
  }

  notes.push({ text: need ? `${why}에 해당해 독성시험 자료가 필요한 구분으로 보입니다. 기본은 단회투여독성, 90일 반복투여독성, 유전독성입니다.` : `${why}에 해당해 섭취 근거, 안전성 정보, 섭취량평가 자료로 가능한 구분으로 보입니다. 독성시험은 필요하지 않을 수 있어 해제해 두었습니다.`, basis: `${BASIS} 의사결정도, 주 5`, rule: need ? "R-F2-02" : "R-F2-01" });
  notes.push({ text: "어느 구분에 해당하는지는 식약처가 최종 판단합니다. 여기의 안내는 답하신 내용으로 본 해당 가능성입니다. 제안 섭취량은 식품으로 쓰던 원료면 평균 섭취량의 3배 또는 극단 섭취량과 비교합니다.", basis: `${BASIS} 주요 검토 사항`, rule: "R-F2-08" });

  const reason = (s: string) => (need ? s : `${s}. 독성시험이 필요한 구분이면 체크하세요`);
  const common = { "일반독성.species": ["랫드"], "일반독성.glpLevel": "GLP", "일반독성.histopath": "포함", "일반독성.formulation": "포함" };
  if (!own("단회투여독성")) tests.push({ key: "single", label: "단회투여독성", category: "일반독성", item: "단회(급성)투여독성", reason: reason("기본 독성시험"), basis: `${BASIS} 주 5`, rule: "R-F2-02", on: need, fill: common });
  if (!own("반복투여 13주")) {
    tests.push({ key: "repeat-13", label: "반복투여 13주 (90일)", category: "일반독성", item: "반복투여 13주", reason: reason("기본 독성시험. 건강기능식품은 90일이 기본이며 임상 기간에 따라 달라지지 않습니다"), basis: `${BASIS} 주 5 · OECD TG 408`, rule: "R-F2-05", on: need, fill: common });
    if (!own("용량결정시험")) tests.push({ key: "drf", label: "용량결정시험(DRF) 4주", category: "일반독성", item: "용량결정(DRF) 4주", reason: "고시가 요구하는 시험은 아닙니다. 90일 시험의 용량을 정하려고 하는 경우가 많습니다. 필요하면 체크하세요", basis: "고시 요구 아님", rule: "R-F2-05", on: false });
    askCro.add("용량결정시험의 기간과 본시험 견적 포함 여부, 회복군 포함 여부");
    askCro.add("시험물질 조제 방법과 부형제, 조제 가능한 최고 농도, 고용량 설정 근거");
  }
  if (!own("복귀돌연변이")) tests.push({ key: "ames", label: "복귀돌연변이(Ames)", category: "유전독성", item: "복귀돌연변이(Ames, TG 471)", reason: reason("유전독성 기본 조합"), basis: `${BASIS} 주 5 · 의약품등의 독성시험기준 별표 4`, rule: "R-F2-02", on: need, fill: { "유전독성.glpLevel": "GLP" } });
  if (!own("체외 염색체 손상")) tests.push({ key: "invitro-ca", label: "체외 염색체이상", category: "유전독성", item: "염색체이상 in vitro(TG 473)", reason: reason("유전독성 기본 조합"), basis: `${BASIS} 주 5`, rule: "R-F2-02", on: need });
  if (!own("체내 소핵")) tests.push({ key: "invivo-mn", label: "체내 소핵", category: "유전독성", item: "소핵 in vivo(마우스)", reason: reason("유전독성 기본 조합"), basis: `${BASIS} 주 5`, rule: "R-F2-02", on: need });
  if (tests.some((t) => t.category === "유전독성")) askCro.add("유전독성의 용량 설정 예비시험 포함 여부");

  tests.push({ key: "form-conc", label: "조제물분석 · 함량", category: "조제물분석", item: "함량", reason: "GLP 독성시험에 따라옵니다. 추출물은 지표 성분으로 측정합니다", basis: "OECD GLP 원칙 II.6.2.5", rule: "R-B4-01", on: need });
  tests.push({ key: "form-homo", label: "조제물분석 · 균질성", category: "조제물분석", item: "균질성", reason: "추출물은 현탁 상태인 경우가 많아 필요", basis: "OECD GLP 원칙 II.6.2.5", rule: "R-B4-02", on: need });
  tests.push({ key: "form-stab", label: "조제물분석 · 안정성", category: "조제물분석", item: "안정성", reason: "조제 후 투여까지 농도가 유지되는지", basis: "OECD GLP 원칙 II.6.2.5", rule: "R-B4-06", on: need });
  askCro.add("조제물분석의 지표 성분과 분석법 개발·검증 포함 여부");
  if (a.hfMarker !== "있음") prereq.push("지표 성분과 분석법 확정 (조제물분석에 필요)");
  else prereq.push("조제물 분석법 검증 (독성시험 착수 전 완료)");

  later.push({ label: "생식·발생독성, 항원성, 면역독성, 발암성", when: "기본시험에서 원료와 관련된 이상반응이 있거나 안전성이 확인되지 못했을 때 요구될 수 있음", basis: `${BASIS} 주 5 단서` });
  notes.push({ text: "독성시험 자료는 GLP에 따라 운영된 기관이 OECD 시험 지침에 준하여 시험한 보고서여야 합니다. 원자료를 제출합니다.", basis: "같은 규정 제13조제4호, 제14조제7호다목", rule: "R-F2-05" });
  notes.push({ text: "기능성 자료로 내는 동물시험과 시험관시험은 학술지에 게재된 자료여야 합니다. 독성시험(GLP 보고서)과 요건이 다릅니다.", basis: "같은 규정 제14조제8호다목", rule: "R-F2-09" });
  if (a.hfComplex === "예") notes.push({ text: "복합원료는 원재료별로 각각 판단하고 상호작용 자료를 추가로 냅니다. 복합원료 자체로 독성시험을 하면 추가 자료를 면제받을 수 있습니다.", basis: `${BASIS} 주요 검토 사항`, rule: "R-F2-03" });

  const seen = new Set<string>();
  const uniq = notes.filter((n) => !seen.has(n.text) && !!seen.add(n.text)).map((n) => ({ ...n, topic: n.rule === "R-F2-09" ? "기능성 자료" : n.rule.startsWith("R-F2-0") && ["R-F2-01", "R-F2-02", "R-F2-03", "R-F2-08"].includes(n.rule) ? "독성시험이 필요한가" : "시험 요건" }));
  return { supported: true, tests, owned, later, notes: uniq, askCro: [...askCro], prereq };
}

/* ── 화장품, 의료기기, 화학물질·농약 (기술문서 F2, E1·E2) ───────────────── */

function finish(tests: Suggest[], notes: Note[], later: Later[], askCro: Set<string>, prereq: string[], owned: string[], topic: string): Advice {
  const seen = new Set<string>();
  const uniq = notes.filter((n) => !seen.has(n.text) && !!seen.add(n.text)).map((n) => ({ ...n, topic: n.topic ?? topic }));
  return { supported: true, tests, owned, later, notes: uniq, askCro: [...askCro], prereq };
}

/** 화장품: 동물실험이 금지되어 있어 동물대체시험을 제안한다 */
function adviseCosmetic(a: Answers): Advice {
  const tests: Suggest[] = [];
  const notes: Note[] = [];
  const later: Later[] = [];
  const askCro = new Set<string>();
  const prereq: string[] = [];
  const purpose = String(a.cosPurpose ?? "");
  const listed = a.cosListed === "예";
  const uv = a.cosUv !== "아니오";
  const ALT = "동물대체시험";
  const FUNC = "기능성화장품 심사에 관한 규정";
  const ING = "화장품 원료 사용금지 해제·변경 및 사용기준 지정·변경 심사에 관한 규정";
  const ingredient = purpose === "새 원료의 사용기준 지정";
  const functional = purpose === "기능성화장품 심사";
  const exportUse = purpose === "수출 (상대국 요구)";

  notes.push({ text: "동물실험을 한 화장품이나 그런 원료를 쓴 화장품은 국내에서 유통·판매할 수 없습니다. 그래서 동물을 쓰지 않는 시험으로 제안했습니다. 사용기준 지정, 대체시험법이 없는 경우, 수출 상대국 요구 등은 예외입니다.", basis: "화장품법 제15조의2", rule: "R-F2-20", topic: "동물실험 제한" });

  if (functional && listed) {
    notes.push({ text: "고시된 원료, 국제화장품원료집 수재 원료, 식품공전 원료로 제조하면 안전성 자료를 면제받을 수 있습니다. 시험은 해제해 두었습니다. 안전성이 우려되면 예외입니다.", basis: `${FUNC} 제6조제1항`, rule: "R-F2-21", topic: "면제" });
  }
  const need = !(functional && listed);
  const basis = ingredient ? `${ING} 제4조제4호, 제5조` : functional ? `${FUNC} 제4조, 제5조` : "자율 확인 (법정 요구 없음)";

  tests.push({ key: "skin-corr", label: "피부부식 (재구성 인체 표피)", category: ALT, item: "피부부식 인체피부모델(TG 431)", reason: "피부자극 시험으로는 부식과 자극을 구분할 수 없어 부식 시험을 먼저 합니다. 부식성이 없다고 알려진 원료면 빼세요", basis: "OECD TG 431, 439", rule: "R-E-06", on: false });
  tests.push({ key: "skin-irr", label: "피부자극 (재구성 인체 표피)", category: ALT, item: "피부자극 인체피부모델(TG 439)", reason: "1차 피부자극 자료", basis: `${basis} · OECD TG 439`, rule: "R-F2-20", on: need, fill: { "동물대체시험.glpLevel": "GLP" } });
  tests.push({ key: "eye-irr", label: "안자극 (재구성 인체 각막 상피)", category: ALT, item: "안자극 각막모델(TG 492)", reason: "안점막자극 자료. 이 시험은 자극 없음만 판정합니다. 분류까지 필요하면 시험을 조합해야 합니다", basis: `${basis} · OECD TG 492, 467`, rule: "R-E-05", on: need });
  tests.push({ key: "sens-1", label: "피부감작 · 단백질 결합 (DPRA)", category: ALT, item: "피부감작 DPRA(TG 442C)", reason: "피부감작은 한 시험으로 결론이 나지 않습니다. 핵심사건이 다른 시험 2개로 시작합니다", basis: `${basis} · OECD GL 497`, rule: "R-E-03", on: need });
  tests.push({ key: "sens-2", label: "피부감작 · 각질세포 활성화 (KeratinoSens)", category: ALT, item: "피부감작 KeratinoSens(TG 442D)", reason: "두 번째 시험. 두 결과가 다르면 세 번째가 필요합니다", basis: "OECD GL 497 §41", rule: "R-E-03", on: need });
  tests.push({ key: "sens-3", label: "피부감작 · 수지상세포 활성화 (h-CLAT)", category: ALT, item: "피부감작 h-CLAT(TG 442E)", reason: "앞의 두 시험 결과가 다를 때 필요. 처음부터 하려면 체크하세요", basis: "OECD GL 497 §42", rule: "R-E-03", on: false });
  if (uv) {
    tests.push({ key: "photo", label: "광독성 (3T3 NRU)", category: ALT, item: "광독성 3T3 NRU(TG 432)", reason: "자외선을 흡수하는 원료. 흡수하지 않음을 입증하는 흡광도 자료를 내면 면제됩니다", basis: `${FUNC} 제4조제1호나목(5) · OECD TG 432`, rule: "R-F2-21", on: need && a.cosUv === "예" });
    if (a.cosUv !== "예") prereq.push("자외선 흡수 여부 확인 (흡광도 측정). 흡수하지 않으면 광독성·광감작성 자료 면제");
  } else {
    notes.push({ text: "자외선을 흡수하지 않으면 흡광도 자료로 광독성·광감작성 자료를 면제받습니다. 흡광도 시험성적서를 준비하세요.", basis: `${FUNC} 제4조제1호나목(5)`, rule: "R-F2-21", topic: "면제" });
  }
  if (functional || ingredient) {
    tests.push({ key: "patch", label: "인체첩포시험", category: "기타(임상병리·조직병리 등)", item: "인체첩포시험", reason: "30명 이상. 대학 또는 전문 연구기관에서 5년 이상 경력자의 지도·감독 아래 실시", basis: `${FUNC} 제4조제1호나목(6), 제5조`, rule: "R-F2-20", on: need });
    notes.push({ text: "단회투여독성 자료도 제출 대상입니다. 동물을 쓰지 않는 방법이 제한적이어서 제안에 넣지 않았습니다. 문헌이나 기존 자료로 갈음할 수 있는지, 과학적 타당성으로 생략할 수 있는지 확인하세요.", basis: `${FUNC} 제4조제1호나목`, rule: "R-F2-20", topic: "확인할 자료" });
  }
  if (ingredient) {
    notes.push({ text: "원료 사용기준 지정에는 안전성 자료 11종이 있습니다. 위 시험 외에 반복투여독성, 생식·발생·유전독성·발암성, 흡입독성, 피부흡수 자료가 포함됩니다. 동물대체시험법 적용이 원칙이고, 적용할 수 없으면 동물 시험법을 따릅니다. 타당한 사유가 있으면 생략할 수 있습니다.", basis: `${ING} 제4조제4호, 제5조제1항제4호`, rule: "R-F2-20", topic: "확인할 자료" });
    tests.push({ key: "absorb", label: "피부흡수 (체외)", category: ALT, item: "피부흡수(TG 428)", reason: "원료 사용기준 지정의 안전성 자료", basis: `${ING} 제4조제4호 · OECD TG 428`, rule: "R-F2-20", on: true });
    tests.push({ key: "ames", label: "복귀돌연변이(Ames)", category: "유전독성", item: "복귀돌연변이(Ames, TG 471)", reason: "유전독성 자료. 체외 시험이라 동물을 쓰지 않습니다", basis: `${ING} 제4조제4호`, rule: "R-F2-20", on: true });
    tests.push({ key: "invitro-ca", label: "체외 염색체이상", category: "유전독성", item: "염색체이상 in vitro(TG 473)", reason: "유전독성 자료. 체외 시험", basis: `${ING} 제4조제4호`, rule: "R-F2-20", on: true });
  }
  if (exportUse) notes.push({ text: "수출 상대국이 동물시험 자료를 요구하면 예외에 해당합니다. 상대국의 요구 시험과 시험법을 먼저 확인하고, 직접 고르기로 항목을 추가하세요.", basis: "화장품법 제15조의2", rule: "R-F2-20", topic: "동물실험 제한" });
  if (functional || ingredient) notes.push({ text: "안전성 자료는 비임상시험관리기준에 따라 시험한 자료여야 합니다. 동물대체시험도 GLP로 수행할 수 있는 기관이어야 합니다.", basis: functional ? `${FUNC} 제5조제1호나목(1)` : `${ING} 제5조제1항제4호`, rule: "R-E-02", topic: "시험 요건" });
  notes.push({ text: "대체시험은 물질에 따라 쓸 수 없는 경우가 있습니다. 물에 녹지 않거나, 색이 있거나, 금속 화합물이거나, 지용성이 매우 높으면 시험법이 제한됩니다. 시험물질의 성상을 요청서에 적어 주세요.", basis: "OECD TG 439, 442C, 442E", rule: "R-E-07", topic: "시험 요건" });
  askCro.add("제안하는 시험 조합과 근거, 사용 모델·키트");
  askCro.add("결과에 따라 추가되는 시험의 비용과 중단 기준");
  askCro.add("시험물질의 적용 가능성 사전 확인(용해도, 간섭) 포함 여부");
  return finish(tests, notes, later, askCro, prereq, [], "시험 구성");
}

function adviseDevice(a: Answers): Advice {
  const tests: Suggest[] = [];
  const notes: Note[] = [];
  const later: Later[] = [];
  const askCro = new Set<string>();
  const prereq: string[] = [];
  const CAT = "의료기기 생물학적 안전성";
  const STD = "의료기기의 생물학적 안전에 관한 공통기준규격";
  const contact = String(a.mdContact ?? "");
  const durIdx = String(a.mdDuration ?? "").startsWith("A") ? 0 : String(a.mdDuration ?? "").startsWith("B") ? 1 : 2;
  const row = MD_TABLE[contact]?.[durIdx] ?? "ooo-----";
  MD_COLS.forEach(([key, label, item], i) => {
    const c = row[i];
    if (c === "-") return;
    tests.push({ key, label, category: CAT, item, reason: c === "o" ? "이 접촉 부위와 기간에 지정된 시험" : "추가로 적용될 수 있는 시험. 필요하면 체크하세요", basis: `${STD} 별표 제1장 표 1`, rule: "R-F2-22", on: c === "o", fill: { "의료기기 생물학적 안전성.glpLevel": "GLP" } });
  });
  if (durIdx === 2) {
    const deep = contact.startsWith("체내외 연결") || contact.startsWith("이식");
    const mucosa = contact === "표면접촉 · 점막" || contact === "표면접촉 · 파열·외상 표면";
    if (deep || mucosa) tests.push({ key: "md-chronic", label: "만성독성", category: CAT, item: "만성독성(10993-11)", reason: deep ? "영구 접촉에 지정된 추가 평가시험" : "추가로 적용될 수 있는 시험. 필요하면 체크하세요", basis: `${STD} 별표 제1장 표 2`, rule: "R-F2-22", on: deep });
    if (deep) tests.push({ key: "md-carc", label: "발암성", category: CAT, item: "발암성(10993-3)", reason: "영구 접촉에 지정된 추가 평가시험. 기간이 긴 시험이므로 기존 자료로 충족되는지 먼저 확인하고, 충족되면 빼세요", basis: `${STD} 별표 제1장 표 2, 6.1`, rule: "R-F2-22", on: true });
  }
  notes.push({ text: "표의 시험을 모두 해야 하는 것은 아닙니다. 기존 자료로 충족되면 추가 시험을 하지 않아야 하고, 선택하거나 면제한 근거를 기록해야 합니다. 체외 시험을 먼저 합니다.", basis: `${STD} 별표 제1장 4.6, 6.1, 7`, rule: "R-F2-22" });
  notes.push({ text: "접촉 기간은 24시간 이내, 24시간 이상 30일 이내, 30일 초과로 나눕니다. 둘 이상에 해당하면 더 엄격한 기준을 적용합니다. 시험은 완제품이나 같은 방법으로 처리한 대표 검체로 합니다.", basis: `${STD} 별표 제1장 5.3, 6.1`, rule: "R-F2-22" });
  notes.push({ text: "국내 고시가 채택한 국제 규격은 최신판이 아닙니다. 해외 인증을 함께 준비하면 어느 판으로 시험할지 정해야 합니다.", basis: `${STD} 별표 각 장의 관련규격`, rule: "R-F2-22", topic: "국내와 해외의 차이" });
  notes.push({ text: "시험은 비임상시험관리기준에 적합하게 시행합니다.", basis: `${STD} 별표 제1장 4.6`, rule: "R-F2-22", topic: "시험 요건" });
  if (tests.some((t) => t.key === "md-geno")) notes.push({ text: "체외 유전독성이 양성이면 체내 시험을 하거나 돌연변이 유발성이 있다고 가정합니다.", basis: `${STD} 별표 제1장 6.2.6`, rule: "R-F2-22" });
  prereq.push("시험에 제공할 검체 수량 확인 (항목이 많아 필요 수량이 많음)");
  askCro.add("추출 조건 (용매, 온도, 시간, 검체 대 용매 비율)과 추출 공유 여부");
  askCro.add("검체 필요 수량과 표면적·중량 산정 방법");
  askCro.add("적용하는 국제 규격의 판");
  if (tests.some((t) => t.key === "md-impl")) askCro.add("이식 시험의 동물종, 이식 부위, 기간");
  return finish(tests, notes, later, askCro, prereq, [], "시험 구성");
}

/** 화학물질·농약: 등록 톤수와 유형 */
function adviseChemical(a: Answers): Advice {
  const tests: Suggest[] = [];
  const notes: Note[] = [];
  const later: Later[] = [];
  const askCro = new Set<string>();
  const prereq: string[] = [];
  const type = String(a.chType ?? "");
  const gas = a.chGas === "예";
  const GEN = "일반독성";
  const ENV = "환경유해성";
  const add = (key: string, label: string, category: string, item: string, reason: string, basis: string, on = true) => tests.push({ key, label, category, item, reason, basis, rule: "R-F2-23", on, fill: { [`${category}.glpLevel`]: "GLP" } });

  if (type.startsWith("농약")) {
    const B = "농약 및 원제의 등록기준 별표 1";
    const raw = type === "농약 원제";
    add("single", "급성경구독성", GEN, "단회(급성)투여독성", "원제와 품목 모두 필요", B);
    add("dermal", "급성경피독성", GEN, "급성경피독성", "원제와 품목 모두 필요", B);
    add("inhal", "급성흡입독성", GEN, "단회 흡입독성", "원제와 품목 모두 필요", B);
    add("skin-irr", "피부자극성", "국소독성", "피부 1차 자극", "원제와 품목 모두 필요", B);
    add("eye-irr", "안점막자극성", "국소독성", "안점막 자극(세안군 비적용)", "원제와 품목 모두 필요", B);
    add("sens", "피부과민성", "항원성·면역독성", "피부감작성 LLNA", "원제와 품목 모두 필요. 기니피그 또는 마우스", B);
    if (raw) {
      add("repeat-13", "90일 반복투여 경구독성", GEN, "반복투여 13주", "원제에 필요", B);
      add("ames", "유전독성 · 복귀돌연변이", "유전독성", "복귀돌연변이(Ames, TG 471)", "원제에 필요", B);
      add("invitro-ca", "유전독성 · 염색체이상", "유전독성", "염색체이상 in vitro(TG 473)", "원제에 필요", B);
      add("invivo-mn", "유전독성 · 체내 소핵", "유전독성", "소핵 in vivo(마우스)", "체내 시험을 최소 1건 제출", B);
      add("efd", "기형독성 · 랫드와 토끼", "생식발생독성", "배·태자발생(Seg. II)", "원제에 필요. 2종", B);
      add("repro", "번식독성", "생식발생독성", "확장 1세대·2세대 생식독성", "원제에 필요", B);
      add("carc", "만성독성과 발암성", "발암성·종양원성", "장기발암성(2년)", "원제에 필요. 병합시험으로 내면 각각 면제", B);
      notes.push({ text: "원제는 이 밖에 신경독성, 지발성 신경독성(닭), 발달신경독성, 21일 또는 28일 경피 반복투여, 90일 흡입 반복투여, 동물체내 대사, 피부흡수율 자료가 있습니다. 해당하는 항목은 직접 고르기로 추가하세요.", basis: B, rule: "R-F2-23" });
      notes.push({ text: "체내 축적 가능성이 높으면 비설치류 만성독성시험(1년 이상)이 요구됩니다.", basis: `${B} 주 1`, rule: "R-F2-23" });
    } else {
      notes.push({ text: "품목(제제)은 급성독성과 자극·과민성 자료가 필요합니다. 반복투여, 유전독성, 발암성 등은 원제 자료입니다.", basis: B, rule: "R-F2-23" });
    }
    notes.push({ text: "시험성적서는 농촌진흥청장이 분야별로 지정한 시험연구기관에서 수행한 것이어야 합니다. 기관의 지정 분야를 확인하세요.", basis: "농약 및 원제의 등록기준 제4조", rule: "R-F2-23", topic: "시험 요건" });
    askCro.add("농촌진흥청 지정 분야와 해당 시험의 수행 실적");
    return finish(tests, notes, later, askCro, prereq, [], "시험 구성");
  }

  const B = "화학물질의 등록 및 평가 등에 관한 법률 시행규칙 별표 1";
  const tons = String(a.chTon ?? "");
  const lv = tons.startsWith("1,000") ? 4 : tons.startsWith("100") ? 3 : tons.startsWith("10") ? 2 : 1;
  const b1 = `${B} 제1호`;
  add("single", gas ? "급성흡입독성" : "급성경구독성", GEN, gas ? "단회 흡입독성" : "단회(급성)투여독성", gas ? "기체이거나 주 노출이 흡입이면 급성흡입독성" : "1톤 이상 구간의 인체 유해성 자료", b1);
  add("ames", "복귀돌연변이", "유전독성", "복귀돌연변이(Ames, TG 471)", "양성이면 염색체이상과 체내 유전독성 자료를 추가로 제출", b1);
  add("skin-irr", "피부 자극성·부식성", "동물대체시험", "피부자극 인체피부모델(TG 439)", "시험법은 기관과 협의. 체외 시험으로 제안했습니다", b1);
  add("sens", "피부 과민성", "항원성·면역독성", "피부감작성 LLNA", "시험법은 기관과 협의", b1);
  add("fish", "어류 급성독성", ENV, "어류 급성독성(TG 203)", "환경 유해성 자료", b1);
  add("daphnia", "물벼룩 급성독성", ENV, "물벼룩 급성 유영저해(TG 202)", "환경 유해성 자료", b1);
  add("biodeg", "이분해성", ENV, "생분해성(TG 301)", "환경 유해성 자료", b1);
  if (lv >= 2) {
    const b2 = `${B} 제2호`;
    if (!gas) add("dermal", "급성경피독성", GEN, "급성경피독성", "급성경피 또는 급성흡입. 노출 경로에 맞는 것을 고르세요", b2);
    add("eye-irr", "눈 자극성·부식성", "동물대체시험", "안자극 각막모델(TG 492)", "시험법은 기관과 협의. 체외 시험으로 제안했습니다", b2);
    add("invitro-ca", "체외 염색체이상", "유전독성", "염색체이상 in vitro(TG 473)", "10톤 이상 구간", b2);
    add("invivo-mn", "체내 체세포 유전독성", "유전독성", "소핵 in vivo(마우스)", "복귀돌연변이와 염색체이상이 모두 음성이면 포유류 배양세포 유전자변이 시험으로 대신할 수 있습니다", b2);
    add("repeat-4", "반복투여독성 28일", GEN, "반복투여 4주", "10톤 이상 구간", b2);
    add("screen", "생식·발달독성 스크리닝", "생식발생독성", "생식발생 스크리닝", "10톤 이상 구간", b2);
    add("algae", "담수조류 생장저해", ENV, "조류 생장저해(TG 201)", "환경 유해성 자료", b2);
    add("hydro", "가수분해", ENV, "가수분해(TG 111)", "환경 유해성 자료", b2);
  }
  if (lv >= 3) {
    const b3 = `${B} 제3호`;
    add("fish-c", "어류 만성독성", ENV, "어류 초기생활단계(TG 210)", "100톤 이상 구간", b3);
    add("daphnia-c", "물벼룩 만성독성", ENV, "물벼룩 번식(TG 211)", "100톤 이상 구간", b3);
    add("worm", "육생 무척추동물 급성독성", ENV, "지렁이 급성독성(TG 207)", "100톤 이상 구간", b3);
    add("plant", "육생 식물 급성독성", ENV, "육상식물 생장(TG 208)", "100톤 이상 구간", b3);
    add("adsorp", "흡착 및 탈착", ENV, "흡착·탈착(TG 106)", "100톤 이상 구간", b3);
    notes.push({ text: "100톤 이상 구간에는 추가 유전독성(생식세포 유전독성 등), 본질적 분해성, 분해산물 확인, 활성슬러지 호흡저해 자료가 있습니다. 해당하는 항목은 직접 고르기로 추가하세요.", basis: b3, rule: "R-F2-23" });
  }
  if (lv >= 4) {
    const b4 = `${B} 제4호`;
    add("repeat-13", "반복투여독성 90일", GEN, "반복투여 13주", "1,000톤 이상 구간", b4);
    add("efd", "최기형성", "생식발생독성", "배·태자발생(Seg. II)", "1,000톤 이상 구간", b4);
    add("repro", "2세대 또는 확장 1세대 생식독성", "생식발생독성", "확장 1세대·2세대 생식독성", "1,000톤 이상 구간", b4);
    add("carc", "발암성", "발암성·종양원성", "장기발암성(2년)", "1,000톤 이상 구간", b4);
    notes.push({ text: "1,000톤 이상 구간에는 생물농축성, 저서생물 만성독성, 육생 생물 만성독성 등 환경 자료가 더 있습니다.", basis: b4, rule: "R-F2-23" });
  }
  notes.push({ text: "상위 톤수 구간은 하위 구간의 자료를 모두 포함합니다. 물리·화학적 특성 자료도 구간별로 필요합니다.", basis: B, rule: "R-F2-23" });
  notes.push({ text: "일정 자료는 기후에너지환경부장관이 지정한 시험기관, 또는 OECD 우수실험실 기준 준수가 확인된 외국 시험기관의 결과로 내야 합니다. 기관이 지정받은 시험 분야와 항목을 확인하세요.", basis: "화학물질의 등록 및 평가 등에 관한 법률 제14조제2항, 제22조", rule: "R-F2-23", topic: "시험 요건" });
  notes.push({ text: "고분자화합물, 나노물질 등은 별도 특례가 있습니다.", basis: `${B} 제5호~제7호`, rule: "R-F2-23" });
  askCro.add("지정받은 시험 분야·항목과 지정 부처");
  askCro.add("자극성·과민성 시험에 쓰는 시험법 (체외, 동물)");
  return finish(tests, notes, later, askCro, prereq, [], "시험 구성");
}
