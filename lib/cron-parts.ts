/**
 * 두 번에 나눠 도는 묶음 (vercel.json). 한 함수는 60초 안에 끝나야 하는데 단계가 15개를 넘어, 사용량이 늘면 뒤쪽 단계가 잘린다.
 * - flow: 요청 흐름 (접수 시작 · 안내 · 참여 · 비교표 · 리마인더 · 마감 · 계약 · 청구서)
 * - upkeep: 알림 모음과 정리 (CRM 알림 · 운영자 요약 · 임시 요청서 · 시범 시작 문자 · 보존기간 · 떠난 기관 CRM)
 * ?part 가 없으면 전부 돈다 (손으로 부를 때, 테스트).
 */
const UPKEEP_STEPS = new Set(["crm-reminders", "digest", "pending-cleanup", "early-open-sms", "retention", "crm-purge"]);
export function cronPart(url: string): "flow" | "upkeep" | null {
  const p = new URL(url).searchParams.get("part");
  return p === "flow" || p === "upkeep" ? p : null;
}
export function stepInPart(name: string, part: "flow" | "upkeep" | null): boolean {
  return part == null || (part === "upkeep") === UPKEEP_STEPS.has(name);
}

