/**
 * 다단계 쓰기를 한 트랜잭션으로 끝내는 Postgres 함수 호출 (supabase/migrations/0007_atomic_transitions.sql).
 * 알림·메일·이력은 여기서 보내지 않는다. 호출한 라우트가 결과를 받아 처리한다.
 */
import { getSupabaseAdmin } from "./supabase";
import type { Database, Json } from "./db-types";

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
export type SelectQuoteResult = { ok: true; award_id: string; invite_id: string; cro_org_id: string | null; cro_name: string };
export function selectQuote(rfqId: string, quoteId: string, userId: string) {
  return call<SelectQuoteResult, "select_quote">("select_quote", { p_rfq_id: rfqId, p_quote_id: quoteId, p_user: userId });
}
export const SELECT_QUOTE_ERRORS: Record<string, { message: string; status: number }> = {
  not_found: { message: "요청을 찾을 수 없습니다.", status: 404 },
  not_compared: { message: "비교표가 공개된 뒤에 선택할 수 있습니다.", status: 400 },
  already_selected: { message: "이미 CRO를 선택했습니다.", status: 409 },
  bad_quote: { message: "선택할 수 없는 견적입니다.", status: 400 },
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
export function saveQuote(inviteId: string, header: QuoteHeader, items: QuoteItemInput[], submit: boolean, actorId: string | null) {
  return call<SaveQuoteResult, "save_quote">("save_quote", { p_invite_id: inviteId, p_header: header as unknown as Json, p_items: items as unknown as Json, p_submit: submit, p_actor: actorId });
}

/* ── CRO 계약 체결 보고 ── */
export type ReportContractResult = { ok: true; rfq_id: string; rfq_no: string; user_id: string | null; substance: string };
export function reportContract(awardId: string, date: string, amount: number, note: string) {
  return call<ReportContractResult, "report_contract">("report_contract", { p_award_id: awardId, p_date: date, p_amount: amount, p_note: note });
}
