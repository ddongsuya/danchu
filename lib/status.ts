/** 요청(rfq_requests.status) 진행 단계 — 라벨·진행률·톤 */

export type RfqStatus = "received" | "distributed" | "quoted" | "compared" | "selected" | "contracting" | "closed" | "cancelled";

export const STAGES: { key: RfqStatus; label: string; pct: number; desc: string }[] = [
  { key: "received", label: "접수", pct: 8, desc: "요청서를 정리하고 있습니다" },
  { key: "distributed", label: "배포", pct: 25, desc: "분야가 맞는 기관에 참여 안내를 보냈습니다" },
  { key: "quoted", label: "견적 도착", pct: 45, desc: "도착한 견적은 비교표에서 바로 볼 수 있습니다. 회신 기한까지는 수정될 수 있습니다" },
  // compared: 회신 마감 (compared_at, lib/reply-window.ts). 예전 "비교표 발송" 단계. 기한 전에 선정하면 이 단계를 거치지 않는다
  { key: "compared", label: "회신 마감", pct: 60, desc: "회신이 마감되어 견적이 더 바뀌지 않습니다. 비교표에서 선정해 주세요" },
  { key: "selected", label: "CRO 선택", pct: 75, desc: "선택한 CRO에 연락처가 전달되었습니다" },
  { key: "contracting", label: "계약 진행", pct: 88, desc: "CRO와 직접 계약을 진행합니다" },
  { key: "closed", label: "종료", pct: 100, desc: "계약이 체결되어 종료되었습니다" },
];

export function stageOf(status: string | null | undefined) {
  return STAGES.find((s) => s.key === status) ?? STAGES[0];
}
export function stageIndex(status: string | null | undefined): number {
  const i = STAGES.findIndex((s) => s.key === status);
  return i < 0 ? 0 : i;
}
export function statusLabel(status: string | null | undefined): string {
  if (status === "cancelled") return "취소";
  return stageOf(status).label;
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
