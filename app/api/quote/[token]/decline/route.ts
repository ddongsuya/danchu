import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sessionOrNull } from "@/lib/auth";
import { adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { publishIfAllReplied } from "@/lib/compare";
import { closedMessage, endOfDaySeoul, loadQuote } from "@/lib/quote-load";

export const runtime = "nodejs";

/** POST { reason? } — 이번 요청은 회신하지 않음 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const got = await loadQuote(token);
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });
  if (got.draft?.status === "submitted") return NextResponse.json({ error: "이미 제출한 회신은 취소할 수 없습니다. 단추에 문의해 주세요." }, { status: 400 });
  if (got.declined) return NextResponse.json({ ok: true, already: true });
  if (got.expired) return NextResponse.json({ error: "링크가 만료되었습니다." }, { status: 403 });
  if (got.closed) return NextResponse.json({ error: closedMessage(got.closedReason) }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
  const sb = getSupabaseAdmin()!;
  const { error } = await sb.from("rfq_invites").update({ status: "declined", declined_at: new Date().toISOString(), decline_reason: reason || null }).eq("id", got.inviteId);
  if (error) return NextResponse.json({ error: "처리하지 못했습니다." }, { status: 500 });
  const s = await sessionOrNull();
  await logEvent(got.rfqId, "declined", `${got.croName} 회신하지 않음`, reason || undefined, s?.userId ?? null);
  // 운영자는 앱 알림만. 메일은 예약 작업이 하루 한 번 모아서 보낸다
  await notifyUsers(await adminUserIds(), { kind: "견적", title: `${got.rfq.no} 회신하지 않음 · ${got.croName}`, body: reason || undefined, href: `/admin/r/${got.rfq.no}` });
  // 남은 기관이 모두 답했고 제출된 견적이 있으면 비교표를 바로 연다 (의뢰자에게는 비교표 알림이 간다)
  if (await publishIfAllReplied(got.rfqId).catch(() => false)) return NextResponse.json({ ok: true });
  // 의뢰자에게는 기관명 없이 숫자만. 선정 전 기관 정보는 비교표에서만 본다
  const { data: rq } = await sb.from("rfq_requests").select("user_id, status").eq("id", got.rfqId).maybeSingle();
  if (rq?.user_id && !["closed", "cancelled"].includes(rq.status)) {
    const { data: all } = await sb.from("rfq_invites").select("status").eq("rfq_id", got.rfqId).neq("status", "expired");
    const total = (all ?? []).length;
    const declined = (all ?? []).filter((i) => i.status === "declined").length;
    await notifyUsers([rq.user_id], { kind: "견적", title: `${got.rfq.no} 전달한 ${total}곳 중 ${declined}곳이 회신하지 않습니다`, body: declined >= total ? "회신할 기관이 남지 않았습니다. 운영자가 다른 기관을 찾아 다시 전달합니다." : "나머지 기관의 회신을 기다리는 중입니다. 빈 자리는 운영자가 다른 기관으로 채웁니다.", href: `/app/r/${got.rfq.no}` });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE — "회신하지 않음"을 되돌린다. 회신 마감 전이고 비교표가 열리기 전에만.
 * 저장해 둔 초안이 있으면 초안 상태로, 없으면 받은 상태로 돌아간다.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const got = await loadQuote(token);
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });
  if (!got.declined) return NextResponse.json({ ok: true, already: true });
  if (got.expired) return NextResponse.json({ error: "링크가 만료되었습니다." }, { status: 403 });
  if (got.closed) return NextResponse.json({ error: closedMessage(got.closedReason) }, { status: 403 });
  if (Date.now() > endOfDaySeoul(got.rfq.replyBy)) return NextResponse.json({ error: "회신 마감이 지나 되돌릴 수 없습니다." }, { status: 403 });
  const sb = getSupabaseAdmin()!;
  const { data: saved } = await sb.from("cro_quotes").select("id").eq("invite_id", got.inviteId).maybeSingle();
  const { error } = await sb
    .from("rfq_invites")
    .update({ status: saved ? "draft" : "sent", declined_at: null, decline_reason: null })
    .eq("id", got.inviteId)
    .eq("status", "declined");
  if (error) return NextResponse.json({ error: "처리하지 못했습니다." }, { status: 500 });
  const s = await sessionOrNull();
  await logEvent(got.rfqId, "declined", `${got.croName} 회신하지 않음 취소`, undefined, s?.userId ?? null, { undo: true });
  await notifyUsers(await adminUserIds(), { kind: "견적", title: `${got.rfq.no} 회신하지 않음 취소 · ${got.croName}`, body: "다시 회신을 준비합니다.", href: `/admin/r/${got.rfq.no}` });
  return NextResponse.json({ ok: true });
}
