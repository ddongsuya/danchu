/**
 * 의뢰자가 기관을 선정할 때 고르는 사유 (2026-11-17, 기획 인계본 "사유 입력과 공유"의 선택 사유 후보).
 * - 고르지 않아도 선정할 수 있다("미정"도 유효한 상태, 사유를 얻으려고 추궁하지 않는다).
 * - 지금은 기록만 한다(rfq_events selected 의 meta). 기관에 얼마나 공유할지는 아직 정하지 않았다.
 * - 에이전트 앱(danchuai)도 같은 목록을 쓴다. 바꾸면 그쪽도 함께 바꾼다.
 */
export const SELECT_REASONS = ["시험 범위 적합", "일정", "견적 조건", "기술 검토 내용", "기존 거래 경험", "기타"] as const;
export type SelectReason = (typeof SELECT_REASONS)[number];

export const SELECT_NOTE_MAX = 200;

/**
 * 요청 본문에서 사유만 골라낸다(순수 함수). 목록에 없는 값은 버리고, 같은 값은 한 번만, 목록 순서대로.
 * 상세 설명은 앞뒤 공백을 없애고 길이를 자른다. 비어 있으면 null.
 */
export function parseSelectReasons(b: { reasons?: unknown; reasonNote?: unknown }): { reasons: SelectReason[]; note: string | null } {
  const picked = Array.isArray(b.reasons) ? new Set(b.reasons.filter((x): x is string => typeof x === "string")) : new Set<string>();
  const reasons = SELECT_REASONS.filter((r) => picked.has(r));
  const note = typeof b.reasonNote === "string" ? b.reasonNote.trim().slice(0, SELECT_NOTE_MAX) : "";
  return { reasons, note: note || null };
}
