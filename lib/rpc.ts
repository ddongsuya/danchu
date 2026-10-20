/**
 * 다단계 쓰기를 한 트랜잭션으로 끝내는 Postgres 함수 호출 (supabase/migrations/0007_atomic_transitions.sql).
 * 알림·메일·이력은 여기서 보내지 않는다. 호출한 라우트가 결과를 받아 처리한다.
 */
import { getSupabaseAdmin } from "./supabase";
import type { Database, Json, QuoteEntrySource } from "./db-types";

type Fns = Database["public"]["Functions"];

type Fail = { ok: false; code: string };

async function call<T extends { ok: true }, F extends keyof Fns>(fn: F, args: Fns[F]["Args"]): Promise<T | Fail> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, code: "no_db" };
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    console.error(`rpc ${fn}`, error.message);
    return { ok: false, code: "db_error" };
  }
  const d = data as { ok?: boolean; code?: string } | null;
  if (!d || d.ok !== true) return { ok: false, code: d?.code ?? "unknown" };
  return d as T;
}

/* ── 의뢰자 CRO 선택 ── */
export type SelectQuoteResult = { ok: true; award_id: string; invite_id: string; cro_org_id: string | null; cro_name: string; revision?: number };
/**
 * revision: 선정 확인 화면이 보여 준 견적 판 (cro_quotes.revision). 그 사이 기관이 견적을 고쳤으면 quote_changed 로 거절된다 (0022).
 * 동시 선정은 요청 행 잠금으로 한 건만 성공하고 나머지는 already_selected.
 */
export function selectQuote(rfqId: string, quoteId: string, userId: string, revision: number) {
  return call<SelectQuoteResult, "select_quote">("select_quote", { p_rfq_id: rfqId, p_quote_id: quoteId, p_user: userId, p_revision: revision });
}
export const QUOTE_CHANGED_MESSAGE = "견적이 바뀌었습니다. 바뀐 내용을 다시 확인한 뒤 선택해 주세요.";
export const SELECT_QUOTE_ERRORS: Record<string, { message: string; status: number }> = {
  not_found: { message: "요청을 찾을 수 없습니다.", status: 404 },
  not_open: { message: "마무리된 요청이라 선택할 수 없습니다.", status: 409 },
  already_selected: { message: "이미 CRO를 선택했습니다.", status: 409 },
  bad_quote: { message: "선택할 수 없는 견적입니다.", status: 400 },
  quote_changed: { message: QUOTE_CHANGED_MESSAGE, status: 409 },
};

/* ── CRO 회신 저장·제출 ── */
export type QuoteHeader = {
  total_amount: number | null;
  total_weeks: number | null;
  vat?: string;
  valid_until: string | null;
  auto?: boolean;
  start_date: string | null;
  pay_terms: string | null;
  substance_qty: string | null;
  report_lang: string | null;
  includes: string[];
  note: string;
  /** 주어질 때만 덮어쓴다 */
  pdf_path?: string;
  pdf_name?: string;
  pdf_size?: number;
  /** 입력 주체 (0019). 제출 때만 기록하고, 없으면 기관(cro) */
  entry_source?: QuoteEntrySource;
};
export type QuoteItemInput = {
  seq: number;
  category: string;
  name: string;
  cond: string | null;
  avail: string | null;
  amount: number | null;
  weeks: number | null;
  reason: string | null;
  design: Record<string, unknown>;
  source: string;
  unit: string;
  unit_price: number | null;
  sample_count: number | null;
};
export type SaveQuoteResult = { ok: true; quote_id: string; skipped?: boolean; first?: boolean; total_invites?: number; submitted_invites?: number };
/**
 * token: 화면을 연 링크의 토큰. save_quote 가 잠금을 얻은 뒤 지금 토큰과 같은지, 철회·만료·기관 중지·소속 변경이 없는지 다시 본다 (0021).
 * 실패 code: closed 선정·마감 · revoked 철회·토큰 재발급 · expired 기한 만료 · declined 회신하지 않음 · org_inactive 기관 중지 · not_member 소속 아님 ·
 *   not_joined 기관이 참여하기 전(운영자 대리 입력 포함, 0023) · withdrawn 참여 철회
 */
export function saveQuote(inviteId: string, header: QuoteHeader, items: QuoteItemInput[], submit: boolean, actorId: string | null, token: string) {
  return call<SaveQuoteResult, "save_quote">("save_quote", { p_invite_id: inviteId, p_header: header as unknown as Json, p_items: items as unknown as Json, p_submit: submit, p_actor: actorId, p_token: token });
}

/* ── 기관 참여·철회 (0023) ── */
export type SeatState = { cap: number | null; used: number; reserved: number; open: number | null; join_by: string | null };
export type JoinOfferResult = { ok: true; already?: boolean; joined_at: string; channel: "portal" | "token" | "legacy"; seats: SeatState };
/**
 * 기관이 참여하기를 누른다. 요청 행을 잠그고 자리를 세므로 동시에 눌러도 자리를 넘지 않는다.
 * channel: portal(로그인한 그 기관 담당자) · token(회신 링크). 운영자 계정이면 operator_not_allowed (대신 참여 불가).
 * termsVersion: 참여 화면에 보여 준 이용 조건 판. ip·ua 와 함께 참여 기록으로 남는다.
 * 실패 code: closed · revoked · withdrawn · declined · expired · operator_not_allowed · not_member · org_inactive ·
 *   cutoff 참여 마감 · reserved 남은 자리가 지명 기관 몫 · full 자리 없음 · bad_channel · terms_required
 */
export function joinOffer(inviteId: string, token: string, opts: { actorId: string | null; channel: "portal" | "token"; termsVersion: string; ip: string | null; ua: string | null }) {
  return call<JoinOfferResult, "join_offer">("join_offer", { p_invite_id: inviteId, p_token: token, p_actor: opts.actorId, p_channel: opts.channel, p_terms_version: opts.termsVersion, p_ip: opts.ip, p_ua: opts.ua });
}
/** 요청의 자리 현황 (offer_seat_state). 읽지 못하면 null (화면은 "-" 로 보인다) */
export async function offerSeatState(rfqId: string): Promise<SeatState | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.rpc("offer_seat_state", { p_rfq_id: rfqId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return { cap: num(d.cap), used: num(d.used) ?? 0, reserved: num(d.reserved) ?? 0, open: num(d.open), join_by: typeof d.join_by === "string" ? d.join_by : null };
}
export type WithdrawOfferResult = { ok: true; already?: boolean; seats?: SeatState };
/** 참여 철회 (제출 전만). 실패 code: closed · revoked · not_member · not_joined 참여 전(불참으로) · submitted · declined · expired */
export function withdrawOffer(inviteId: string, token: string, actorId: string | null, reason: string | null) {
  return call<WithdrawOfferResult, "withdraw_offer">("withdraw_offer", { p_invite_id: inviteId, p_token: token, p_actor: actorId, p_reason: reason });
}

/* ── CRO 계약 체결 보고 ── */
export type ReportContractResult = { ok: true; rfq_id: string; rfq_no: string; user_id: string | null; substance: string; corrected: boolean };
/** force: 이미 보고된 계약을 정정 (운영자만) */
export function reportContract(awardId: string, date: string, amount: number, note: string, force = false) {
  return call<ReportContractResult, "report_contract">("report_contract", { p_award_id: awardId, p_date: date, p_amount: amount, p_note: note, p_force: force });
}
export const REPORT_CONTRACT_ERRORS: Record<string, { message: string; status: number }> = {
  not_found: { message: "수주 기록이 없습니다.", status: 404 },
  already: { message: "이미 보고한 계약입니다. 정정이 필요하면 단추(hello@danchu.kr)에 알려 주세요.", status: 409 },
  amount: { message: "계약금액은 1원 이상이어야 합니다.", status: 400 },
  date: { message: "체결일이 선정일보다 앞설 수 없습니다.", status: 400 },
  future: { message: "체결일은 오늘 이전 날짜여야 합니다.", status: 400 },
};
