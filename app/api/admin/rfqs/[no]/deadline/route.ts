import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo } from "@/lib/data";
import { logEvent, notifyUsers } from "@/lib/notify";
import { inviteExpiresAt } from "@/lib/request-policy";
import { todaySeoul } from "@/lib/format";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST { replyBy: 'YYYY-MM-DD' } — 회신 기한 변경.
 * 요청의 reply_by 와 아직 열려 있는 초대(sent·draft)의 reply_by·expires_at 을 함께 바꾸고 기관에 알린다.
 * 회신 0건으로 기한이 지난 요청을 다시 살리는 유일한 경로다. 비교표 공개 뒤에는 쓸 수 없다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (!["received", "distributed", "quoted"].includes(rfq.status) || rfq.compared_at) return NextResponse.json({ error: "비교표가 공개되었거나 종료된 요청은 기한을 바꿀 수 없습니다." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as { replyBy?: unknown };
  const replyBy = typeof b.replyBy === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.replyBy) ? b.replyBy : "";
  if (!replyBy || replyBy < todaySeoul()) return NextResponse.json({ error: "회신 기한은 오늘 이후의 날짜여야 합니다." }, { status: 400 });
  if (replyBy === rfq.reply_by) return NextResponse.json({ error: "지금 기한과 같습니다." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const { error } = await sb.from("rfq_requests").update({ reply_by: replyBy }).eq("id", rfq.id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });

  const { data: open } = await sb.from("rfq_invites").select("id, cro_org_id, cro_email, status").eq("rfq_id", rfq.id).in("status", ["sent", "draft"]);
  const ids = (open ?? []).map((i) => i.id);
  if (ids.length) await sb.from("rfq_invites").update({ reply_by: replyBy, expires_at: inviteExpiresAt(replyBy).toISOString() }).in("id", ids);
  // 지난 기한의 리마인더 기록은 지워 새 기한에 D-2·당일 알림이 다시 간다
  if (ids.length) await sb.from("invite_reminders").delete().in("invite_id", ids);

  await audit({ userId: s.userId, email: s.email }, "rfq.deadline", { type: "rfq_request", id: rfq.id, label: rfq.rfq_no }, { before: { reply_by: rfq.reply_by }, after: { reply_by: replyBy } });
  await logEvent(rfq.id, "deadline", `회신 기한 변경 · ${rfq.reply_by ?? "-"} → ${replyBy}`, ids.length ? `열린 초대 ${ids.length}건에 적용` : undefined, s.userId, { from: rfq.reply_by, to: replyBy });

  const orgIds = (open ?? []).map((i) => i.cro_org_id).filter((x): x is string => !!x);
  const { data: ms } = orgIds.length ? await sb.from("profiles").select("id").in("cro_org_id", orgIds) : { data: [] as { id: string }[] };
  if ((open ?? []).length) {
    await notifyUsers((ms ?? []).map((m) => m.id), { kind: "배포", title: `${rfq.rfq_no} 회신 기한이 ${replyBy}로 바뀌었습니다`, body: `${rfq.substance} · 회신 링크도 새 기한 +7일까지 열립니다.`, href: "/cro" }, { to: (open ?? []).map((i) => i.cro_email) });
  }
  if (rfq.user_id) await notifyUsers([rfq.user_id], { kind: "배포", title: `${rfq.rfq_no} 회신 기한이 ${replyBy}로 바뀌었습니다`, href: `/app/r/${rfq.rfq_no}` });
  return NextResponse.json({ ok: true, invites: ids.length, message: `기한을 ${replyBy}로 바꿨습니다.${ids.length ? ` 열린 초대 ${ids.length}건에 안내했습니다.` : ""}` });
}
