/** 요청(rfq_requests.status) 진행 단계 — 라벨·진행률·톤 */

export type RfqStatus = "received" | "distributed" | "quoted" | "compared" | "selected" | "contracting" | "closed" | "cancelled";

export const STAGES: { key: RfqStatus; label: string; pct: number; desc: string }[] = [
  { key: "received", label: "접수", pct: 8, desc: "요청서를 정리하고 있습니다" },
  { key: "distributed", label: "배포", pct: 25, desc: "참여 CRO에 요청서를 전달했습니다" },
  { key: "quoted", label: "견적 도착", pct: 45, desc: "CRO 회신이 들어오고 있습니다" },
  { key: "compared", label: "비교표 발송", pct: 60, desc: "도착한 견적을 비교할 수 있습니다" },
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

/** 초대(rfq_invites.status) */
export const INVITE_LABEL: Record<string, string> = {
  sent: "미회신",
  draft: "작성 중",
  submitted: "제출",
  declined: "회신 안 함",
  expired: "만료",
};
