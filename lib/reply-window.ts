/**
 * 회신 창과 실시간 비교 (2026-10-17 결정). 화면·라우트·cron 이 같이 쓰는 순수 함수만 둔다 (브라우저에서도 import 한다).
 *
 * - 비교표에는 공개 단계가 없다. 기관이 견적을 제출하는 순간 의뢰자 비교표에 기관명과 함께 나타나고 의뢰자는 바로 확인한다.
 *   다른 기관은 어느 경우에도 그 견적을 보지 못한다.
 * - 기관은 회신 기한(reply_by, 서울 기준 그날 자정)까지 제출한 견적을 고칠 수 있다. 그래서 기한 전 열에는 "기한 전 (수정될 수 있음)"을 붙인다.
 * - rfq_requests.compared_at 은 "회신 마감 시각"이다 (0019). 이름은 예전 "비교표 공개"에서 왔지만 뜻이 바뀌었다.
 *   기한 다음 날 cron(제출 1건 이상) 또는 운영자의 "회신 마감"이 채우고, 채워지면 아직 내지 않은 기관을 포함해 모든 회신이 닫힌다.
 *   운영자가 기한을 늘리면 비워져 다시 열린다. 의뢰자 요약 알림은 마감할 때 한 번 보낸다 (lib/compare.ts closeReplies).
 * - 의뢰자는 제출된 견적이 1건 이상이면 언제든 선정할 수 있다. 선정하면 상태가 selected 가 되어 남은 회신 링크가 닫힌다.
 *   기한 전이거나 아직 회신하지 않은 기관이 있으면 선정 화면에서 한 번 더 확인한다 (selectionCaution).
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

/** 비교표 열이 아직 바뀔 수 있는지: 회신이 열려 있고 그 기관의 기한 전 */
export function quoteRevisable(rfq: { status: string; compared_at: string | null }, replyBy: string | null | undefined, now = Date.now()): boolean {
  return !repliesClosed(rfq) && beforeDeadline(replyBy, now);
}

export const REVISABLE_LABEL = "기한 전 (수정될 수 있음)";

/**
 * 선정 전에 한 번 더 확인할 내용. 기한 전이거나 아직 회신하지 않은 기관이 있으면 needed.
 * 확인 문구에는 기한, 미회신 기관 수, 선정하면 남은 회신 링크가 닫힌다는 사실을 적는다.
 */
export function selectionCaution(rfq: { status: string; compared_at: string | null; reply_by: string | null }, invites: JoinFields[], now = Date.now()): { needed: boolean; early: boolean; pending: number; replyBy: string | null } {
  const open = !repliesClosed(rfq);
  const early = open && beforeDeadline(rfq.reply_by, now);
  const pending = open ? pendingInvites(invites) : 0;
  return { needed: early || pending > 0, early, pending, replyBy: rfq.reply_by };
}
