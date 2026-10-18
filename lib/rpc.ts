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
 * 실패 code: closed 선정·마감 · revoked 철회·토큰 재발급 · expired 기한 만료 · declined 회신하지 않음 · org_inactive 기관 중지 · not_member 소속 아님
 */
export function saveQuote(inviteId: string, header: QuoteHeader, items: QuoteItemInput[], submit: boolean, actorId: string | null, token: string) {
  return call<SaveQuoteResult, "save_quote">("save_quote", { p_invite_id: inviteId, p_header: header as unknown as Json, p_items: items as unknown as Json, p_submit: submit, p_actor: actorId, p_token: token });
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
