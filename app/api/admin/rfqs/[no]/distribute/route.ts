import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo } from "@/lib/data";
import { distributeTo, ORG_COLUMNS } from "@/lib/distribute";
import { todaySeoul } from "@/lib/format";

export const runtime = "nodejs";

/**
 * POST { orgIds: string[], replyBy: 'YYYY-MM-DD', autoDistribute?: boolean } — 운영자가 고른 승인 기관에 초대(회신 링크)를 보낸다.
 * 접수 시 자동 배포에서 빠진 기관을 추가하거나, 자동 배포가 없었을 때 쓴다.
 * autoDistribute 를 false 로 주면 이후 cron 보충 배포가 이 요청을 건드리지 않는다 (운영자가 고른 기관만 유지).
 */
const BLOCKED_MSG = {
  request_not_open: "비교표가 공개되었거나 선정이 끝난 요청이라 더 배포할 수 없습니다. 다시 열려면 운영자 문의 후 SQL 로 compared_at 을 비워야 합니다.",
  invitation_limit_reached: "의뢰자가 요청한 기관 수에 이미 닿았습니다. 회신하지 않음·만료 초대는 한도에서 빠지므로, 다른 초대를 정리한 뒤 다시 시도하세요.",
};
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (["closed", "cancelled"].includes(rfq.status)) return NextResponse.json({ error: "종료된 요청입니다." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as { orgIds?: unknown; replyBy?: unknown; autoDistribute?: unknown };
  const orgIds = Array.isArray(b.orgIds) ? (b.orgIds as unknown[]).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)) : [];
  const replyBy = typeof b.replyBy === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.replyBy) ? b.replyBy : "";
  if (!orgIds.length || !replyBy) return NextResponse.json({ error: "기관과 회신 기한을 선택해 주세요." }, { status: 400 });
  if (replyBy < todaySeoul()) return NextResponse.json({ error: "회신 기한은 오늘 이후여야 합니다. 지난 기한이면 먼저 '회신 기한 변경'으로 늘려 주세요." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  if (b.autoDistribute === false && rfq.auto_distribute !== false) {
    await sb.from("rfq_requests").update({ auto_distribute: false }).eq("id", rfq.id);
  }
  const { data: orgs } = await sb.from("cro_orgs").select(ORG_COLUMNS).in("id", orgIds).eq("status", "approved");
  const r = await distributeTo(rfq, orgs ?? [], replyBy, s.userId, false, "manual");
  if (r.blocked && !r.sent) return NextResponse.json({ error: BLOCKED_MSG[r.blocked] }, { status: 409 });
  return NextResponse.json({ ok: true, sent: r.sent, mailed: r.mailed, skipped: r.skipped, capped: r.capped, blocked: r.blocked ? BLOCKED_MSG[r.blocked] : undefined });
}
