/**
 * 견적·계약 금액 차이와 우회 계약 신호 (0034, 2026-11-03 대표 요구 3).
 * - 계약 금액이 선정 견적과 10% 이상 다르면 기관은 차이 사유를 골라야 보고할 수 있다 (DB report_contract 와 같은 기준)
 * - 의뢰자도 계약 결과를 알릴 수 있다. 양쪽이 다르거나 금액이 크게 낮으면 운영자 화면 "확인할 신호"에 띄운다
 * 신호는 판단이 아니라 확인할 거리다. 화면 문구도 "확인해 주세요" 수준에서 멈춘다.
 */

/** 차이 사유가 필요한 비율 (DB contract_gap_needs_reason 과 같다) */
export const GAP_REASON_RATIO = 0.1;
/** 계약 금액이 이만큼 낮으면 운영자 신호 */
export const GAP_LOW_SIGNAL_RATIO = 0.2;
/** 의뢰자에게 계약 결과를 묻는 날 (선정 뒤, 기관 보고가 없을 때) */
export const SPONSOR_ASK_DAYS = 21;

export const GAP_REASONS = ["scope", "price", "schedule", "other"] as const;
export type GapReason = (typeof GAP_REASONS)[number];
export const GAP_REASON_LABEL: Record<GapReason, string> = {
  scope: "시험 범위 변경",
  price: "단가·할인 조정",
  schedule: "일정 변경",
  other: "기타",
};

export type SponsorStatus = "signed" | "negotiating" | "not_signed";
export const SPONSOR_STATUS_LABEL: Record<SponsorStatus, string> = {
  signed: "계약했어요",
  negotiating: "협의 중이에요",
  not_signed: "계약하지 않기로 했어요",
};

export function isGapReason(v: unknown): v is GapReason {
  return typeof v === "string" && (GAP_REASONS as readonly string[]).includes(v);
}
export function isSponsorStatus(v: unknown): v is SponsorStatus {
  return v === "signed" || v === "negotiating" || v === "not_signed";
}

export type Gap = { quote: number; amount: number; diff: number; ratio: number; needsReason: boolean };

/** 선정 견적 대비 계약 금액. 견적 금액이 없으면 null */
export function gapOf(quote: number | null | undefined, amount: number | null | undefined): Gap | null {
  if (!quote || quote <= 0 || amount == null) return null;
  const diff = amount - quote;
  // DB 와 같은 정수 비교 (|차이| × 10 ≥ 견적)
  return { quote, amount, diff, ratio: diff / quote, needsReason: Math.abs(diff) * 10 >= quote };
}

/** "선정 견적보다 1,200만 원(12%) 낮아요" */
export function gapLabel(g: Gap, won: (n: number) => string): string {
  if (g.diff === 0) return "선정 견적과 같아요";
  const pct = Math.round(Math.abs(g.ratio) * 100);
  return `선정 견적보다 ${won(Math.abs(g.diff))}${pct ? `(${pct}%)` : ""} ${g.diff > 0 ? "높아요" : "낮아요"}`;
}

export type SignalAward = {
  quoteAmount: number | null;
  contractAmount: number | null;
  contractStatus: string;
  contractReportedAt: string | null;
  contractConfirmedAt: string | null;
  gapReason: string | null;
  sponsorStatus: string | null;
  sponsorAmount: number | null;
  awardedAt: string;
};

export type SignalKind = "low_amount" | "sponsor_signed_no_report" | "sponsor_says_not_signed" | "cro_not_signed_sponsor_signed" | "amount_mismatch";
export type Signal = { kind: SignalKind; label: string };

/**
 * 운영자가 확인할 신호. 확정된 계약도 금액 신호는 남긴다 (이미 정산된 건은 조정 항목으로 바로잡는다)
 */
export function contractSignals(a: SignalAward, won: (n: number) => string): Signal[] {
  const out: Signal[] = [];
  const g = gapOf(a.quoteAmount, a.contractStatus === "signed" ? a.contractAmount : null);
  if (g && g.ratio <= -GAP_LOW_SIGNAL_RATIO) {
    out.push({ kind: "low_amount", label: `계약 금액이 ${gapLabel(g, won)}${a.gapReason && isGapReason(a.gapReason) ? ` · 사유 ${GAP_REASON_LABEL[a.gapReason]}` : ""}` });
  }
  const reported = !!a.contractReportedAt && a.contractStatus === "signed";
  if (a.sponsorStatus === "signed") {
    if (a.contractStatus === "not_signed") out.push({ kind: "cro_not_signed_sponsor_signed", label: "기관 쪽은 미체결인데 의뢰자는 계약했다고 알렸어요" });
    else if (!reported) out.push({ kind: "sponsor_signed_no_report", label: `의뢰자는 계약했다고 알렸는데 기관 보고가 없어요${a.sponsorAmount ? ` · 의뢰자 알림 ${won(a.sponsorAmount)}` : ""}` });
    else if (a.sponsorAmount && a.contractAmount != null && a.sponsorAmount !== a.contractAmount) {
      out.push({ kind: "amount_mismatch", label: `금액이 달라요 · 기관 보고 ${won(a.contractAmount)} · 의뢰자 알림 ${won(a.sponsorAmount)}` });
    }
  }
  if (a.sponsorStatus === "not_signed" && reported) out.push({ kind: "sponsor_says_not_signed", label: "기관은 체결을 보고했는데 의뢰자는 계약하지 않았다고 알렸어요" });
  return out;
}

/** 선정 뒤 의뢰자에게 계약 결과를 물을 때인지 (기관 보고·의뢰자 알림이 모두 없을 때 한 번) */
export function shouldAskSponsor(a: { awardedAt: string; contractReportedAt: string | null; contractStatus: string; sponsorReportedAt: string | null }, now = Date.now()): boolean {
  if (a.contractReportedAt || a.sponsorReportedAt || a.contractStatus === "not_signed") return false;
  return now - new Date(a.awardedAt).getTime() >= SPONSOR_ASK_DAYS * 864e5;
}

/** 기관 이름 비교용: 법인 표기·공백·괄호를 뺀다 ("(주)바이오텍 연구소" → "바이오텍연구소") */
export function orgKey(name: string): string {
  return name.replace(/\(주\)|㈜|주식회사|\(재\)|재단법인|\(사\)|사단법인|co\.?,?\s*ltd\.?|inc\.?|corp\.?/gi, "").replace(/[\s()·.,\-_]/g, "").toLowerCase();
}

/**
 * "외부 진행"으로 마친 요청의 메모에 참여 안내를 받은 기관 이름이 들어 있으면 그 기관 이름들.
 * 단추에서 견적을 받고 선정 없이 같은 기관과 진행했다는 뜻일 수 있어 운영자가 확인한다
 */
export function externalWithInvited(note: string | null | undefined, invitedNames: string[]): string[] {
  const n = orgKey(note ?? "");
  if (n.length < 2) return [];
  return [...new Set(invitedNames.filter((x) => { const k = orgKey(x); return k.length >= 2 && n.includes(k); }))];
}
