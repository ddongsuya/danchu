/**
 * 역량 카탈로그 — 기관이 시험 항목별로 등록하는 "수행 조합"(동물종 × 투여경로 × 시험법)과
 * 조합마다의 표준 설계·리드타임·참고 단가.
 *
 * 항목(item)은 요청서 스키마(DETAILS)의 세부 항목에서 그대로 만들어져 요청서의 행과 1:1로 맞물린다.
 * 한 항목 아래 조합은 여러 개일 수 있다 (예: 단회투여독성 → 랫드·경구·TG 423 / 비글·정맥·용량증량법).
 */
import { CATS, DETAILS, type Cat, type Field, type Values } from "./rfq-schema";
import type { QuoteRow } from "./quote-items";

export type Glp = "GLP" | "Non-GLP" | "both";
export type CatalogOption = { name: string; amount: number | null };
export type CatalogRow = {
  /** DB id. 새 조합은 "new-…" 임시 id */
  id: string;
  item_key: string;
  category: string;
  item: string;
  available: boolean;
  glp: Glp;
  /** 조합 축 1: 동물종·계통 (설계·단가가 같으면 여러 종을 한 조합에 둘 수 있다) */
  species: string[];
  /** 조합 축 2: 투여 경로 */
  route: string | null;
  /** 조합 축 3: 시험법·가이드라인 */
  method: string | null;
  groups_ctrl: number | null;
  groups_test: number | null;
  per_sex: number | null;
  recovery_weeks: number | null;
  recovery_per_sex: number | null;
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
  sort: number;
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

export const SPECIES = ["SD 랫드", "Wistar 랫드", "F344 랫드", "ICR 마우스", "C57BL/6 마우스", "BALB/c 마우스", "누드마우스", "rasH2 Tg 마우스", "기니피그", "NZW 토끼", "비글", "미니피그", "원숭이(영장류)", "송사리", "제브라피시", "in vitro(동물 없음)", "기타"];
export const ROUTES = ["경구(PO)", "정맥(IV)", "정맥 지속주입(Infusion)", "피하(SC)", "근육(IM)", "복강(IP)", "경피·피부", "점안", "흡입", "비강", "직장", "질", "뇌내", "관절강내", "이식", "해당 없음", "기타"];

/** 검체당 단가로 견적하는 대분류 */
export const PER_SAMPLE_CATS: readonly string[] = ["PK/TK/ADME·생체시료분석", "조제물분석"];

/* ── 시험법·가이드라인 후보 ───────────────────────────── */

export const SINGLE_DOSE_METHODS = ["OECD TG 420 고정용량법", "OECD TG 423 급성독성등급법", "OECD TG 425 상하법", "용량증량(DE)법", "최대투여량(Limit test)", "ICH M3 단회 설계(관찰 14일)", "MFDS 독성시험기준"];
export const REPEAT_DOSE_METHODS = ["OECD TG 407 (설치류 28일)", "OECD TG 408 (설치류 90일)", "OECD TG 409 (비설치류 90일)", "OECD TG 410 (경피 반복)", "OECD TG 412 (흡입 28일)", "OECD TG 413 (흡입 90일)", "OECD TG 452 (만성)", "ICH M3/S4 반복투여 설계", "MFDS 독성시험기준"];

const METHODS_BY_CAT: Partial<Record<Cat, string[]>> = {
  "발암성·종양원성": ["OECD TG 451 발암성", "OECD TG 453 만성·발암 복합", "ICH S1B rasH2 26주", "MFDS 독성시험기준"],
  유전독성: ["OECD TG 기준", "ICH S2(R1)", "MFDS 독성시험기준"],
  생식발생독성: ["OECD TG 421/422 스크리닝", "OECD TG 414 배·태자발생", "OECD TG 415/416 세대", "OECD TG 443 (EOGRTS)", "ICH S5(R3)", "MFDS 독성시험기준"],
  "항원성·면역독성": ["OECD TG 406 GPMT/Buehler", "OECD TG 429 LLNA", "ICH S8 면역독성", "MFDS 독성시험기준"],
  국소독성: ["OECD TG 404 피부자극", "OECD TG 405 안자극", "MFDS 의약품 독성시험기준", "MFDS 화장품 안전성 평가 가이드라인"],
  국소내성: ["ICH M3 국소내성", "MFDS 독성시험기준", "자체 SOP"],
  안전성약리: ["ICH S7A", "ICH S7B", "자체 SOP"],
  동물대체시험: ["OECD TG 기준", "MFDS 화장품 동물대체시험법 가이드라인"],
  조제물분석: ["ICH Q2(R2)", "자체 SOP"],
  "PK/TK/ADME·생체시료분석": ["ICH M10 생체시료분석법 검증", "MFDS 생체시료분석법 밸리데이션 가이드라인", "자체 SOP"],
  "효력시험(약효)": ["자체 SOP"],
  환경유해성: ["OECD TG 기준", "화평법 시험방법", "농약 등록 시험기준"],
  "의료기기 생물학적 안전성": ["ISO 10993", "MFDS 의료기기 생물학적 안전성 평가 기준", "USP <87>/<88>"],
  "기타(임상병리·조직병리 등)": ["자체 SOP"],
};

/** 항목별 시험법 후보. 목록에 없으면 직접 입력 */
export function methodOptions(category: string, item: string): string[] {
  if (category === "일반독성") return /단회|급성/.test(item) ? SINGLE_DOSE_METHODS : REPEAT_DOSE_METHODS;
  return METHODS_BY_CAT[category as Cat] ?? [];
}

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

let seq = 0;
/** 새 조합 (저장 전). 축 값은 프리셋이나 복제 원본에서 받을 수 있다 */
export function newVariant(it: CatalogItem, init: Partial<CatalogRow> = {}): CatalogRow {
  seq++;
  return {
    id: `new-${Date.now()}-${seq}`,
    item_key: it.key, category: it.category, item: it.item,
    available: true, glp: "both", species: [], route: null, method: null,
    groups_ctrl: null, groups_test: null, per_sex: null, recovery_weeks: null, recovery_per_sex: null, dosing: null, weeks: null,
    includes: [], options: [], unit: PER_SAMPLE_CATS.includes(it.category) ? "per_sample" : "total",
    price_min: null, price_max: null, extra: {}, note: null,
    last_amount: null, last_weeks: null, last_quoted_at: null, source: "empty", sort: 0,
    ...init,
  };
}

export const isNewId = (id: string) => !/^[0-9a-f-]{36}$/.test(id);

/** 조합 이름: 동물종 · 경로 · 시험법 */
export function variantLabel(r: Pick<CatalogRow, "species" | "route" | "method">): string {
  return [r.species.length ? r.species.join("·") : "동물종 미지정", r.route || "경로 미지정", r.method || "시험법 미지정"].join(" · ");
}

/** 설계 한 줄 요약 (회신 표·비교표 표시용) */
export function designSummary(r: Pick<CatalogRow, "species" | "groups_ctrl" | "groups_test" | "per_sex" | "recovery_weeks" | "recovery_per_sex" | "route" | "dosing"> & { method?: string | null }): string {
  const p: string[] = [];
  if (r.species?.length) p.push(r.species.join("·"));
  if (r.route) p.push(r.route);
  if (r.method) p.push(r.method);
  if (r.groups_ctrl != null || r.groups_test != null) p.push(`대조 ${r.groups_ctrl ?? 0} + 시험 ${r.groups_test ?? 0}군`);
  if (r.per_sex != null) p.push(`암수 각 ${r.per_sex}`);
  if (r.recovery_weeks) p.push(`회복 ${r.recovery_weeks}주${r.recovery_per_sex ? ` (+${r.recovery_per_sex}/성)` : ""}`);
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
const asList = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []);

/** 요청서의 종("랫드")과 카탈로그의 계통("SD 랫드")을 같은 것으로 본다 */
function speciesMatch(req: string[], cat: string[]): boolean | null {
  if (!req.length || !cat.length) return null;
  return req.some((s) => cat.some((cs) => cs.includes(s.replace(/\(.*\)/, "").trim()) || s.includes(cs)));
}
/** "OECD TG 423 급성독성등급법" vs 요청 "TG 423" 처럼 번호·핵심어가 겹치면 같은 시험법 */
function methodMatch(req: string[], m: string | null): boolean | null {
  if (!req.length || !m) return null;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const key = (s: string) => (s.match(/tg\s*\d+|\d{3,}|[a-z]+\d[a-z]?/i)?.[0] ?? s).toLowerCase().replace(/\s+/g, "");
  return req.some((r) => norm(m).includes(norm(r)) || norm(r).includes(norm(m)) || key(r) === key(m));
}

/** 요청 조건과 가장 가까운 조합을 고른다. 없으면 undefined */
export function pickVariant(variants: CatalogRow[], row: QuoteRow, payload: Values): { row: CatalogRow; mismatch: string[] } | undefined {
  if (!variants.length) return undefined;
  const c = row.category;
  const reqSpecies = asList(condOf(payload, c, "species"));
  const reqRoute = typeof payload.route === "string" ? payload.route : "";
  const reqMethod = asList(condOf(payload, c, "method"));
  const reqGlp = condOf(payload, c, "glpLevel");
  let best: { row: CatalogRow; score: number; mismatch: string[] } | undefined;
  for (const v of variants) {
    let score = v.available ? 0 : -100;
    const mismatch: string[] = [];
    const sm = speciesMatch(reqSpecies, v.species);
    if (sm === true) score += 4; else if (sm === false) mismatch.push("동물종");
    if (reqRoute && v.route) { if (v.route === reqRoute) score += 2; else mismatch.push("투여경로"); }
    const mm = methodMatch(reqMethod, v.method);
    if (mm === true) score += 2; else if (mm === false) mismatch.push("시험법");
    if (typeof reqGlp === "string" && (reqGlp === "GLP" || reqGlp === "Non-GLP") && v.glp !== "both") { if (v.glp === reqGlp) score += 1; else mismatch.push(`${reqGlp} 수행`); }
    if (v.source === "manual") score += 0.5;
    if (!best || score > best.score) best = { row: v, score, mismatch };
  }
  return best && { row: best.row, mismatch: best.mismatch };
}

/** 요청서의 행 + 고른 조합 → 초안 한 행 */
export function prefillRow(row: QuoteRow, picked: { row: CatalogRow; mismatch: string[] } | undefined, payload: Values): Prefill {
  const base: Prefill = { avail: "", amount: "", weeks: "", reason: "", source: "manual", checks: [], design: {}, unit: "total", unitPrice: "" };
  if (!picked) return base;
  const cat = picked.row;
  const design = {
    species: cat.species, route: cat.route, method: cat.method,
    groups_ctrl: cat.groups_ctrl, groups_test: cat.groups_test, per_sex: cat.per_sex,
    recovery_weeks: cat.recovery_weeks, recovery_per_sex: cat.recovery_per_sex, dosing: cat.dosing, extra: cat.extra,
  };
  if (!cat.available) return { ...base, avail: "불가", reason: "해당 조합은 수행하지 않습니다.", source: "catalog", design };

  const checks: string[] = [...picked.mismatch];
  const c = row.category;
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

  const source: Prefill["source"] = cat.source === "manual" || cat.price_min != null || cat.weeks != null ? "catalog" : cat.last_amount != null ? "learned" : "manual";
  const amount = checks.length ? "" : cat.unit === "per_sample" ? "" : String(cat.price_min ?? cat.last_amount ?? "");
  const weeks = String(cat.weeks ?? cat.last_weeks ?? "");
  return {
    avail: "가능", amount, weeks, reason: "", source, checks: [...new Set(checks)], design,
    unit: cat.unit, unitPrice: cat.unit === "per_sample" ? String(cat.price_min ?? cat.last_amount ?? "") : "",
  };
}

/** 요청서의 행 → 카탈로그 항목 키 (행 이름이 세부 항목명 또는 대분류명) */
export function rowKey(row: QuoteRow): string {
  return itemKey(row.category, row.name === row.category ? row.category : row.name);
}

/** 대분류 목록 (표시 순서 = 스키마 순서) */
export const CATEGORY_ORDER: readonly string[] = CATS;
