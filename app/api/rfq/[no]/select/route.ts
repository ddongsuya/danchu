import { quoteSelectable } from "@/lib/quote-policy";
import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq, type QuoteRow } from "@/lib/data";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { won } from "@/lib/format";
import { SELECT_QUOTE_ERRORS, selectQuote } from "@/lib/rpc";

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

  const b = (await req.json().catch(() => ({}))) as { quoteId?: unknown };
  const quoteId = typeof b.quoteId === "string" && /^[0-9a-f-]{36}$/.test(b.quoteId) ? b.quoteId : "";
  if (!quoteId) return NextResponse.json({ error: "선택할 수 없는 견적입니다." }, { status: 400 });
  const sb = getSupabaseAdmin()!;

  const { data: candidate } = await sb.from("cro_quotes").select("auto, pdf_path, start_date, valid_until").eq("id", quoteId).eq("rfq_id", rfq.id).eq("status", "submitted").maybeSingle();
  if (!candidate || !quoteSelectable(candidate)) return NextResponse.json({ error: "정식 견적서와 유효기간을 확인한 뒤 기관을 선택해 주세요." }, { status: 409 });
  // award 삽입과 요청 상태 갱신을 한 트랜잭션으로 (동시 선택은 DB 가 한 건만 받는다)
  const sel = await selectQuote(rfq.id, quoteId, s.userId);
  if (!sel.ok) {
    const e = SELECT_QUOTE_ERRORS[sel.code];
    return NextResponse.json({ error: e?.message ?? "선택을 저장하지 못했습니다." }, { status: e?.status ?? 500 });
  }
  const award = { id: sel.award_id };
  const { data: q } = await sb.from("cro_quotes").select("*").eq("id", quoteId).maybeSingle();
  const quote = (q ?? { id: quoteId, invite_id: sel.invite_id, cro_org_id: sel.cro_org_id, cro_name: sel.cro_name, total_amount: null }) as Pick<QuoteRow, "id" | "invite_id" | "cro_org_id" | "cro_name" | "total_amount">;
  const { data: inv } = await sb.from("rfq_invites").select("*").eq("id", quote.invite_id).maybeSingle();
  const invite = inv;
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
  await notifyUsers([s.userId], { kind: "선정", title: `${quote.cro_name}을 선택했습니다`, body: "선택한 기관에 연락처를 전달했습니다. 계약은 기관과 직접 진행합니다.", href: `/app/r/${rfq.rfq_no}` });

  return NextResponse.json({ ok: true, awardId: award.id });
}
