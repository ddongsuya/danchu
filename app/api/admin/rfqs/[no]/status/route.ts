import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo } from "@/lib/data";
import { logEvent, notifyUsers } from "@/lib/notify";

export const runtime = "nodejs";

/** POST { status?: 'closed'|'cancelled'|'reopen', note?: string } — 종료·취소·재개, 운영 메모 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { status?: unknown; note?: unknown };
  const sb = getSupabaseAdmin()!;

  if (typeof b.note === "string") {
    await sb.from("rfq_requests").update({ admin_note: b.note.slice(0, 2000) || null }).eq("id", rfq.id);
    if (typeof b.status !== "string") return NextResponse.json({ ok: true, message: "메모를 저장했습니다." });
  }

  const status = typeof b.status === "string" ? b.status : "";
  if (status === "closed") {
    await sb.from("rfq_requests").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", rfq.id);
    await logEvent(rfq.id, "closed", "종료", undefined, s.userId);
    if (rfq.user_id) await notifyUsers([rfq.user_id], { kind: "계약", title: `${rfq.rfq_no} 요청이 종료되었습니다`, body: "이용해 주셔서 감사합니다. 다음 시험도 단추에서 요청해 주세요.", href: `/app/r/${rfq.rfq_no}` });
    return NextResponse.json({ ok: true, message: "종료 처리했습니다." });
  }
  if (status === "cancelled") {
    await sb.from("rfq_requests").update({ status: "cancelled", closed_at: new Date().toISOString() }).eq("id", rfq.id);
    await sb.from("rfq_invites").update({ status: "expired" }).eq("rfq_id", rfq.id).in("status", ["sent", "draft"]);
    await logEvent(rfq.id, "cancelled", "취소", undefined, s.userId);
    const { data: inv } = await sb.from("rfq_invites").select("cro_org_id, cro_email").eq("rfq_id", rfq.id);
    const orgIds = (inv ?? []).map((i) => i.cro_org_id).filter((x): x is string => !!x);
    const { data: ms } = orgIds.length ? await sb.from("profiles").select("id").in("cro_org_id", orgIds) : { data: [] };
    await notifyUsers((ms ?? []).map((m) => m.id as string), { kind: "시스템", title: `${rfq.rfq_no} 요청이 취소되었습니다`, body: "의뢰자 사정으로 요청이 취소되어 회신이 닫혔습니다.", href: "/cro" }, { to: (inv ?? []).map((i) => i.cro_email as string) });
    if (rfq.user_id) await notifyUsers([rfq.user_id], { kind: "시스템", title: `${rfq.rfq_no} 요청이 취소되었습니다`, href: `/app/r/${rfq.rfq_no}` });
    return NextResponse.json({ ok: true, message: "취소 처리했습니다." });
  }
  if (status === "reopen") {
    const next = rfq.selected_quote_id ? "selected" : rfq.compared_at ? "compared" : rfq.distributed_at ? "distributed" : "received";
    await sb.from("rfq_requests").update({ status: next, closed_at: null }).eq("id", rfq.id);
    await logEvent(rfq.id, "note", "다시 열기", `상태 ${next}`, s.userId);
    return NextResponse.json({ ok: true, message: "다시 열었습니다." });
  }
  return NextResponse.json({ error: "알 수 없는 동작" }, { status: 400 });
}
