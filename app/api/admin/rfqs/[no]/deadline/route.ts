import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo } from "@/lib/data";
import { logEvent, notifyUsers } from "@/lib/notify";
import { inviteExpiresAt, occupiesSeat, undecidedOffer } from "@/lib/request-policy";
import { todaySeoul } from "@/lib/format";
import { audit } from "@/lib/audit";
import { notifyInvitedOrgs } from "@/lib/distribute";
import type { TablesUpdate } from "@/lib/db-types";
import { COMPARE_LOCKED_DEADLINE } from "@/lib/reply-window";

export const runtime = "nodejs";

/**
 * POST { joinBy: 'YYYY-MM-DD' } — 참여 결정 기한 연장 (0023, 요청마다 한 번). 아래 extendJoinBy 참고.
 *
 * POST { replyBy: 'YYYY-MM-DD' } — 회신 기한 변경. 비교표가 열리기 전(compared_at 없음)에만 된다. 배포(distributed_at) 뒤에는 늘리기만 된다 (앞당기기 = 조기 마감이므로 400).
 * 요청의 reply_by 와 초대(sent·draft·submitted, 취소한 초대 제외)의 reply_by·expires_at 을 함께 바꾸고 기관에 알린다.
 * 이미 제출한 기관에도 같은 새 기한이 적용된다 (늦게 내는 기관만 시간을 더 받는 일을 막는다). 제출한 견적은 비교표가 열리기 전까지 고칠 수 있다.
 * 비교표가 열린 요청(compared_at)은 409: 한 번 열린 비교표는 다시 열지 않고 회신 기한도 늘리지 않는다 (2026-10-21 결정 3).
 * DB 도 같은 규칙을 지킨다 (0026 rfq_requests_compare_lock: compared_at 을 비우거나 바꾸는 것, 열린 뒤 reply_by 를 바꾸는 것을 거절).
 * 회신 0건으로 기한이 지난 요청은 비교표가 열리지 않았으므로(예약 작업이 열지 않는다) 여기서 늘려 다시 받을 수 있다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (rfq.compared_at) return NextResponse.json({ error: COMPARE_LOCKED_DEADLINE, code: "compare_locked" }, { status: 409 });
  if (!["received", "distributed", "quoted"].includes(rfq.status) || rfq.selected_quote_id) return NextResponse.json({ error: "기관을 선정했거나 종료된 요청은 기한을 바꿀 수 없습니다." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as { replyBy?: unknown; joinBy?: unknown };
  if (b.joinBy !== undefined && b.replyBy === undefined) return extendJoinBy(rfq, b.joinBy, s);
  const replyBy = typeof b.replyBy === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.replyBy) ? b.replyBy : "";
  if (!replyBy || replyBy < todaySeoul()) return NextResponse.json({ error: "회신 기한은 오늘 이후의 날짜여야 합니다." }, { status: 400 });
  if (replyBy === rfq.reply_by) return NextResponse.json({ error: "지금 기한과 같습니다." }, { status: 400 });
  // 배포한 뒤에는 늘리기만 한다. 앞당기면 의뢰자 요청에 따른 조기 마감이 되므로 막는다 (2026-10-21 결정 2, DB 0026 도 거절)
  if (rfq.distributed_at && rfq.reply_by && replyBy < rfq.reply_by) return NextResponse.json({ error: `참여 안내를 보낸 뒤에는 회신 기한을 늘리기만 할 수 있습니다. 지금 기한(${rfq.reply_by})보다 늦은 날짜를 골라 주세요.`, code: "deadline_shorten" }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const patch: TablesUpdate<"rfq_requests"> = { reply_by: replyBy };
  // 비교표가 아직 열리지 않았고 선정 전일 때만 바꾼다. 그 사이 비교표가 열렸으면(마지막 제출·예약 작업) 아무것도 바꾸지 않는다
  const { data: updated, error } = await sb.from("rfq_requests").update(patch).eq("id", rfq.id).is("selected_quote_id", null).is("compared_at", null).select("id");
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  // 그 사이 의뢰자가 선정했거나 비교표가 열렸으면 아무것도 바꾸지 않았다. 초대 기한을 늘리거나 "새 기한까지 고칠 수 있다"고 알리지 않는다
  if (!updated?.length) return NextResponse.json({ error: "그 사이 비교표가 열렸거나 기관을 선정해 기한을 바꾸지 않았습니다. 화면을 새로 고쳐 주세요.", code: "compare_locked" }, { status: 409 });

  const { data: open } = await sb.from("rfq_invites").select("id, token, cro_org_id, cro_email, status, joined_at, withdrawn_at, revoked_at").eq("rfq_id", rfq.id).in("status", ["sent", "draft", "submitted"]).is("revoked_at", null);
  const ids = (open ?? []).map((i) => i.id);
  if (ids.length) await sb.from("rfq_invites").update({ reply_by: replyBy, expires_at: inviteExpiresAt(replyBy).toISOString() }).in("id", ids);
  // 지난 기한의 리마인더 기록은 지워 새 기한에 D-2·당일 알림이 다시 간다
  const unsent = (open ?? []).filter((i) => i.status !== "submitted").map((i) => i.id);
  if (unsent.length) await sb.from("invite_reminders").delete().in("invite_id", unsent);

  await audit({ userId: s.userId, email: s.email }, "rfq.deadline", { type: "rfq_request", id: rfq.id, label: rfq.rfq_no }, { before: { reply_by: rfq.reply_by }, after: { reply_by: replyBy } });
  await logEvent(rfq.id, "deadline", `회신 기한 변경 · ${rfq.reply_by ?? "-"} → ${replyBy}`, ids.length ? `초대 ${ids.length}건에 적용` : undefined, s.userId, { from: rfq.reply_by, to: replyBy });

  // 기관마다 따로 보낸다 (다른 기관 주소가 받는 사람 칸에 보이지 않게). 계정이 있는 기관은 포털, 없거나 운영자 관리 기관은 초대별 /q 링크
  // 참여한 기관에는 시험물질명과 함께, 참여 결정 전 기관에는 시험물질명 없이 (참여 전 요약에 없는 정보, 0023)
  const joined = (open ?? []).filter((i) => occupiesSeat(i));
  // 취소(revoked)·철회 초대는 위 조회와 undecidedOffer 에서 빠진다 (닫힌 링크로 "참여를 결정해 주세요"를 보내지 않는다)
  const undecided = (open ?? []).filter((i) => !occupiesSeat(i) && undecidedOffer(i));
  await notifyInvitedOrgs(joined, { kind: "배포", title: `${rfq.rfq_no} 회신 기한이 ${replyBy}로 바뀌었습니다`, body: `${rfq.substance} · 새 기한까지 회신할 수 있고, 제출한 견적도 비교표가 열리기 전까지 고칠 수 있습니다. 비교표가 열리면 수정과 다시 제출은 닫힙니다. 회신 링크는 새 기한 +7일까지 열립니다.`, portalHref: "/cro" });
  await notifyInvitedOrgs(undecided, { kind: "배포", title: `${rfq.rfq_no} 회신 기한이 ${replyBy}로 바뀌었습니다`, body: `${offerLabel(rfq.categories)} · 요약을 보고 참여를 결정해 주세요. 안내 링크는 새 기한 +7일까지 열립니다.` });
  if (rfq.user_id) await notifyUsers([rfq.user_id], { kind: "배포", title: `${rfq.rfq_no} 회신 기한이 ${replyBy}로 바뀌었습니다`, body: "새 기한까지 견적이 더 도착할 수 있습니다. 비교표는 새 기한이 지나거나, 참여 결정이 끝난 뒤 참여한 기관이 모두 제출하면 열립니다. 한 번 열린 비교표는 다시 닫지 않습니다.", href: `/app/r/${rfq.rfq_no}` });
  return NextResponse.json({ ok: true, invites: ids.length, message: `기한을 ${replyBy}로 바꿨습니다.${ids.length ? ` 초대 ${ids.length}건에 안내했습니다.` : ""}` });
}

/**
 * 참여 결정 기한 연장 (설계 규칙표 "운영자 권한": 참여 결정 기한 1회 연장).
 * - 회신을 받는 중인 요청(배포·견적 도착, 회신 마감·선정 전)에서, 요청마다 한 번만 (rfq_requests.join_by_extended_at, 조건부 갱신)
 * - 새 기한은 지금 기한보다 늦고, 오늘 이후, 회신 기한 이하. 그날 서울 자정 직전까지
 * - 기한을 늘리면 아직 결정하지 않은 지명 기관 몫 자리를 새 기한까지 다시 비워 둔다 (offer_seat_state, join_offer)
 * - 아직 참여를 결정하지 않은 기관에 시험물질명 없이 알리고, 의뢰자에게도 알린다. 회신 기한은 그대로다
 */
async function extendJoinBy(rfq: NonNullable<Awaited<ReturnType<typeof getRfqByNo>>>, raw: unknown, s: { userId: string; email: string }) {
  const joinBy = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
  const today = todaySeoul();
  if (!joinBy || joinBy < today) return NextResponse.json({ error: "참여 결정 기한은 오늘 이후의 날짜여야 합니다." }, { status: 400 });
  if (!["distributed", "quoted"].includes(rfq.status) || rfq.compared_at) return NextResponse.json({ error: "회신을 받는 중인 요청만 참여 결정 기한을 늘릴 수 있습니다." }, { status: 400 });
  if (!rfq.join_by) return NextResponse.json({ error: "참여 결정 기한이 없는 요청입니다 (참여 선택형 도입 전 요청)." }, { status: 400 });
  if (rfq.join_by_extended_at) return NextResponse.json({ error: "참여 결정 기한은 요청마다 한 번만 늘릴 수 있습니다. 이미 늘렸습니다." }, { status: 409 });
  const current = new Date(rfq.join_by).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  if (joinBy <= current) return NextResponse.json({ error: `지금 참여 결정 기한(${current})보다 늦은 날짜를 골라 주세요.` }, { status: 400 });
  if (rfq.reply_by && joinBy > rfq.reply_by) return NextResponse.json({ error: `참여 결정 기한은 회신 기한(${rfq.reply_by})을 넘을 수 없습니다. 회신 기한을 먼저 늘려 주세요.` }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const iso = new Date(`${joinBy}T23:59:59+09:00`).toISOString();
  const patch: TablesUpdate<"rfq_requests"> = { join_by: iso, join_by_extended_at: new Date().toISOString() };
  const { data: updated, error } = await sb
    .from("rfq_requests")
    .update(patch)
    .eq("id", rfq.id)
    .is("join_by_extended_at", null)
    .is("selected_quote_id", null)
    .is("compared_at", null)
    .select("id");
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  // 그 사이 다른 운영자가 먼저 늘렸거나 선정·마감되었다
  if (!updated?.length) return NextResponse.json({ error: "그 사이 참여 결정 기한이 바뀌었거나 회신이 닫혔습니다. 화면을 새로 고쳐 주세요." }, { status: 409 });

  await audit({ userId: s.userId, email: s.email }, "rfq.join_by", { type: "rfq_request", id: rfq.id, label: rfq.rfq_no }, { before: { join_by: rfq.join_by }, after: { join_by: iso } });
  await logEvent(rfq.id, "join_by_extended", `참여 결정 기한 연장 · ${current} → ${joinBy}`, "요청마다 한 번", s.userId, { from: rfq.join_by, to: iso });

  const { data: offers } = await sb.from("rfq_invites").select("id, token, cro_org_id, cro_email, status, joined_at, withdrawn_at, revoked_at, expires_at").eq("rfq_id", rfq.id).eq("status", "sent");
  const undecided = (offers ?? []).filter((i) => undecidedOffer(i));
  await notifyInvitedOrgs(undecided, { kind: "배포", title: `${rfq.rfq_no} 참여 결정 기한이 ${joinBy}로 늘었습니다`, body: `${offerLabel(rfq.categories)} · 요약을 보고 참여를 결정해 주세요. 회신 기한${rfq.reply_by ? ` ${rfq.reply_by}` : ""}은 그대로입니다.` });
  if (rfq.user_id) await notifyUsers([rfq.user_id], { kind: "배포", title: `${rfq.rfq_no} 기관의 참여 결정 기한을 ${joinBy}로 늘렸습니다`, body: "더 많은 기관이 참여를 결정할 수 있도록 참여 결정 기한을 늘렸습니다. 지명한 기관 몫의 자리는 새 기한까지 비워 둡니다. 회신 기한은 그대로입니다.", href: `/app/r/${rfq.rfq_no}` });
  return NextResponse.json({ ok: true, joinBy: iso, invites: undecided.length, message: `참여 결정 기한을 ${joinBy}로 늘렸습니다.${undecided.length ? ` 참여 결정 전 기관 ${undecided.length}곳에 안내했습니다.` : ""}` });
}

/** 참여 전 기관에게 쓰는 요청 이름: "{분야} 견적 요청" (시험물질명 없음, 0023) */
function offerLabel(categories: string[] | null | undefined): string {
  const c = (categories ?? []).join(" · ");
  return c ? `${c} 견적 요청` : "견적 요청";
}
