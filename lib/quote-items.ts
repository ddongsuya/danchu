import { CATS, DETAILS, type Cat, type Values } from "./rfq-schema";

/**
 * RFQ payload → CRO 회신 표의 행.
 * CRO는 항목을 정의하지 않는다. 의뢰자가 고른 대분류와 세부 시험 종류에서 행이 자동 생성된다.
 */
/** 회신 표의 한 행 정의 (요청서에서 파생). DB 의 cro_quotes 행(lib/data.ts QuoteRow)과는 다른 것이다 */
export type QuoteLineDef = {
  seq: number;
  category: string;
  name: string;
  cond: string;
  /** 참여한 기관의 요청서와 회신 화면에만 제공하는 시험별 입력값 */
  conditions?: [string, string][];
};

const YN_LABEL: Record<string, string> = {
  tk: "TK 병행",
  formulation: "조제물분석",
  doseRange: "용량설정",
  histopath: "조직병리",
  exposure: "노출증명",
  recovery: "회복",
};

function detail(payload: Values, cat: string, id: string): string | string[] | undefined {
  const v = payload[`${cat}.${id}`];
  return typeof v === "boolean" ? undefined : v;
}

/**
 * 동물을 쓰지 않는 시험 (Ames 등 세균·세포 시험). 동물종은 분야 단위로 고르므로 같은 분야의
 * in vivo 시험에서 고른 종이 이 행에 붙지 않게 한다 (Ames 행에 "마우스"가 붙던 문제)
 */
export function isInVitroItem(name: string): boolean {
  return /in vitro|ames|복귀돌연변이|TG\s?(471|473|487|490)\b|hERG|세포/i.test(name);
}

function condOf(payload: Values, cat: string, noSpecies = false): string {
  const parts: string[] = [];
  const model = detail(payload, cat, "method");
  if (typeof model === "string" && model.trim()) parts.push(model.trim().slice(0, 80));
  const species = noSpecies ? undefined : detail(payload, cat, "species");
  if (Array.isArray(species) && species.length) parts.push(species.join("·"));
  const recovery = detail(payload, cat, "recovery");
  if (typeof recovery === "string" && recovery && !["없음", "미정"].includes(recovery)) parts.push(`회복 ${recovery}`);
  for (const id of ["tk", "formulation", "histopath", "doseRange", "exposure"]) {
    if (detail(payload, cat, id) === "포함") parts.push(YN_LABEL[id]);
  }
  const glp = detail(payload, cat, "glpLevel");
  if (typeof glp === "string" && glp && glp !== "미정") parts.push(glp);
  return parts.join(" · ");
}

/**
 * 참여 전 요약에 보여 주는 조건: 동물종 · 회복 기간 · GLP 여부만 (설계 규칙표 "참여 전에 보이는 것").
 * 시험법·질환 모델처럼 의뢰자가 직접 적는 칸과 TK·조제물분석 같은 세부 설계는 참여 뒤 요청서 전체에서 본다
 */
function summaryCondOf(payload: Values, cat: string, noSpecies = false): string {
  const parts: string[] = [];
  const species = noSpecies ? undefined : detail(payload, cat, "species");
  if (Array.isArray(species) && species.length) parts.push(species.join("·"));
  const recovery = detail(payload, cat, "recovery");
  if (typeof recovery === "string" && ["2주", "4주"].includes(recovery)) parts.push(`회복 ${recovery}`);
  const glp = detail(payload, cat, "glpLevel");
  if (glp === "GLP" || glp === "Non-GLP") parts.push(glp);
  return parts.join(" · ");
}

function studyConditions(payload: Values, cat: Cat, noSpecies: boolean): [string, string][] {
  const conditions: [string, string][] = [];
  for (const field of DETAILS[cat]) {
    // items와 segment는 행 이름이고, 체외시험 행에는 다른 시험의 동물종이 붙지 않는다.
    if (field.id === "items" || field.id === "segment" || (field.id === "species" && noSpecies)) continue;
    const value = detail(payload, cat, field.id);
    const display = Array.isArray(value)
      ? value.filter((v) => typeof v === "string" && v.trim()).join(", ")
      : typeof value === "string" ? value.trim() : "";
    if (display && field.label) conditions.push([field.label, display]);
  }
  return conditions;
}

/** summary는 참여 전 공개 요약, full은 참여 기관의 견적 작성용 상세. 기본값은 매칭·견적 기록용 행이다. */
export function quoteRowsFromPayload(payload: Values, opts: { summary?: boolean; full?: boolean } = {}): QuoteLineDef[] {
  const cats = Array.isArray(payload.categories) ? payload.categories : [];
  const rows: QuoteLineDef[] = [];
  for (const cat of cats) {
    if (!CATS.includes(cat as Cat)) continue;
    const picked = detail(payload, cat, "items") ?? detail(payload, cat, "segment");
    const names = Array.isArray(picked) && picked.length ? picked : [cat];
    for (const name of names) {
      const noSpecies = isInVitroItem(name);
      const cond = opts.summary ? summaryCondOf(payload, cat, noSpecies) : condOf(payload, cat, noSpecies);
      const row: QuoteLineDef = { seq: rows.length + 1, category: cat, name, cond };
      if (!opts.summary && opts.full) row.conditions = studyConditions(payload, cat as Cat, noSpecies);
      rows.push(row);
    }
  }
  return rows;
}

/** 제출처 vs 보유 GLP 인증 → 대응 가능 여부 (비교표 경고용) */
export function glpCoverage(authorities: string[], certs: string[]): { ok: boolean; missing: string[] } {
  const need: Record<string, string> = {
    "식약처(MFDS)": "식약처(KGLP)",
    "US FDA": "US FDA GLP",
    "US EPA": "US EPA GLP",
    "기후에너지환경부·국립환경과학원": "기후에너지환경부·국립환경과학원",
    농촌진흥청: "농촌진흥청",
    농림축산검역본부: "농림축산검역본부",
    EMA: "OECD GLP",
    "PMDA(일본)": "OECD GLP",
    "NMPA(중국)": "OECD GLP",
    "OECD 국가": "OECD GLP",
  };
  const missing = authorities.map((a) => need[a]).filter((c): c is string => !!c && !certs.includes(c));
  return { ok: authorities.length > 0 && authorities.every((a) => !!need[a]) && missing.length === 0, missing: [...new Set(missing)] };
}
