/** 요청(rfq_requests.status) 진행 단계 — 라벨·진행률·톤 */

export type RfqStatus = "received" | "distributed" | "quoted" | "compared" | "selected" | "contracting" | "closed" | "cancelled";

export const STAGES: { key: RfqStatus; label: string; pct: number; desc: string }[] = [
  { key: "received", label: "접수", pct: 8, desc: "기관에 참여 안내를 보낼 준비를 하고 있습니다" },
  // 참여 선택형(0023): 기관에 요청서를 "전달"하지 않고 참여 안내를 보낸다. 참여한 기관만 견적을 쓴다
  { key: "distributed", label: "참여 안내", pct: 25, desc: "분야가 맞는 기관에 참여 안내를 보냈습니다. 참여한 기관이 견적을 준비합니다" },
  { key: "quoted", label: "견적 도착", pct: 45, desc: "견적이 들어오고 있습니다. 비교표가 열리면 기관 이름과 금액이 함께 보입니다" },
  // compared: 비교표 공개 (compared_at, 2026-10-20 결정). 참여 결정이 끝난 뒤 참여한 기관이 모두 제출했거나 회신 기한이 지나면 열린다. 선택은 이때부터
  { key: "compared", label: "비교표 공개", pct: 60, desc: "도착한 견적을 나란히 비교하고 기관을 선택할 수 있습니다" },
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

/**
 * 기관이 보고한 계약의 확인 상태 (수주 화면용, 2026-10-20 결정, 0025).
 * 의뢰자 확인 · 보고 7일 뒤 자동 확정 · 운영자 정리 뒤 확정 · 이의(운영자 확인 중, 정산 멈춤) · 확인 대기(자동 확정 예정일)
 * contract_confirm_due_at 이 없으면(0025 전 행) 보고 시각 + 7일로 계산한다
 */
export function contractConfirmState(a: {
  contract_reported_at: string | null;
  requester_confirmed_at: string | null;
  confirmed_auto: boolean;
  requester_disputed_at: string | null;
  requester_dispute_note: string | null;
  contract_confirmed_at?: string | null;
  contract_confirmed_via?: string | null;
  contract_confirm_due_at?: string | null;
  dispute_resolved_at?: string | null;
}, opts: { includeNote?: boolean } = {}): { label: string; tone: "ok" | "warn" | "sf" } | null {
  // 이의 사유는 의뢰자가 운영자에게 쓴 글이다. 기관 화면에는 이의가 있었다는 사실만 보인다 (includeNote: false)
  const includeNote = opts.includeNote ?? true;
  if (!a.contract_reported_at) return null;
  const via = a.contract_confirmed_via ?? (a.requester_confirmed_at ? (a.confirmed_auto ? "auto" : "sponsor") : null);
  if (a.contract_confirmed_at || a.requester_confirmed_at) {
    if (via === "auto") return { label: "보고 7일 뒤 자동 확정", tone: "ok" };
    if (via === "operator") return { label: "이의 확인 뒤 운영자 확정", tone: "ok" };
    if (via === "legacy") return { label: "확인 절차 전 보고", tone: "ok" };
    return { label: "의뢰자 확인", tone: "ok" };
  }
  if (a.requester_disputed_at && !a.dispute_resolved_at) return { label: `의뢰자 이의 · 운영자 확인 중${includeNote && a.requester_dispute_note ? ` · ${a.requester_dispute_note}` : ""}`, tone: "warn" };
  const dueMs = a.contract_confirm_due_at ? new Date(a.contract_confirm_due_at).getTime() : new Date(a.contract_reported_at).getTime() + 7 * 864e5;
  const auto = new Date(dueMs).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
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

/**
 * 초대(rfq_invites.status) 상태값만으로 본 이름. sent 는 참여 여부를 모르므로 inviteStageLabel 을 쓴다 (0023).
 * 상태값은 바꾸지 않는다: sent(참여 결정 전 또는 참여) · draft(작성 중) · submitted(제출) · declined(불참 또는 철회) · expired(종료)
 */
export const INVITE_LABEL: Record<string, string> = {
  sent: "참여 결정 전",
  draft: "작성 중",
  submitted: "제출",
  declined: "불참",
  expired: "종료",
};

/** 기관 쪽 진행 단계 (0023). 화면 이름: 참여 결정 전 / 참여 / 작성 중 / 제출 / 불참 / 철회 / 종료 */
export type InviteStage = "undecided" | "joined" | "draft" | "submitted" | "declined" | "withdrawn" | "ended";
export const INVITE_STAGE_LABEL: Record<InviteStage, string> = {
  undecided: "참여 결정 전",
  joined: "참여",
  draft: "작성 중",
  submitted: "제출",
  declined: "불참",
  withdrawn: "철회",
  ended: "종료",
};

/** 초대 행 → 진행 단계. 취소(revoked_at)·만료는 종료, 참여 뒤 철회는 철회, 참여 전 불참은 불참 */
export function inviteStage(i: { status: string; joined_at?: string | null; withdrawn_at?: string | null; revoked_at?: string | null }): InviteStage {
  if (i.withdrawn_at) return "withdrawn";
  if (i.revoked_at || i.status === "expired") return "ended";
  if (i.status === "declined") return "declined";
  if (i.status === "submitted") return "submitted";
  if (i.status === "draft") return "draft";
  return i.joined_at ? "joined" : "undecided";
}
export function inviteStageLabel(i: Parameters<typeof inviteStage>[0]): string {
  return INVITE_STAGE_LABEL[inviteStage(i)];
}
