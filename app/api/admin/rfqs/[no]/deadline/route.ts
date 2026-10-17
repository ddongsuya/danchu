import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo } from "@/lib/data";
import { logEvent, notifyUsers } from "@/lib/notify";
import { inviteExpiresAt } from "@/lib/request-policy";
import { todaySeoul } from "@/lib/format";
import { audit } from "@/lib/audit";
import { notifyInvitedOrgs } from "@/lib/distribute";
import type { TablesUpdate } from "@/lib/db-types";

export const runtime = "nodejs";

/**
 * POST { replyBy: 'YYYY-MM-DD' } — 회신 기한 변경.
 * 요청의 reply_by 와 초대(sent·draft·submitted)의 reply_by·expires_at 을 함께 바꾸고 기관에 알린다.
 * 제출한 기관도 새 기한까지 견적을 고칠 수 있다 (같은 기한, lib/reply-window.ts).
 * 회신이 마감된 요청(compared_at)도 선정 전이면 여기서 다시 연다: compared_at 을 비우고 상태를 견적 도착·배포로 되돌린다.
 * 마감 뒤에 온 회신을 받는 유일한 경로이고, 회신 0건으로 기한이 지난 요청을 다시 살리는 경로다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (!["received", "distributed", "quoted", "compared"].includes(rfq.status) || rfq.selected_quote_id) return NextResponse.json({ error: "기관을 선정했거나 종료된 요청은 기한을 바꿀 수 없습니다." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as { replyBy?: unknown };
  const replyBy = typeof b.replyBy === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.replyBy) ? b.replyBy : "";
  if (!replyBy || replyBy < todaySeoul()) return NextResponse.json({ error: "회신 기한은 오늘 이후의 날짜여야 합니다." }, { status: 400 });
  const reopen = !!rfq.compared_at;
  // 기한 전에 마감한 요청은 같은 기한으로 다시 열 수 있다
  if (replyBy === rfq.reply_by && !reopen) return NextResponse.json({ error: "지금 기한과 같습니다." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const patch: TablesUpdate<"rfq_requests"> = { reply_by: replyBy };
  if (reopen) {
    // 회신 마감을 풀어 다시 받는다. 제출된 견적이 있으면 견적 도착, 없으면 배포 단계로
    const { count } = await sb.from("cro_quotes").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id).eq("status", "submitted");
    Object.assign(patch, { compared_at: null, status: count ? "quoted" : rfq.distributed_at ? "distributed" : "received" });
  }
  const { data: updated, error } = await sb.from("rfq_requests").update(patch).eq("id", rfq.id).is("selected_quote_id", null).select("id");
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  // 그 사이 의뢰자가 선정했으면 아무것도 바꾸지 않았다. 초대 기한을 늘리거나 "새 기한까지 고칠 수 있다"고 알리지 않는다
  if (!updated?.length) return NextResponse.json({ error: "그 사이 의뢰자가 기관을 선정해 기한을 바꾸지 않았습니다. 화면을 새로 고쳐 주세요." }, { status: 409 });

  const { data: open } = await sb.from("rfq_invites").select("id, token, cro_org_id, cro_email, status").eq("rfq_id", rfq.id).in("status", ["sent", "draft", "submitted"]);
  const ids = (open ?? []).map((i) => i.id);
  if (ids.length) await sb.from("rfq_invites").update({ reply_by: replyBy, expires_at: inviteExpiresAt(replyBy).toISOString() }).in("id", ids);
  // 지난 기한의 리마인더 기록은 지워 새 기한에 D-2·당일 알림이 다시 간다
  if (ids.length) await sb.from("invite_reminders").delete().in("invite_id", ids);

  await audit({ userId: s.userId, email: s.email }, "rfq.deadline", { type: "rfq_request", id: rfq.id, label: rfq.rfq_no }, { before: { reply_by: rfq.reply_by }, after: { reply_by: replyBy } });
  await logEvent(rfq.id, "deadline", `${replyBy === rfq.reply_by ? `회신 기한 유지 · ${replyBy}` : `회신 기한 변경 · ${rfq.reply_by ?? "-"} → ${replyBy}`}${reopen ? " · 회신 다시 열림" : ""}`, ids.length ? `초대 ${ids.length}건에 적용` : undefined, s.userId, { from: rfq.reply_by, to: replyBy, reopen });

  // 기관마다 따로 보낸다 (다른 기관 주소가 받는 사람 칸에 보이지 않게). 계정이 있는 기관은 포털, 없거나 운영자 관리 기관은 초대별 /q 링크
  await notifyInvitedOrgs(open ?? [], { kind: "배포", title: `${rfq.rfq_no} 회신 기한이 ${replyBy}로 바뀌었습니다`, body: `${rfq.substance} · 새 기한까지 회신하거나 제출한 견적을 고칠 수 있습니다. 회신 링크는 새 기한 +7일까지 열립니다.`, portalHref: "/cro" });
  if (rfq.user_id) await notifyUsers([rfq.user_id], { kind: "배포", title: `${rfq.rfq_no} 회신 기한이 ${replyBy}로 바뀌었습니다`, body: reopen ? "회신을 다시 받습니다. 새 기한까지 견적이 더 도착하거나 바뀔 수 있습니다." : "새 기한까지 견적이 더 도착하거나 바뀔 수 있습니다.", href: `/app/r/${rfq.rfq_no}` });
  return NextResponse.json({ ok: true, invites: ids.length, message: `기한을 ${replyBy}로 바꿨습니다.${reopen ? " 회신을 다시 열었습니다." : ""}${ids.length ? ` 초대 ${ids.length}건에 안내했습니다.` : ""}` });
}
