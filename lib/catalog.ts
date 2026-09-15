/**
 * 역량 카탈로그 — 기관이 시험 항목별로 등록하는 표준 설계·리드타임·참고 단가.
 * 항목 목록은 요청서 스키마(DETAILS)의 세부 항목에서 그대로 만들어져 요청서의 행과 1:1로 맞물린다.
 */
import { CATS, DETAILS, type Cat, type Field, type Values } from "./rfq-schema";
import type { QuoteRow } from "./quote-items";

export type Glp = "GLP" | "Non-GLP" | "both";
export type CatalogOption = { name: string; amount: number | null };
export type CatalogRow = {
  item_key: string;
  category: string;
  item: string;
  available: boolean;
  glp: Glp;
  species: string[];
  groups_ctrl: number | null;
  groups_test: number | null;
  per_sex: number | null;
  recovery_weeks: number | null;
  recovery_per_sex: number | null;
  route: string | null;
  dosing: string | null;
  weeks: number | null;
  includes: string[];
  options: CatalogOption[];
  unit: "total" | "per_sample";
  price_min: number | null;
  price_max: number | null;
  extra: Record<string, string | string[]>;
  note: string | null;
  last_amount: number | null;
  last_weeks: number | null;
  last_quoted_at: string | null;
  source: "manual" | "learned" | "empty";
};

export type CatalogItem = { key: string; category: Cat; item: string };

export const itemKey = (category: string, item: string) => `${category}::${item}`;

/** 요청서 스키마에서 카탈로그 항목 목록을 만든다 ("기타"는 제외, 세부 항목이 없는 대분류는 대분류 자체가 항목) */
export function catalogItems(): CatalogItem[] {
  const out: CatalogItem[] = [];
  for (const cat of CATS) {
    const f = DETAILS[cat].find((x) => x.id === "items" || x.id === "segment");
    const names = (f?.options ?? []).filter((o) => o !== "기타");
    if (names.length === 0) names.push(cat);
    for (const item of names) out.push({ key: itemKey(cat, item), category: cat, item });
  }
  return out;
}

/** 기본 포함 항목 후보 (총액 안에 든 것만 체크) */
export const INCLUDE_KEYS = ["임상병리", "조직병리(검경 포함)", "TK 분석", "조제물분석", "통계분석", "QA 점검", "영문 보고서", "시험물질 보관"] as const;

/** 별도 옵션으로 자주 빠지는 것 (옵션 추가 시 제안) */
export const OPTION_SUGGEST = ["특수염색", "TK 분석", "영문 보고서", "조직병리 판독(추가 장기)", "시험물질 보관", "면역조직화학", "전자현미경", "번역 보고서"];

export const SPECIES = ["SD 랫드", "Wistar 랫드", "F344 랫드", "ICR 마우스", "C57BL/6 마우스", "BALB/c 마우스", "누드마우스", "rasH2 Tg 마우스", "기니피그", "NZW 토끼", "비글", "미니피그", "원숭이(영장류)", "송사리", "제브라피시", "기타"];
export const ROUTES = ["경구(PO)", "정맥(IV)", "정맥 지속주입(Infusion)", "피하(SC)", "근육(IM)", "복강(IP)", "경피·피부", "점안", "흡입", "비강", "직장", "질", "뇌내", "관절강내", "이식", "기타"];

/** 검체당 단가로 견적하는 대분류 */
export const PER_SAMPLE_CATS: readonly string[] = ["PK/TK/ADME·생체시료분석", "조제물분석"];

/**
 * 대분류별 추가 칸. 실무 관행 반영:
 * - 생체시료분석: GLP면 Full validation, 내부 확인용이면 검량선·QC 수준. Partial은 로트 변경 등 별도 상황
 * - 조직병리는 검경 포함이 기본, 특수염색은 별도
 */
export const EXTRA_FIELDS: Partial<Record<Cat, Field[]>> = {
  유전독성: [
    { id: "strains", type: "chips", label: "균주 (Ames)", options: ["TA98", "TA100", "TA1535", "TA1537", "TA102", "WP2 uvrA"] },
    { id: "cellLine", type: "select", label: "세포주 (in vitro)", options: ["CHL/IU", "CHO-K1", "TK6", "L5178Y", "인체 림프구", "기타"] },
    { id: "s9", type: "select", label: "S9 대사활성", options: ["±S9 모두", "-S9만", "+S9만"] },
    { id: "exposureProof", type: "radio", label: "노출증명 (in vivo)", options: ["기본 포함", "별도 옵션", "미수행"] },
    { id: "packageQuote", type: "radio", label: "3종 패키지 견적", options: ["가능", "항목별만"] },
  ],
  "PK/TK/ADME·생체시료분석": [
    { id: "matrix", type: "chips", label: "검체 종류", options: ["혈장", "혈청", "전혈", "뇨", "분변", "담즙", "조직", "뇌척수액"] },
    { id: "anticoag", type: "select", label: "항응고제", options: ["헤파린", "EDTA-K2", "EDTA-K3", "구연산나트륨", "없음"] },
    { id: "instrument", type: "select", label: "분석 장비", options: ["LC-MS/MS", "HPLC", "ELISA", "qPCR", "LSC(방사능)", "기타"] },
    { id: "validation", type: "select", label: "분석법 수준", options: ["Full validation (GLP)", "검량선·QC 수준 (비GLP·내부 확인용)", "의뢰자 분석법 이전"], help: "Partial validation은 로트 변경 등 별도 상황에서 추가로 견적합니다." },
    { id: "methodDevFee", type: "text", label: "분석법 개발·검증 기본료 (원)", placeholder: "예: 15000000" },
  ],
  안전성약리: [
    { id: "telemetry", type: "select", label: "심혈관 Telemetry", options: ["보유(이식형)", "보유(재킷형)", "없음"] },
    { id: "hergCell", type: "text", label: "hERG 세포주·시스템", placeholder: "예: HEK293-hERG · 자동 패치클램프" },
    { id: "cnsMethod", type: "select", label: "중추신경계 평가법", options: ["Irwin", "FOB", "둘 다"] },
  ],
  조제물분석: [
    { id: "platform", type: "chips", label: "분석 플랫폼", options: ["HPLC", "LC-MS", "LC-MS/MS", "GC-MS", "ELISA", "기타"] },
    { id: "methodDev", type: "radio", label: "분석법 개발 포함", options: ["기본 포함", "별도 옵션", "의뢰자 제공만"] },
  ],
  생식발생독성: [
    { id: "mating", type: "text", label: "교배 방식", placeholder: "예: 1:1 동거, 최대 14일" },
    { id: "fetalExam", type: "chips", label: "태자 검사 범위", options: ["외표", "내장", "골격"] },
  ],
  동물대체시험: [{ id: "model", type: "text", label: "모델·키트", placeholder: "예: EpiDerm, KeraSkin, SkinEthic" }],
  "의료기기 생물학적 안전성": [{ id: "extract", type: "select", label: "표준 추출 조건", options: ["37℃ 72h", "50℃ 72h", "70℃ 24h", "121℃ 1h", "협의"] }],
  "효력시험(약효)": [
    { id: "diseaseModel", type: "text", label: "질환 모델", placeholder: "예: DSS 대장염, STZ 당뇨, MCAO" },
    { id: "endpoints", type: "text", label: "평가 지표", placeholder: "예: 체중, DAI, 조직 점수, 혈당" },
  ],
  환경유해성: [{ id: "fish", type: "text", label: "어종", placeholder: "예: 송사리(Oryzias latipes)" }],
};

export function emptyRow(it: CatalogItem): CatalogRow {
  return {
    item_key: it.key, category: it.category, item: it.item,
    available: true, glp: "both", species: [], groups_ctrl: null, groups_test: null, per_sex: null,
    recovery_weeks: null, recovery_per_sex: null, route: null, dosing: null, weeks: null,
    includes: [], options: [], unit: PER_SAMPLE_CATS.includes(it.category) ? "per_sample" : "total",
    price_min: null, price_max: null, extra: {}, note: null,
    last_amount: null, last_weeks: null, last_quoted_at: null, source: "empty",
  };
}

/** 설계 한 줄 요약 (회신 표·비교표 표시용) */
export function designSummary(r: Pick<CatalogRow, "species" | "groups_ctrl" | "groups_test" | "per_sex" | "recovery_weeks" | "recovery_per_sex" | "route" | "dosing">): string {
  const p: string[] = [];
  if (r.species?.length) p.push(r.species.join("·"));
  if (r.groups_ctrl != null || r.groups_test != null) p.push(`대조 ${r.groups_ctrl ?? 0} + 시험 ${r.groups_test ?? 0}군`);
  if (r.per_sex != null) p.push(`암수 각 ${r.per_sex}`);
  if (r.recovery_weeks) p.push(`회복 ${r.recovery_weeks}주${r.recovery_per_sex ? ` (+${r.recovery_per_sex}/성)` : ""}`);
  if (r.route) p.push(r.route);
  if (r.dosing) p.push(r.dosing);
  return p.join(" · ");
}

/* ── 초안 채우기 ─────────────────────────────────────────── */

export type Prefill = {
  avail: "" | "가능" | "조건부 가능" | "불가";
  amount: string;
  weeks: string;
  reason: string;
  source: "catalog" | "learned" | "manual";
  /** 요청 조건이 표준 설계와 다른 칸 이름들. 비어 있으면 그대로 써도 됨 */
  checks: string[];
  design: Record<string, unknown>;
  unit: "total" | "per_sample";
  unitPrice: string;
};

function condOf(payload: Values, cat: string, id: string): string | string[] | undefined {
  const v = payload[`${cat}.${id}`];
  return typeof v === "boolean" ? undefined : v;
}

/** 요청서의 조건과 카탈로그 행을 대조해 초안 한 행을 만든다 */
export function prefillRow(row: QuoteRow, cat: CatalogRow | undefined, payload: Values): Prefill {
  const base: Prefill = { avail: "", amount: "", weeks: "", reason: "", source: "manual", checks: [], design: {}, unit: "total", unitPrice: "" };
  if (!cat) return base;
  const design = {
    species: cat.species, groups_ctrl: cat.groups_ctrl, groups_test: cat.groups_test, per_sex: cat.per_sex,
    recovery_weeks: cat.recovery_weeks, recovery_per_sex: cat.recovery_per_sex, route: cat.route, dosing: cat.dosing, extra: cat.extra,
  };
  if (!cat.available) return { ...base, avail: "불가", reason: "해당 항목은 수행하지 않습니다.", source: "catalog", design };

  const checks: string[] = [];
  const c = row.category;
  const reqSpecies = condOf(payload, c, "species");
  if (Array.isArray(reqSpecies) && reqSpecies.length && cat.species.length) {
    // 요청은 "랫드" 같은 종, 카탈로그는 "SD 랫드" 같은 계통 — 종 이름이 포함되면 같은 것으로 본다
    const ok = reqSpecies.some((s) => cat.species.some((cs) => cs.includes(s.replace(/\(.*\)/, "").trim()) || s.includes(cs)));
    if (!ok) checks.push("동물종");
  }
  const reqRecovery = condOf(payload, c, "recovery");
  if (typeof reqRecovery === "string" && reqRecovery && !["없음", "미정"].includes(reqRecovery)) {
    const w = parseInt(reqRecovery, 10);
    if (!cat.recovery_weeks || (Number.isFinite(w) && w !== cat.recovery_weeks)) checks.push(`회복군 ${reqRecovery}`);
  }
  const incl = (k: string) => cat.includes.some((x) => x.startsWith(k)) || cat.options.some((o) => o.name.startsWith(k));
  if (condOf(payload, c, "tk") === "포함" && !incl("TK")) checks.push("TK 병행");
  if (condOf(payload, c, "formulation") === "포함" && !incl("조제물분석")) checks.push("조제물분석");
  if (condOf(payload, c, "histopath") === "포함" && !incl("조직병리")) checks.push("조직병리");
  if (condOf(payload, c, "doseRange") === "포함") checks.push("용량설정시험");
  if (condOf(payload, c, "exposure") === "포함" && !incl("노출증명") && cat.extra?.exposureProof !== "기본 포함") checks.push("노출증명");
  const reqGlp = condOf(payload, c, "glpLevel");
  if (typeof reqGlp === "string" && (reqGlp === "GLP" || reqGlp === "Non-GLP") && cat.glp !== "both" && cat.glp !== reqGlp) checks.push(`${reqGlp} 수행`);

  const source: Prefill["source"] = cat.source === "manual" || cat.price_min != null || cat.weeks != null ? "catalog" : cat.last_amount != null ? "learned" : "manual";
  const amount = checks.length ? "" : cat.unit === "per_sample" ? "" : String(cat.price_min ?? cat.last_amount ?? "");
  const weeks = String(cat.weeks ?? cat.last_weeks ?? "");
  return {
    avail: "가능", amount, weeks, reason: "", source, checks, design,
    unit: cat.unit, unitPrice: cat.unit === "per_sample" ? String(cat.price_min ?? cat.last_amount ?? "") : "",
  };
}

/** 요청서의 행 → 카탈로그 항목 키 (행 이름이 세부 항목명 또는 대분류명) */
export function rowKey(row: QuoteRow): string {
  return itemKey(row.category, row.name === row.category ? row.category : row.name);
}

/** 대분류 목록 (표시 순서 = 스키마 순서) */
export const CATEGORY_ORDER: readonly string[] = CATS;
