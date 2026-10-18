import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { REOPEN_DAYS } from "@/lib/request-policy";

export const runtime = "nodejs";

/**
 * POST — "보류"로 마무리한 요청을 다시 연다. 받은 견적이 있을 때만 (비교표로 돌아가 선정할 수 있게).
 * 견적의 유효기간은 비교표에서 기관별로 보인다. 지난 견적은 선정할 수 없다.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin")) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (rfq.outcome !== "보류" || rfq.status !== "closed" || rfq.selected_quote_id) return NextResponse.json({ error: "보류한 요청만 다시 열 수 있습니다." }, { status: 409 });
  if (rfq.outcome_at && Date.now() - new Date(rfq.outcome_at).getTime() > REOPEN_DAYS * 864e5) return NextResponse.json({ error: `보류한 지 ${REOPEN_DAYS}일이 지나 다시 열 수 없습니다. 같은 내용으로 새 요청을 보내 주세요.` }, { status: 409 });

  const sb = getSupabaseAdmin()!;
  const { data: quotes } = await sb.from("cro_quotes").select("cro_org_id").eq("rfq_id", rfq.id).eq("status", "submitted");
  if (!quotes?.length) return NextResponse.json({ error: "받은 견적이 없어 다시 열 수 없습니다. 같은 내용으로 새 요청을 보내 주세요." }, { status: 409 });

  const now = new Date().toISOString();
  const { data: done } = await sb
    .from("rfq_requests")
    .update({ status: "compared", compared_at: rfq.compared_at ?? now, closed_at: null, outcome: null, outcome_note: null, outcome_at: null })
    .eq("id", rfq.id)
    .eq("status", "closed")
    .select("id")
    .maybeSingle();
  if (!done) return NextResponse.json({ error: "다시 열지 못했습니다. 화면을 새로 고친 뒤 다시 시도해 주세요." }, { status: 409 });
  await logEvent(rfq.id, "outcome", "보류한 요청을 다시 엶", undefined, s.userId);

  // 견적을 낸 기관에는 다시 검토 중이라는 사실만 (금액·타사는 알리지 않는다)
  const orgIds = quotes.map((q) => q.cro_org_id).filter((x): x is string => !!x);
  if (orgIds.length) {
    const { data: ms } = await sb.from("profiles").select("id").in("cro_org_id", orgIds);
    await notifyUsers((ms ?? []).map((m) => m.id), { kind: "비교", title: `${rfq.rfq_no} 의뢰자가 보류했던 요청을 다시 검토합니다`, body: "제출한 견적으로 다시 비교합니다. 견적 유효기간이 지났다면 의뢰자가 선정할 수 없습니다.", href: "/cro/quotes" });
  }
  await notifyUsers(await adminUserIds(), { kind: "비교", title: `${rfq.rfq_no} 보류 요청 다시 엶`, body: `견적 ${quotes.length}건으로 다시 비교합니다.`, href: `/admin/r/${rfq.rfq_no}` });
  return NextResponse.json({ ok: true });
}
