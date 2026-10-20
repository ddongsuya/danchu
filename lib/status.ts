/** 요청(rfq_requests.status) 진행 단계 — 라벨·진행률·톤 */

export type RfqStatus = "received" | "distributed" | "quoted" | "compared" | "selected" | "contracting" | "closed" | "cancelled";

export const STAGES: { key: RfqStatus; label: string; pct: number; desc: string }[] = [
  { key: "received", label: "접수", pct: 8, desc: "기관에 전달할 준비를 하고 있습니다" },
  { key: "distributed", label: "기관 전달", pct: 25, desc: "기관이 요청서를 보고 견적을 준비하고 있습니다" },
  { key: "quoted", label: "견적 도착", pct: 45, desc: "기관의 회신이 들어오고 있습니다" },
  { key: "compared", label: "비교표 공개", pct: 60, desc: "도착한 견적을 나란히 비교할 수 있습니다" },
  { key: "selected", label: "기관 선택", pct: 75, desc: "선택한 기관과 서로 연락처를 주고받았습니다" },
  { key: "contracting", label: "계약 진행", pct: 88, desc: "기관이 계약 체결을 보고하면 내용을 확인해 주세요" },
  { key: "closed", label: "계약 완료", pct: 100, desc: "계약을 확인하고 요청을 마쳤습니다" },
];

/** 기관을 고르지 않고 마친 요청(외부 진행·보류·취소)의 마지막 단계 이름 */
export const ENDED_LABEL = "마무리";

export function stageOf(status: string | null | undefined) {
  return STAGES.find((s) => s.key === status) ?? STAGES[0];
}
export function stageIndex(status: string | null | undefined): number {
  const i = STAGES.findIndex((s) => s.key === status);
  return i < 0 ? 0 : i;
}
/** outcome 이 있으면(선정 없이 마침) 종료 단계를 "계약 완료" 대신 "마무리"로 */
export function statusLabel(status: string | null | undefined, outcome?: string | null): string {
  if (status === "cancelled") return "취소";
  if (status === "closed" && outcome) return ENDED_LABEL;
  return stageOf(status).label;
}

/** 기관이 보고한 계약을 의뢰자가 확인했는지 (수주 화면용) */
export function contractConfirmState(a: { contract_reported_at: string | null; requester_confirmed_at: string | null; confirmed_auto: boolean; requester_disputed_at: string | null; requester_dispute_note: string | null }): { label: string; tone: "ok" | "warn" | "sf" } | null {
  if (!a.contract_reported_at) return null;
  if (a.requester_confirmed_at) return { label: a.confirmed_auto ? "의뢰자 확인 · 보고 7일 뒤 자동 확정" : "의뢰자 확인", tone: "ok" };
  if (a.requester_disputed_at) return { label: `의뢰자 이의${a.requester_dispute_note ? ` · ${a.requester_dispute_note}` : ""}`, tone: "warn" };
  const auto = new Date(new Date(a.contract_reported_at).getTime() + 7 * 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return { label: `의뢰자 확인 대기 · ${auto} 자동 확정`, tone: "sf" };
}
export function statusTone(status: string | null | undefined): "sf" | "tint" | "ok" | "err" {
  switch (status) {
    case "quoted":
    case "compared":
      return "tint";
    case "selected":
    case "contracting":
      return "ok";
    case "cancelled":
      return "err";
    default:
      return "sf";
  }
}

/** 초대(rfq_invites.status) */
export const INVITE_LABEL: Record<string, string> = {
  sent: "회신 전",
  draft: "작성 중",
  submitted: "제출",
  declined: "회신하지 않음",
  expired: "취소됨",
};
