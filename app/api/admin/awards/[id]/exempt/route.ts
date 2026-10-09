import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logEvent, notifyUsers } from "@/lib/notify";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST { exempt: boolean, reason?: string } — 운영자가 성사수수료 면제를 승인(exempt=true)하거나 반려·취소(false)한다.
 * 마감된 달의 수주라도 바꿀 수 있다. 성사수수료는 계약 보고가 있는 달에 청구되므로 전달 명세 마감과 별개다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { exempt?: unknown; reason?: unknown };
  if (typeof b.exempt !== "boolean") return NextResponse.json({ error: "승인 여부를 지정해 주세요." }, { status: 400 });
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 200) : "";
  if (!reason) return NextResponse.json({ error: b.exempt ? "면제 근거를 적어 주세요 (확인한 증빙)." : "반려 사유를 적어 주세요." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const { data: a } = await sb.from("rfq_awards").select("id, rfq_id, cro_org_id, cro_name, fee_exempt, existing_client_claim").eq("id", id).maybeSingle();
  if (!a) return NextResponse.json({ error: "수주 기록이 없습니다." }, { status: 404 });
  const { error } = await sb.from("rfq_awards").update({ fee_exempt: b.exempt, fee_exempt_reason: reason, fee_exempt_at: new Date().toISOString(), fee_exempt_by: s.userId }).eq("id", id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  const { data: rfq } = await sb.from("rfq_requests").select("rfq_no").eq("id", a.rfq_id).maybeSingle();
  await logEvent(a.rfq_id, "fee_exempt", b.exempt ? `${a.cro_name} 성사수수료 면제` : `${a.cro_name} 면제 요청 반려`, reason, s.userId);
  await audit({ userId: s.userId, email: s.email }, "award.fee_exempt", { type: "rfq_award", id, label: `${rfq?.rfq_no} · ${a.cro_name}` }, { before: { fee_exempt: a.fee_exempt }, after: { fee_exempt: b.exempt }, note: reason });
  if (a.cro_org_id) {
    const { data: ms } = await sb.from("profiles").select("id").eq("cro_org_id", a.cro_org_id);
    await notifyUsers((ms ?? []).map((m) => m.id as string), { kind: "계약", title: b.exempt ? `${rfq?.rfq_no} 성사수수료 면제가 확정되었습니다` : `${rfq?.rfq_no} 기존 고객 면제 요청이 반려되었습니다`, body: reason, href: "/cro/awards" });
  }
  return NextResponse.json({ ok: true, message: b.exempt ? "면제로 처리했습니다." : "반려했습니다." });
}
