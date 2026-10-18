import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { won } from "@/lib/format";

export const runtime = "nodejs";

/**
 * POST { action: 'confirm' | 'dispute', note? } — 기관이 보고한 계약 내용을 의뢰자가 확인한다.
 * - confirm: 맞음 → 요청 종료
 * - dispute: 다름 → 운영자가 기관과 확인한다 (요청은 계약 진행 상태로 둔다)
 * 7일 안에 둘 다 없으면 예약 작업이 보고 내용대로 확정하고 종료한다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin")) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as { action?: unknown; note?: unknown };
  const action = b.action === "confirm" || b.action === "dispute" ? b.action : null;
  if (!action) return NextResponse.json({ error: "확인 결과를 선택해 주세요." }, { status: 400 });
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) : "";
  if (action === "dispute" && !note) return NextResponse.json({ error: "실제와 다른 부분을 적어 주세요." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const { data: award } = await sb.from("rfq_awards").select("*").eq("rfq_id", rfq.id).maybeSingle();
  if (!award?.contract_reported_at) return NextResponse.json({ error: "기관이 아직 계약을 보고하지 않았습니다." }, { status: 409 });
  if (award.requester_confirmed_at) return NextResponse.json({ ok: true, already: true });

  const now = new Date().toISOString();
  const summary = `체결일 ${award.contract_date ?? ""} · ${won(award.contract_amount ?? 0)}`;
  if (action === "confirm") {
    const { data: done } = await sb
      .from("rfq_awards")
      .update({ requester_confirmed_at: now, confirmed_auto: false, requester_disputed_at: null, requester_dispute_note: null })
      .eq("id", award.id)
      .is("requester_confirmed_at", null)
      .select("id")
      .maybeSingle();
    if (!done) return NextResponse.json({ ok: true, already: true });
    await sb.from("rfq_requests").update({ status: "closed", closed_at: now }).eq("id", rfq.id).in("status", ["selected", "contracting"]);
    await logEvent(rfq.id, "closed", "의뢰자가 계약 내용 확인 · 종료", summary, s.userId);
    if (award.cro_org_id) {
      const { data: ms } = await sb.from("profiles").select("id").eq("cro_org_id", award.cro_org_id);
      await notifyUsers((ms ?? []).map((m) => m.id), { kind: "계약", title: `${rfq.rfq_no} 의뢰자가 계약 내용을 확인했습니다`, body: `${summary} · 요청을 마쳤습니다.`, href: "/cro/awards" });
    }
    return NextResponse.json({ ok: true });
  }

  await sb.from("rfq_awards").update({ requester_disputed_at: now, requester_dispute_note: note }).eq("id", award.id);
  await logEvent(rfq.id, "contract", "의뢰자가 계약 내용 이의", note, s.userId);
  await notifyUsers(
    await adminUserIds(),
    { kind: "계약", title: `${rfq.rfq_no} 계약 보고에 의뢰자 이의 · ${award.cro_name}`, body: `기관 보고: ${summary}\n의뢰자: ${note}`, href: "/admin/awards" },
    { to: adminEmails() },
  );
  return NextResponse.json({ ok: true });
}
