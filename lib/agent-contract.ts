/**
 * 에이전트 앱의 선정 뒤 계약 진행 (2026-11-21). 앱이 견적 제출부터 계약 보고까지 끝내도록 계약 상태를 한 모양으로 준다.
 * 성사 수수료는 계약 보고 → 의뢰자 확인(또는 7일 뒤 자동 확정)으로 정해진다. 규칙은 웹과 같다:
 * - 기관 보고: app/api/awards/[id]/contract (선정 견적과 10% 이상 다르면 차이 사유)
 * - 의뢰자 확인·이의: app/api/rfq/[no]/contract, 의뢰자 계약 결과 알림: app/api/rfq/[no]/contract-result
 * - 웹 화면 조건: app/app/r/[no]/page.tsx(needsConfirm·canTellResult), app/cro/awards/page.tsx
 * 이 파일은 순수 함수만 둔다(테스트 대상). 이의 사유(의뢰자가 운영자에게 쓴 글)는 기관 쪽에 주지 않는다.
 */
import type { AwardRow } from "./data";
import { GAP_REASON_LABEL, GAP_REASON_RATIO, GAP_REASONS, SPONSOR_STATUS_LABEL, gapOf, isGapReason, isSponsorStatus } from "./contract-gap";

export type ContractState =
  /** 기관 보고 전 */
  | "awaiting_report"
  /** 기관 보고 뒤 의뢰자 확인 대기(기한 지나면 자동 확정) */
  | "to_confirm"
  /** 의뢰자 이의, 운영자 확인 중(정산 멈춤) */
  | "disputed"
  /** 확정 */
  | "confirmed"
  /** 계약하지 않음 */
  | "not_signed";

export type AgentContractView = {
  lab: string;
  awardedAt: string;
  /** 선정 견적 금액(성사 수수료 판정 기준과 같은 값) */
  quoteAmount: number | null;
  state: ContractState;
  report: { date: string; amount: number; gapReason: string | null; gapReasonLabel: string | null; note: string | null; reportedAt: string } | null;
  /** 선정 견적 대비 보고 금액 차이 */
  gap: { diff: number; ratio: number } | null;
  confirmDueAt: string | null;
  confirmedAt: string | null;
  confirmedVia: "sponsor" | "auto" | "operator" | "legacy" | null;
  /** 의뢰자가 알린 계약 결과(의뢰자에게만) */
  sponsor: { status: string; label: string; amount: number | null; date: string | null; reportedAt: string } | null;
  /** 의뢰자가 계약했다고 알렸는지(기관에게만, 보고 요청 신호) */
  sponsorSaysSigned: boolean;
  /** 지금 할 수 있는 동작. 단추 라우트가 다시 확인한다 */
  can: { report: boolean; correct: boolean; confirm: boolean; tellResult: boolean };
  /** 기관 보고 규칙: 선정 견적과 이 비율 이상 다르면 사유 필수, 사유 목록 */
  gapRule: { ratio: number; reasons: { id: string; label: string }[] };
};

type Award = Pick<
  AwardRow,
  | "cro_name" | "awarded_at" | "contract_status" | "contract_date" | "contract_amount" | "contract_gap_reason" | "contract_note" | "contract_reported_at"
  | "contract_confirm_due_at" | "contract_confirmed_at" | "contract_confirmed_via" | "requester_confirmed_at" | "confirmed_auto"
  | "requester_disputed_at" | "dispute_resolved_at" | "sponsor_contract_status" | "sponsor_contract_amount" | "sponsor_contract_date" | "sponsor_reported_at"
>;

const OPEN = ["selected", "contracting"];

export function contractView(role: "requester" | "cro", a: Award, rfqStatus: string, quoteAmount: number | null): AgentContractView {
  const confirmedAt = a.contract_confirmed_at ?? a.requester_confirmed_at ?? null;
  const viaRaw = a.contract_confirmed_via ?? (a.requester_confirmed_at ? (a.confirmed_auto ? "auto" : "sponsor") : null);
  const confirmedVia = viaRaw === "sponsor" || viaRaw === "auto" || viaRaw === "operator" || viaRaw === "legacy" ? viaRaw : null;
  const disputeOpen = !!(a.requester_disputed_at && !a.dispute_resolved_at && !confirmedAt);
  const reported = a.contract_reported_at;
  const state: ContractState = confirmedAt
    ? "confirmed"
    : a.contract_status === "not_signed"
      ? "not_signed"
      : disputeOpen
        ? "disputed"
        : reported && a.contract_status === "signed"
          ? "to_confirm"
          : "awaiting_report";
  const open = OPEN.includes(rfqStatus);
  const report =
    reported && a.contract_date && a.contract_amount != null
      ? {
          date: a.contract_date,
          amount: a.contract_amount,
          gapReason: a.contract_gap_reason ?? null,
          gapReasonLabel: isGapReason(a.contract_gap_reason) ? GAP_REASON_LABEL[a.contract_gap_reason] : null,
          note: a.contract_note ?? null,
          reportedAt: reported,
        }
      : null;
  const g = report ? gapOf(quoteAmount, report.amount) : null;
  const dueAt = a.contract_confirm_due_at ?? (reported ? new Date(new Date(reported).getTime() + 7 * 864e5).toISOString() : null);
  const sponsor =
    role === "requester" && isSponsorStatus(a.sponsor_contract_status) && a.sponsor_reported_at
      ? { status: a.sponsor_contract_status, label: SPONSOR_STATUS_LABEL[a.sponsor_contract_status], amount: a.sponsor_contract_amount ?? null, date: a.sponsor_contract_date ?? null, reportedAt: a.sponsor_reported_at }
      : null;
  return {
    lab: a.cro_name,
    awardedAt: a.awarded_at,
    quoteAmount,
    state,
    report,
    gap: g ? { diff: g.diff, ratio: g.ratio } : null,
    confirmDueAt: state === "to_confirm" ? dueAt : null,
    confirmedAt,
    confirmedVia,
    sponsor,
    sponsorSaysSigned: role === "cro" && !reported && a.sponsor_contract_status === "signed",
    can: {
      // 기관: 보고 전이면 보고, 확인 전이면 정정(의뢰자가 다시 확인한다). 이의 중·확정 뒤는 운영자가 정리한다
      report: role === "cro" && open && state === "awaiting_report",
      correct: role === "cro" && open && state === "to_confirm",
      // 의뢰자: 기관 보고가 있으면 확인·이의, 보고 전이면 계약 결과 알리기
      confirm: role === "requester" && open && state === "to_confirm",
      tellResult: role === "requester" && open && state === "awaiting_report",
    },
    gapRule: { ratio: GAP_REASON_RATIO, reasons: GAP_REASONS.map((id) => ({ id, label: GAP_REASON_LABEL[id] })) },
  };
}
