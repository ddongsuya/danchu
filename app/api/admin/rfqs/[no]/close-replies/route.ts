import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getRfqByNo } from "@/lib/data";
import { closeReplies, EARLY_CLOSE_REFUSED } from "@/lib/compare";
import { beforeDeadline } from "@/lib/reply-window";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST: 회신 기한이 지난 요청의 비교표를 운영자가 연다 (compared_at 을 채운다). 다음 날 예약 작업이 하는 일을 먼저 하는 것뿐이다.
 * 기한 전 마감은 없다 (2026-10-21 결정 2). 의뢰자가 요청해도, 운영자가 판단해도 기한 전에는 409 로 거절한다.
 * 기한 전에 비교표가 열리는 길은 "참여가 마감된 뒤 참여한 기관이 모두 제출"뿐이고, DB(0025 open_comparison_if_ready)가 연다.
 * 빨리 받아야 하는 의뢰자는 요청서에서 회신 기한을 짧게 정한다. 본문은 읽지 않는다 (예전 { sponsorRequested } 는 무시된다).
 * 한 번 열린 비교표는 다시 열거나 기한을 늘릴 수 없다 (2026-10-21 결정 3, 0026).
 */
export async function POST(_req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (!rfq.compared_at && beforeDeadline(rfq.reply_by)) return NextResponse.json({ error: EARLY_CLOSE_REFUSED, code: "early_close_removed" }, { status: 409 });
  const r = await closeReplies(rfq, s.userId, false);
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: r.failed ? 500 : 400 });
  await audit({ userId: s.userId, email: s.email }, "rfq.close_replies", { type: "rfq_request", id: rfq.id, label: rfq.rfq_no }, { after: { quotes: r.count, pending: r.pending, reply_by: rfq.reply_by } });
  return NextResponse.json({ ok: true, message: r.message });
}
