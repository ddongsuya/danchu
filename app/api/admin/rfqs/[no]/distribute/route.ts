import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo } from "@/lib/data";
import { distributeTo, ORG_COLUMNS } from "@/lib/distribute";
import { todaySeoul } from "@/lib/format";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * 참여 안내 추가 (0023). POST { orgIds: string[], replyBy: 'YYYY-MM-DD', autoDistribute?: boolean }
 * 운영자가 고른 승인 기관(분야 밖 기관, 운영자 관리 기관 포함)에 참여 안내(source = manual)를 만든다.
 * 안내만 만들고 참여 기록은 쓰지 않는다. 참여는 기관이 링크에서 직접 눌러야 한다 (join_offer, 운영자는 operator_not_allowed).
 * autoDistribute 를 false 로 주면 이후 cron 보충 안내가 이 요청을 건드리지 않는다 (운영자가 고른 기관만 유지).
 * 회신 기한은 모든 기관이 같다 (설계 규칙표 "기한"). 요청에 회신 기한이 있으면 그 값으로 고정하고 body 의 replyBy 는 쓰지 않는다.
 *   기한을 바꾸려면 "회신 기한 변경"(deadline 라우트)을 쓴다. 요청에 기한이 없을 때(0023 전 요청 등)만 replyBy 를 받는다.
 * "지명 기관에만 안내"(nominees_only) 요청: 의뢰자가 따로 요청한 경우에만 다른 기관에 안내한다 (약관 제4조2항).
 *   overrideNomineesOnly: true 와 사유(overrideReason)가 없으면 409. 보내면 감사 기록(rfq.distribute_override)에 사유를 남긴다.
 */
const BLOCKED_MSG = {
  request_not_open: "회신이 마감되었거나 선정이 끝난 요청이라 참여 안내를 더 보낼 수 없습니다. 회신 마감 뒤라면 회신 기한을 늘려 다시 연 다음 안내해 주세요.",
  // 운영자 수동 안내(manual)는 막히지 않는다. 자동 매칭 안내만 해당 (0023)
  nominees_only: "의뢰자가 지명 기관에만 안내하도록 고른 요청입니다. 자동 매칭 안내는 보내지 않습니다.",
};
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (["closed", "cancelled"].includes(rfq.status)) return NextResponse.json({ error: "종료된 요청입니다." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as { orgIds?: unknown; replyBy?: unknown; autoDistribute?: unknown; overrideNomineesOnly?: unknown; overrideReason?: unknown };
  const orgIds = Array.isArray(b.orgIds) ? (b.orgIds as unknown[]).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)) : [];
  // 요청에 회신 기한이 있으면 모든 기관이 같은 기한이다 (기관마다 다른 기한을 고를 수 없다)
  const asked = typeof b.replyBy === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.replyBy) ? b.replyBy : "";
  const replyBy = rfq.reply_by || asked;
  if (!orgIds.length || !replyBy) return NextResponse.json({ error: "기관과 회신 기한을 선택해 주세요." }, { status: 400 });
  if (replyBy < todaySeoul()) return NextResponse.json({ error: "회신 기한은 오늘 이후여야 합니다. 지난 기한이면 먼저 '회신 기한 변경'으로 늘려 주세요." }, { status: 400 });
  const overrideReason = typeof b.overrideReason === "string" ? b.overrideReason.trim().slice(0, 300) : "";
  if (rfq.nominees_only && (b.overrideNomineesOnly !== true || overrideReason.length < 2)) {
    return NextResponse.json({ error: "의뢰자가 '지명 기관에만 안내'를 고른 요청입니다. 의뢰자가 다른 기관에도 안내해 달라고 요청한 경우에만 보낼 수 있습니다. 확인란을 체크하고 요청 내용(사유)을 적어 주세요." }, { status: 409 });
  }

  const sb = getSupabaseAdmin()!;
  if (b.autoDistribute === false && rfq.auto_distribute !== false) {
    await sb.from("rfq_requests").update({ auto_distribute: false }).eq("id", rfq.id);
  }
  const { data: orgs } = await sb.from("cro_orgs").select(ORG_COLUMNS).in("id", orgIds).eq("status", "approved");
  const r = await distributeTo(rfq, orgs ?? [], replyBy, s.userId, false, "manual");
  if (r.blocked && !r.sent) return NextResponse.json({ error: BLOCKED_MSG[r.blocked] }, { status: 409 });
  if (rfq.nominees_only && r.sent) {
    await audit({ userId: s.userId, email: s.email }, "rfq.distribute_override", { type: "rfq_request", id: rfq.id, label: rfq.rfq_no }, { after: { orgs: (orgs ?? []).map((o) => o.name), sent: r.sent }, note: overrideReason });
  }
  return NextResponse.json({ ok: true, sent: r.sent, mailed: r.mailed, skipped: r.skipped, blocked: r.blocked ? BLOCKED_MSG[r.blocked] : undefined });
}
