import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sessionOrNull } from "@/lib/auth";
import { closedMessage, loadQuote } from "@/lib/quote-load";
import { loadOptsFor } from "@/lib/concierge";
import { adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { withdrawOffer } from "@/lib/rpc";
import { reofferNow } from "@/lib/opt-in-cron";
import { captureError } from "@/lib/observe";
import { announceCompareOpened, publishIfAllReplied } from "@/lib/compare";
import { todaySeoul } from "@/lib/format";
import { POST as joinPost } from "../join/route";

export const runtime = "nodejs";

/** 화면이 본 상태. 다르면(그 사이 같은 기관 다른 담당자가 참여한 경우 등) 처리하지 않고 다시 보게 한다 */
type DeclineMode = "decline" | "withdraw";

const STALE = "요청 상태가 바뀌었습니다. 화면을 새로 고친 뒤 다시 확인해 주세요.";

const WITHDRAW_DENIED: Record<string, { error: string; status: number }> = {
  closed: { error: closedMessage(null), status: 403 },
  revoked: { error: "유효하지 않거나 만료된 링크입니다.", status: 404 },
  not_found: { error: "유효하지 않거나 만료된 링크입니다.", status: 404 },
  not_member: { error: "다른 기관 담당자 계정으로 로그인되어 있어 처리할 수 없습니다.", status: 403 },
  not_joined: { error: STALE, status: 409 },
  submitted: { error: "이미 제출한 견적은 철회할 수 없습니다. 단추(hello@danchu.kr)에 문의해 주세요.", status: 400 },
  declined: { error: "이미 불참으로 처리한 요청입니다.", status: 409 },
  withdrawn: { error: "이미 참여를 철회한 요청입니다.", status: 409 },
  expired: { error: "링크가 만료되었습니다.", status: 403 },
};

/**
 * POST { mode, reason? } — 참여 전 "이번 요청 불참"(decline) 또는 참여 뒤 제출 전 "참여 철회"(withdraw). 0023.
 * - 불참: 사유는 선택이고 운영자에게만 전달한다. 다음 안내에 영향이 없다. 의뢰자에게는 알리지 않는다 (일반 기관의 불참은 이름도 알림도 보이지 않는다).
 * - 철회: withdraw_offer 가 요청 행을 잠그고 처리한다. 자리가 비고, 청구하지 않는다. 의뢰자에게는 기관명 없이 알린다 (참여 기관 수가 바뀌므로).
 * 운영자는 기관이 메일로 알린 불참·철회를 기록할 수 있고, 그때는 감사 기록을 남긴다. 제출한 견적은 어느 쪽도 할 수 없다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const s = await sessionOrNull();
  const got = await loadQuote(token, loadOptsFor(s?.profile.role));
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });
  if (got.draft?.status === "submitted") return NextResponse.json({ error: "이미 제출한 견적은 철회할 수 없습니다. 단추(hello@danchu.kr)에 문의해 주세요." }, { status: 400 });
  if (got.declined) return NextResponse.json({ ok: true, already: true });
  if (got.expired) return NextResponse.json({ error: "링크가 만료되었습니다." }, { status: 403 });
  if (got.closed) return NextResponse.json({ error: closedMessage(got.closedReason) }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { reason?: unknown; mode?: unknown };
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
  const mode: DeclineMode = got.joined ? "withdraw" : "decline";
  // 화면이 본 상태와 다르면 멈춘다. 불참을 누른 사이 다른 담당자가 참여했다면 철회는 따로 확인받아야 한다
  if (b.mode !== undefined && b.mode !== mode) return NextResponse.json({ error: STALE }, { status: 409 });
  const sb = getSupabaseAdmin()!;
  const byOperator = s?.profile.role === "admin";
  // 철회로 남은 참여 기관이 모두 제출한 상태가 되면 withdraw_offer 가 같은 트랜잭션에서 비교표를 연다 (0025)
  let compareOpened = false;
  const what = mode === "withdraw" ? "참여 철회" : "불참";

  if (mode === "withdraw") {
    const r = await withdrawOffer(got.inviteId, got.token, s?.userId ?? null, reason || null);
    if (!r.ok) {
      const d = WITHDRAW_DENIED[r.code] ?? { error: "처리하지 못했습니다.", status: 500 };
      return NextResponse.json({ error: d.error }, { status: d.status });
    }
    if (r.already) return NextResponse.json({ ok: true, already: true });
    compareOpened = !!r.compare_opened;
  } else {
    // 참여 전 초대만: 상태가 sent 이고 참여 기록이 없을 때만 바꾼다. 그 사이 참여했으면 바뀌는 행이 없다
    const { data, error } = await sb.from("rfq_invites").update({ status: "declined", declined_at: new Date().toISOString(), decline_reason: reason || null }).eq("id", got.inviteId).eq("status", "sent").is("joined_at", null).select("id");
    if (error) return NextResponse.json({ error: "처리하지 못했습니다." }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: STALE }, { status: 409 });
  }

  await logEvent(got.rfqId, mode === "withdraw" ? "withdrawn" : "declined", `${got.croName} ${what}${byOperator ? " (운영자 기록)" : ""}`, reason || undefined, s?.userId ?? null);
  // 운영자가 기관 대신 처리한 것은 운영 기록에도 남긴다 (기관이 메일로 알린 의사를 운영자가 옮긴 것)
  if (s && byOperator) await audit({ userId: s.userId, email: s.email }, mode === "withdraw" ? "invite.withdraw_proxy" : "invite.decline_proxy", { type: "rfq_invite", id: got.inviteId, label: `${got.rfq.no} · ${got.croName}` }, { after: { status: "declined", mode }, note: reason || undefined });
  // 운영자는 앱 알림만. 메일은 예약 작업이 하루 한 번 모아서 보낸다 (운영자 하루 요약)
  await notifyUsers(await adminUserIds(), { kind: "견적", title: `${got.rfq.no} ${what} · ${got.croName}`, body: reason || undefined, href: `/admin/r/${got.rfq.no}` });
  if (compareOpened) {
    // 비교표가 열렸으면 철회 알림 대신 "비교표가 열렸습니다"를 한 번 보낸다
    await logEvent(got.rfqId, "compared", "비교표 공개 (참여 기관 모두 제출)", undefined, null, { auto: "all" });
    await announceCompareOpened(got.rfqId, "all").catch((e) => captureError(e, "decline:compare-opened", { rfq: got.rfq.no }));
    return NextResponse.json({ ok: true, mode });
  }
  if (mode === "withdraw") {
    // 의뢰자는 참여한 기관을 보므로 철회는 알린다. 기관명과 사유는 넣지 않는다
    const { data: rq } = await sb.from("rfq_requests").select("user_id, status").eq("id", got.rfqId).maybeSingle();
    if (rq?.user_id && !["closed", "cancelled"].includes(rq.status)) {
      await notifyUsers([rq.user_id], { kind: "견적", title: `${got.rfq.no} 참여한 기관 1곳이 참여를 철회했습니다`, body: "빈 자리에는 참여 안내를 받은 다른 기관이 참여할 수 있습니다. 다른 기관의 견적은 그대로 받습니다.", href: `/app/r/${got.rfq.no}` });
    }
  }
  // 철회나 지명 기관 불참으로 자리가 비었으면 바로 재안내한다 (cron 과 같은 판정, 한 번만. 자리를 비우지 않는 불참이면 아무것도 하지 않는다)
  try {
    await reofferNow(sb, got.rfqId, todaySeoul());
  } catch (e) {
    captureError(e, "decline:reoffer", { rfq: got.rfq.no });
  }
  // 안전망: 불참으로 판정이 바뀌는 경로(예: 참여 결정 기한 직후)도 비교표를 열 수 있으면 연다. DB 가 요청 행을 잠그고 한 번만 연다
  await publishIfAllReplied(got.rfqId).catch(() => false);
  return NextResponse.json({ ok: true, mode });
}

/**
 * DELETE { agree: true, terms } — 참여 전 불참을 되돌린다 = 다시 참여한다 (2026-10-20 결정 3).
 * 참여하기와 같은 길(join_offer)로 처리한다: 참여 결정 기한 전, 남은 자리와 지명 기관 몫을 잠금 안에서 다시 보고,
 * 참여 기록(조건 판·IP·브라우저)과 decline_undone_at 을 남긴다. 참여 조건 확인(agree, terms)이 없으면 400.
 * 참여 뒤 철회는 되돌릴 수 없다 (join_offer withdrawn).
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ token: string }> }) {
  return joinPost(req, ctx);
}
