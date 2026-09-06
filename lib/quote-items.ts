import { CATS, type Values } from "./rfq-schema";

/**
 * RFQ payload → CRO 회신 표의 행.
 * CRO는 항목을 정의하지 않는다. 의뢰자가 고른 대분류와 세부 시험 종류에서 행이 자동 생성된다.
 */
export type QuoteRow = { seq: number; category: string; name: string; cond: string };

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

function condOf(payload: Values, cat: string): string {
  const parts: string[] = [];
  const species = detail(payload, cat, "species");
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

export function quoteRowsFromPayload(payload: Values): QuoteRow[] {
  const cats = Array.isArray(payload.categories) ? payload.categories : [];
  const rows: QuoteRow[] = [];
  for (const cat of cats) {
    if (!(CATS as readonly string[]).includes(cat)) continue;
    const cond = condOf(payload, cat);
    const picked = detail(payload, cat, "items") ?? detail(payload, cat, "segment");
    const names = Array.isArray(picked) && picked.length ? picked : [cat];
    for (const name of names) {
      rows.push({ seq: rows.length + 1, category: cat, name: name === cat ? cat : name, cond });
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
  return { ok: missing.length === 0, missing: [...new Set(missing)] };
}
