import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { loadQuote } from "@/lib/quote-load";
import { sessionOrNull } from "@/lib/auth";
import { adminUserIds, logEvent, notifyUsers } from "@/lib/notify";

export const runtime = "nodejs";

/** POST { reason? } — 이번 요청은 회신하지 않음 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const got = await loadQuote(token);
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });
  if (got.draft?.status === "submitted") return NextResponse.json({ error: "이미 제출한 회신은 취소할 수 없습니다. 단추에 문의해 주세요." }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
  const sb = getSupabaseAdmin()!;
  const { error } = await sb.from("rfq_invites").update({ status: "declined", declined_at: new Date().toISOString(), decline_reason: reason || null }).eq("id", got.inviteId);
  if (error) return NextResponse.json({ error: "처리하지 못했습니다." }, { status: 500 });
  const s = await sessionOrNull();
  await logEvent(got.rfqId, "declined", `${got.croName} 회신하지 않음`, reason || undefined, s?.userId ?? null);
  await notifyUsers(await adminUserIds(), { kind: "견적", title: `${got.rfq.no} 회신 안 함 · ${got.croName}`, body: reason || undefined, href: `/admin/r/${got.rfq.no}` });
  return NextResponse.json({ ok: true });
}
