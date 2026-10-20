/**
 * 회신 창과 비교표 공개 (2026-10-20 결정 1, 0025). 화면·라우트·cron 이 같이 쓰는 순수 함수만 둔다 (브라우저에서도 import 한다).
 *
 * - rfq_requests.compared_at 은 "비교표가 열린 시각"이다. 열리기 전 의뢰자에게는 진행 숫자(참여 n곳, 제출 m곳)와
 *   의뢰자가 지명한 기관의 이름·참여 여부만 보인다. 일반 기관의 이름·금액·견적은 열릴 때 함께 공개한다.
 * - 비교표는 참여한 기관(철회 제외)이 모두 제출하고 더 참여할 수 없을 때(자리가 찼거나 참여 결정 기한이 지남),
 *   또는 회신 기한 다음 날 cron 이 연다 (제출 0건이면 열지 않는다). 운영자의 "회신 마감"도 같은 일을 한다 (lib/compare.ts).
 * - 기관은 비교표가 열리기 전까지 제출한 견적을 고칠 수 있다. 열리면 모든 회신이 닫히므로, 의뢰자가 보는 견적은 더 바뀌지 않는다.
 * - 선정은 비교표가 열린 뒤에만 한다 (0025 select_quote 는 열리기 전이면 not_compared). 기한 전 선정 단계는 없다.
 * - 운영자가 기한을 늘려 다시 열면 compared_at 이 비워지고, 의뢰자 화면은 다시 숫자만 보인다.
 */

import { occupiesSeat, type JoinFields } from "./request-policy";

/** 'YYYY-MM-DD'의 서울 기준 그날 23:59:59 (ms) */
export function endOfDaySeoul(ymd: string): number {
  return new Date(`${ymd.slice(0, 10)}T23:59:59+09:00`).getTime();
}

/** 회신 기한 전인지 (기한 당일 자정까지 포함). 기한이 없으면 false */
export function beforeDeadline(replyBy: string | null | undefined, now = Date.now()): boolean {
  return !!replyBy && now <= endOfDaySeoul(replyBy);
}

const CLOSED_STATUSES = ["selected", "contracting", "closed", "cancelled"];

/** 이 요청의 회신이 닫혔는지: 회신 마감(compared_at), 선정, 종료·취소 */
export function repliesClosed(rfq: { status: string; compared_at: string | null }): boolean {
  return !!rfq.compared_at || CLOSED_STATUSES.includes(rfq.status);
}

/** cron 이 이 요청의 회신을 마감해야 하는지: 아직 열려 있고 기한이 지났다 (제출 수는 호출한 쪽이 센다) */
export function closeRepliesDue(rfq: { compared_at: string | null; reply_by: string | null; status: string }, today: string): boolean {
  if (rfq.compared_at) return false;
  if (!["distributed", "quoted"].includes(rfq.status)) return false;
  return !!rfq.reply_by && rfq.reply_by < today;
}

/**
 * 참여한 기관 중 아직 제출하지 않은 수 (0023). 참여 결정 전 안내, 불참·철회·취소·만료는 세지 않는다.
 * 의뢰자는 참여한 기관만 보므로 "아직 회신하지 않은 기관"도 참여한 기관 안에서 센다
 */
export function pendingInvites(invites: JoinFields[]): number {
  return invites.filter((i) => occupiesSeat(i) && i.status !== "submitted").length;
}

/**
 * 의뢰자에게 견적(기관명·금액·견적서)을 보여 줘도 되는지 (2026-10-20 결정 1).
 * 비교표가 열렸거나(compared_at) 이미 선정한 요청만. 비교표가 열리기 전에 마무리(보류·취소·외부 진행)한 요청도 보여 주지 않는다
 */
export function comparisonOpened(rfq: { compared_at: string | null; selected_quote_id?: string | null }): boolean {
  return !!rfq.compared_at || !!rfq.selected_quote_id;
}
