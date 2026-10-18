import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/notify";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST { billable: boolean, reason?: string } — 운영자가 초대 1건(그 초대의 견적 1건)의 청구 대상 여부를 바꾼다.
 * 청구 단위는 기관이 제출한 견적이고(0020), 허위·중복·분야 불일치 요청은 여기서 제외하고 사유를 남긴다.
 * 예산 검토·비교 견적은 정상 요청이라 제외 사유가 아니다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { billable?: unknown; reason?: unknown };
  if (typeof b.billable !== "boolean") return NextResponse.json({ error: "청구 여부를 지정해 주세요." }, { status: 400 });
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 200) : "";
  if (!b.billable && !reason) return NextResponse.json({ error: "제외 사유를 적어 주세요." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const { data: inv } = await sb.from("rfq_invites").select("id, rfq_id, rfq_no, cro_name, sent_at").eq("id", id).maybeSingle();
  if (!inv) return NextResponse.json({ error: "전달 기록을 찾을 수 없습니다." }, { status: 404 });
  // 마감된 달의 청구는 바꿀 수 없다. 청구 월은 견적을 처음 제출한 달이다 (금액 없이 제출했으면 금액이 들어온 달, 제출 전이면 보낸 달). 바꾸려면 청구 명세에서 마감을 해제한다
  const { data: quote } = await sb.from("cro_quotes").select("first_submitted_at, billing_at").eq("invite_id", id).maybeSingle();
  const monthFirst = new Date(quote?.billing_at ?? quote?.first_submitted_at ?? inv.sent_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 7) + "-01";
  const { data: closed } = await sb.from("billing_periods").select("month").eq("month", monthFirst).maybeSingle();
  if (closed) return NextResponse.json({ error: `${monthFirst.slice(0, 7)}은 청구가 마감되어 바꿀 수 없습니다. 청구 명세에서 마감을 해제한 뒤 다시 시도하세요.` }, { status: 409 });
  const { error } = await sb.from("rfq_invites").update({ billable: b.billable, bill_excluded_reason: b.billable ? null : reason }).eq("id", id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  await logEvent(inv.rfq_id, "billing", b.billable ? `${inv.cro_name} 견적 청구 복원` : `${inv.cro_name} 견적 청구 제외`, b.billable ? undefined : reason, s.userId, { inviteId: id, billable: b.billable });
  await audit({ userId: s.userId, email: s.email }, "invite.billing", { type: "rfq_invite", id, label: `${inv.rfq_no} · ${inv.cro_name}` }, { after: { billable: b.billable }, note: reason || undefined });
  return NextResponse.json({ ok: true });
}
