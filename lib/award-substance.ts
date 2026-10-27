/**
 * 선정 뒤 시험물질 필요량 (0027, 2026-10-27 대표 결정).
 * 기관은 시험물질 정보를 받은 뒤에야 필요량을 정할 수 있어, 회신(선정 전)이 아니라 수주 화면(선정 뒤)에서 적는다.
 */
export type AwardSubstance = { qty: string; when: string; note: string };

export const SUBSTANCE_LIMITS = { qty: 120, when: 120, note: 300 } as const;

/** 요청 본문 → 저장할 값. 필요량이 비어 있으면 null (저장하지 않는다) */
export function parseAwardSubstance(body: unknown): AwardSubstance | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const s = (k: keyof AwardSubstance) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, SUBSTANCE_LIMITS[k]) : "");
  const v = { qty: s("qty"), when: s("when"), note: s("note") };
  return v.qty ? v : null;
}
