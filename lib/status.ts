/** 요청(rfq_requests.status) 진행 단계 — 라벨·진행률·톤 */

export type RfqStatus = "received" | "distributed" | "quoted" | "compared" | "selected" | "contracting" | "closed" | "cancelled";

export const STAGES: { key: RfqStatus; label: string; pct: number; desc: string }[] = [
  { key: "received", label: "접수", pct: 8, desc: "기관에 전달할 준비를 하고 있습니다" },
  { key: "distributed", label: "기관에 전달", pct: 25, desc: "기관이 요청서를 보고 견적을 준비하고 있습니다" },
  { key: "quoted", label: "견적 도착", pct: 45, desc: "기관의 회신이 들어오고 있습니다" },
  { key: "compared", label: "비교표 열림", pct: 60, desc: "도착한 견적을 나란히 비교할 수 있습니다" },
  { key: "selected", label: "기관 선정", pct: 75, desc: "선정한 기관과 서로 연락처를 주고받았습니다" },
  { key: "contracting", label: "계약 진행", pct: 88, desc: "기관이 계약 체결을 보고했습니다. 내용을 확인해 주세요" },
  { key: "closed", label: "종료", pct: 100, desc: "요청을 마쳤습니다" },
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
  sent: "회신 전",
  draft: "작성 중",
  submitted: "제출",
  declined: "회신하지 않음",
  expired: "취소됨",
};
