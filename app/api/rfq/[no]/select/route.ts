import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq, type InviteRow, type QuoteRow } from "@/lib/data";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { won } from "@/lib/format";

export const runtime = "nodejs";

/**
 * POST { quoteId } — 의뢰자가 CRO를 선택한다.
 * rfq_awards 생성, 상태 selected, 선택된 CRO에 의뢰자 연락처 공개 알림, 나머지 CRO에 결과 안내.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin")) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (!rfq.compared_at) return NextResponse.json({ error: "비교표가 공개된 뒤에 선택할 수 있습니다." }, { status: 400 });
  if (rfq.selected_quote_id) return NextResponse.json({ error: "이미 CRO를 선택했습니다." }, { status: 409 });

  const b = (await req.json().catch(() => ({}))) as { quoteId?: unknown };
  const quoteId = typeof b.quoteId === "string" ? b.quoteId : "";
  const sb = getSupabaseAdmin()!;
  const { data: q } = await sb.from("cro_quotes").select("*").eq("id", quoteId).eq("rfq_id", rfq.id).eq("status", "submitted").maybeSingle();
  if (!q) return NextResponse.json({ error: "선택할 수 없는 견적입니다." }, { status: 400 });
  const quote = q as QuoteRow;
  const { data: inv } = await sb.from("rfq_invites").select("*").eq("id", quote.invite_id).maybeSingle();
  const invite = inv as InviteRow | null;

  const { data: award, error } = await sb
    .from("rfq_awards")
    .insert({ rfq_id: rfq.id, quote_id: quote.id, invite_id: quote.invite_id, cro_org_id: quote.cro_org_id, cro_name: quote.cro_name, selected_by: s.userId })
    .select("id")
    .single();
  if (error || !award) {
    console.error("award insert", error);
    return NextResponse.json({ error: "선택을 저장하지 못했습니다." }, { status: 500 });
  }
  await sb.from("rfq_requests").update({ status: "selected", selected_quote_id: quote.id }).eq("id", rfq.id);
  await logEvent(rfq.id, "selected", `${quote.cro_name} 선택`, `총 ${won(quote.total_amount ?? 0)} · 의뢰자 연락처가 CRO에 전달되었습니다.`, s.userId, { quoteId: quote.id });

  // 선택된 CRO: 연락처 공개
  const winners: string[] = [];
  const winnerMails: string[] = [];
  if (quote.cro_org_id) {
    const { data: ms } = await sb.from("profiles").select("id, email").eq("cro_org_id", quote.cro_org_id);
    for (const m of ms ?? []) {
      winners.push(m.id);
      winnerMails.push(m.email);
    }
  }
  if (!winnerMails.length && invite?.cro_email) winnerMails.push(invite.cro_email);
  await notifyUsers(
    winners,
    { kind: "선정", title: `선정되었습니다 · ${rfq.rfq_no} ${rfq.substance}`, body: `${rfq.company} ${rfq.contact_name} · ${rfq.email}${rfq.phone ? ` · ${rfq.phone}` : ""}\n의뢰자와 직접 계약을 진행하고, 체결 후 계약 정보를 보고해 주세요.`, href: "/cro/awards" },
    { to: winnerMails, replyTo: rfq.email },
  );

  // 나머지 제출 CRO: 결과 안내 (금액·타사명은 알리지 않는다)
  const { data: others } = await sb.from("cro_quotes").select("cro_org_id, cro_name, invite_id").eq("rfq_id", rfq.id).eq("status", "submitted").neq("id", quote.id);
  for (const o of others ?? []) {
    let ids: string[] = [];
    let mails: string[] = [];
    if (o.cro_org_id) {
      const { data: ms } = await sb.from("profiles").select("id, email").eq("cro_org_id", o.cro_org_id);
      ids = (ms ?? []).map((m) => m.id);
      mails = (ms ?? []).map((m) => m.email);
    }
    if (!mails.length) {
      const { data: oi } = await sb.from("rfq_invites").select("cro_email").eq("id", o.invite_id).maybeSingle();
      if (oi?.cro_email) mails = [oi.cro_email];
    }
    await notifyUsers(ids, { kind: "선정", title: `미선정 · ${rfq.rfq_no} ${rfq.substance}`, body: "의뢰자가 다른 기관을 선택했습니다. 참여해 주셔서 감사합니다.", href: "/cro/quotes" }, { to: mails });
  }

  await notifyUsers(await adminUserIds(), { kind: "선정", title: `${rfq.rfq_no} CRO 선택 · ${quote.cro_name}`, body: `${rfq.company} · 총 ${won(quote.total_amount ?? 0)}`, href: `/admin/r/${rfq.rfq_no}` }, { to: adminEmails() });
  await notifyUsers([s.userId], { kind: "선정", title: `${quote.cro_name}을 선택했습니다`, body: "CRO 담당자가 영업일 1일 내 연락합니다. 계약은 직접 진행합니다.", href: `/app/r/${rfq.rfq_no}` });

  return NextResponse.json({ ok: true, awardId: award.id });
}
