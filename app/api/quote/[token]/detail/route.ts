import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { loadQuote } from "@/lib/quote-load";
import { loadOptsFor } from "@/lib/concierge";
import { logEvent, notifyUsers } from "@/lib/notify";
import { DETAIL_REPLY_ERRORS, saveDetailReply } from "@/lib/rpc";
import { replyItemsOf, revisedTotal } from "@/lib/detail-quote";
import { audit } from "@/lib/audit";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { mode: revise|keep|decline, items, totalWeeks, note } — 기관의 2차 회신 (0042). 한 번 보내면 고치지 않는다.
 * 2차 총액은 서버가 1차 총액에 고친 줄의 차이를 더해 계산한다. 1차 견적(cro_quotes)은 바꾸지 않는다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const s = await sessionOrNull();
  const got = await loadQuote(token, { ...loadOptsFor(s?.profile.role), markOpened: false });
  if (!got) return NextResponse.json({ error: DETAIL_REPLY_ERRORS.not_found.message }, { status: 404 });
  if (await rateLimited("detail-reply", s?.userId ?? clientIp(req), 20, 600)) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as { mode?: unknown; items?: unknown; totalWeeks?: unknown; note?: unknown };
  const mode = b.mode === "revise" || b.mode === "keep" || b.mode === "decline" ? b.mode : "";
  if (!mode) return NextResponse.json({ error: DETAIL_REPLY_ERRORS.bad_body.message }, { status: 400 });
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 2000) : "";

  const sb = getSupabaseAdmin()!;
  const body: Record<string, unknown> = { mode, note };
  if (mode === "revise") {
    const { data: q } = await sb.from("cro_quotes").select("total_amount, cro_quote_items(seq, amount)").eq("invite_id", got.inviteId).maybeSingle();
    if (!q) return NextResponse.json({ error: DETAIL_REPLY_ERRORS.not_target.message }, { status: 404 });
    const first = (q.cro_quote_items ?? []) as { seq: number; amount: number | null }[];
    const seqs = new Set(got.rfq.rows.map((r) => r.seq));
    const items = replyItemsOf(b.items).filter((i) => seqs.has(i.seq));
    const total = revisedTotal(q.total_amount ?? 0, first, items);
    const weeks = typeof b.totalWeeks === "number" && Number.isInteger(b.totalWeeks) && b.totalWeeks > 0 && b.totalWeeks <= 520 ? b.totalWeeks : null;
    if (total <= 0) return NextResponse.json({ error: DETAIL_REPLY_ERRORS.bad_body.message }, { status: 400 });
    Object.assign(body, { total_amount: total, total_weeks: weeks, items });
  }

  const res = await saveDetailReply(got.inviteId, token, s?.userId ?? null, body);
  if (!res.ok) {
    const e = DETAIL_REPLY_ERRORS[res.code];
    return NextResponse.json({ error: e?.message ?? "회신을 보내지 못했어요. 잠시 후 다시 시도해 주세요.", code: res.code }, { status: e?.status ?? 500 });
  }
  if (s?.profile.role === "admin") await audit({ userId: s.userId, email: s.email }, "quote.detail_proxy", { type: "rfq_invite", id: got.inviteId, label: got.rfq.no }, { note: mode });

  const what = mode === "revise" ? "2차 견적을 보냈어요" : mode === "keep" ? "1차 견적 그대로 진행한다고 답했어요" : "이번에는 2차 견적을 내기 어렵다고 답했어요";
  await logEvent(got.rfqId, "detail_reply", `${got.croName} 2차 회신`, what, s?.userId ?? null);
  const { data: rfq } = await sb.from("rfq_requests").select("user_id, email, rfq_no, substance").eq("id", got.rfqId).maybeSingle();
  if (rfq?.user_id) {
    await notifyUsers(
      [rfq.user_id],
      { kind: "견적", title: `${got.croName} 2차 회신 · ${rfq.rfq_no}`, body: `${got.croName}이(가) ${what}.${res.left ? ` 아직 답하지 않은 기관 ${res.left}곳.` : " 받는 기관이 모두 답했어요."}`, href: `/app/r/${rfq.rfq_no}/compare` },
      { to: [rfq.email] },
    ).catch((e) => console.error("detail reply notify", e));
  }
  return NextResponse.json({ ok: true });
}
