import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo } from "@/lib/data";
import { logEvent, notifyUsers } from "@/lib/notify";
import { notifyInvitedOrgs } from "@/lib/distribute";

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
    // 기관마다 따로 보낸다. 계정이 없거나 운영자 관리 기관은 로그인이 필요한 /cro 대신 회신 링크(/q)로
    const { data: inv } = await sb.from("rfq_invites").select("id, token, cro_org_id, cro_email").eq("rfq_id", rfq.id);
    await notifyInvitedOrgs(inv ?? [], { kind: "시스템", title: `${rfq.rfq_no} 요청이 취소되었습니다`, body: "의뢰자 사정으로 요청이 취소되어 회신이 닫혔습니다.", portalHref: "/cro" });
    if (rfq.user_id) await notifyUsers([rfq.user_id], { kind: "시스템", title: `${rfq.rfq_no} 요청이 취소되었습니다`, href: `/app/r/${rfq.rfq_no}` });
    return NextResponse.json({ ok: true, message: "취소 처리했습니다." });
  }
  if (status === "reopen") {
    // 제출된 견적이 있으면 견적 도착으로 되돌린다. 그래야 의뢰자 화면의 "견적 도착"에 다시 잡힌다
    // 비교표가 열린 뒤 종료·취소한 요청은 비교 단계(compared)로 돌아가고 처음 열린 시각(compared_at)을 그대로 둔다.
    // 회신은 다시 열지 않는다: 견적 수정·다시 제출·회신 기한 연장은 없다 (2026-10-21 결정 3, 0026 트리거가 compared_at 변경을 거절한다)
    const { count: submitted } = rfq.selected_quote_id || rfq.compared_at ? { count: 0 } : await sb.from("cro_quotes").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id).eq("status", "submitted");
    const next = rfq.selected_quote_id ? "selected" : rfq.compared_at ? "compared" : submitted ? "quoted" : rfq.distributed_at ? "distributed" : "received";
    await sb.from("rfq_requests").update({ status: next, closed_at: null }).eq("id", rfq.id);
    if (rfq.status === "cancelled" && !rfq.compared_at) {
      // 비교표가 열리기 전에 취소한 요청만: 취소 때 만료시킨 초대를 되살린다 (회신하지 않음 처리한 기관, 운영자가 개별로 거둔 초대는 그대로 둔다. DB 트리거도 철회 초대를 expired 로 묶어 둔다, 0021)
      const { data: drafts } = await sb.from("cro_quotes").select("invite_id").eq("rfq_id", rfq.id);
      const withDraft = new Set((drafts ?? []).map((d) => d.invite_id as string));
      const { data: exp } = await sb.from("rfq_invites").select("id").eq("rfq_id", rfq.id).eq("status", "expired").is("declined_at", null).is("revoked_at", null);
      for (const i of exp ?? []) await sb.from("rfq_invites").update({ status: withDraft.has(i.id) ? "draft" : "sent" }).eq("id", i.id);
    }
    await logEvent(rfq.id, "note", "다시 열기", `상태 ${next}`, s.userId);
    return NextResponse.json({ ok: true, message: rfq.compared_at && !rfq.selected_quote_id ? "다시 열었습니다. 비교표가 열린 뒤라 회신은 닫힌 채로 두고, 받은 견적으로 선정할 수 있습니다." : "다시 열었습니다." });
  }
  return NextResponse.json({ error: "알 수 없는 동작" }, { status: 400 });
}
