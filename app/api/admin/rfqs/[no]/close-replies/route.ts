import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getRfqByNo } from "@/lib/data";
import { closeReplies } from "@/lib/compare";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST: 운영자의 회신 마감 (compared_at 을 채운다). 비교표 공개 단계는 없다: 의뢰자는 첫 견적부터 비교표를 본다.
 * 기한이 지나면 다음 날 cron 이 같은 일을 한다. 기한 전 마감은 미회신 0곳이거나 의뢰자가 요청한 경우({ sponsorRequested: true })만 되고,
 * 그 요청의 모든 기관에 알린다 (lib/compare.ts, 약관 제4조5항).
 * 다시 열려면 회신 기한을 늘린다 (POST /api/admin/rfqs/[no]/deadline).
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  // 기한 전에 아직 회신하지 않은 기관이 있으면 의뢰자 요청이 있을 때만 마감한다 (약관 제4조5항). 운영자가 확인란으로 표시한다
  const b = (await req.json().catch(() => ({}))) as { sponsorRequested?: unknown };
  const sponsorRequested = b.sponsorRequested === true;
  const r = await closeReplies(rfq, s.userId, false, { sponsorRequested });
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: 400 });
  await audit({ userId: s.userId, email: s.email }, "rfq.close_replies", { type: "rfq_request", id: rfq.id, label: rfq.rfq_no }, { after: { quotes: r.count, pending: r.pending, reply_by: rfq.reply_by, sponsor_requested: sponsorRequested } });
  return NextResponse.json({ ok: true, message: r.message });
}
