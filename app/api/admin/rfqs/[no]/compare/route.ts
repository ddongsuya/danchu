import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo } from "@/lib/data";
import { logEvent, notifyUsers, siteUrl } from "@/lib/notify";

export const runtime = "nodejs";

/** POST — 비교표 공개. 제출된 회신이 1건 이상이어야 한다. 의뢰자에게 알림·메일. */
export async function POST(_req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  const sb = getSupabaseAdmin()!;
  const { count } = await sb.from("cro_quotes").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id).eq("status", "submitted");
  if (!count) return NextResponse.json({ error: "제출된 회신이 없습니다." }, { status: 400 });

  const first = !rfq.compared_at;
  const patch: Record<string, unknown> = { compared_at: new Date().toISOString() };
  if (["received", "distributed", "quoted"].includes(rfq.status)) patch.status = "compared";
  await sb.from("rfq_requests").update(patch).eq("id", rfq.id);
  await logEvent(rfq.id, "compared", first ? `비교표 공개 · ${count}건` : `비교표 재공개 · ${count}건`, undefined, s.userId);

  const href = `/app/r/${rfq.rfq_no}/compare`;
  await notifyUsers(
    rfq.user_id ? [rfq.user_id] : [],
    { kind: "비교", title: `비교표가 도착했습니다 · ${rfq.rfq_no}`, body: `${count}곳 회신 · 총액 오름차순으로 정리했습니다. 정본 PDF와 함께 확인하세요.`, href },
    { to: [rfq.email], subject: `[단추] ${rfq.rfq_no} 견적 비교표 도착 · ${count}곳 회신`, html: undefined, replyTo: undefined },
  );
  if (!rfq.user_id) {
    // 미가입 의뢰자: 가입 안내를 덧붙인 메일을 한 번 더 보내지 않고, 위 메일 본문 링크가 로그인으로 유도한다
    console.info("[danchu] compared for unregistered requester", rfq.rfq_no, `${siteUrl()}${href}`);
  }
  return NextResponse.json({ ok: true, message: `비교표를 공개하고 의뢰자에게 알렸습니다 (${count}건).` });
}
