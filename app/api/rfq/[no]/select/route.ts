import { quoteSelectable } from "@/lib/quote-policy";
import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq, type QuoteRow } from "@/lib/data";
import { adminEmails, adminUserIds, logEvent, notifyUsers, operatorReplyTo } from "@/lib/notify";
import { replyPath } from "@/lib/concierge";
import { notifyInvitedOrgs } from "@/lib/distribute";
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
  // 담당자 계정이 없거나 운영자 관리 기관은 포털(/cro, 로그인 필요)을 열 수 없다. 로그인 없는 회신 링크로 보내고 체결 여부는 운영자가 메일로 묻는다
  const winners: string[] = [];
  const winnerMails: string[] = [];
  let winnerManaged = false;
  if (quote.cro_org_id) {
    const [{ data: ms }, { data: org }] = await Promise.all([
      sb.from("profiles").select("id, email").eq("cro_org_id", quote.cro_org_id),
      sb.from("cro_orgs").select("managed").eq("id", quote.cro_org_id).maybeSingle(),
    ]);
    for (const m of ms ?? []) {
      winners.push(m.id);
      winnerMails.push(m.email);
    }
    winnerManaged = !!org?.managed;
  }
  if (!winnerMails.length && invite?.cro_email) winnerMails.push(invite.cro_email);
  const winnerPath = invite ? replyPath(invite, { managed: winnerManaged, members: winners.length }) : "/cro/awards";
  const winnerPortal = winnerPath.startsWith("/cro/");
  const contact = `${rfq.company} ${rfq.contact_name} · ${rfq.email}${rfq.phone ? ` · ${rfq.phone}` : ""}`;
  await notifyUsers(
    winners,
    {
      kind: "선정",
      title: `선정되었습니다 · ${rfq.rfq_no} ${rfq.substance}`,
      body: winnerPortal
        ? `${contact}\n의뢰자와 직접 계약을 진행하고, 체결 후 계약 정보를 보고해 주세요.`
        : `${contact}\n의뢰자와 직접 계약을 진행해 주세요. 계약 진행 상황은 단추 운영자가 이 메일 주소로 여쭙겠습니다.`,
      href: winnerPortal ? "/cro/awards" : winnerPath,
    },
    // 운영자 관리 기관은 단추 메일의 회신이 운영 주소로 가도록 안내받았다. 그 밖에는 의뢰자에게 바로 닿게 둔다
    { to: winnerMails, replyTo: winnerManaged ? operatorReplyTo() : rfq.email },
  );

  // 나머지 제출 CRO: 결과 안내 (금액·타사명은 알리지 않는다). 기관마다 따로, 계정 없는 기관은 /q 링크로
  const { data: others } = await sb.from("cro_quotes").select("invite_id").eq("rfq_id", rfq.id).eq("status", "submitted").neq("id", quote.id);
  const otherIds = (others ?? []).map((o) => o.invite_id).filter((x): x is string => !!x);
  const { data: otherInvites } = otherIds.length ? await sb.from("rfq_invites").select("id, token, cro_org_id, cro_email").in("id", otherIds) : { data: [] };
  await notifyInvitedOrgs(otherInvites ?? [], { kind: "선정", title: `미선정 · ${rfq.rfq_no} ${rfq.substance}`, body: "의뢰자가 다른 기관을 선택했습니다. 참여해 주셔서 감사합니다.", portalHref: "/cro/quotes" });

  // 거래 귀속은 선정 시점의 기록(rfq_awards)으로 본다. 기존 거래 여부로 따로 판정하지 않는다
  await notifyUsers(await adminUserIds(), { kind: "선정", title: `${rfq.rfq_no} CRO 선택 · ${quote.cro_name}`, body: `${rfq.company} · 총 ${won(quote.total_amount ?? 0)}`, href: `/admin/r/${rfq.rfq_no}` }, { to: adminEmails() });
  // 체결 기록은 기관 보고나 운영자 확인으로 남는다. 누가 남기는지는 의뢰자에게 약속하지 않는다
  await notifyUsers([s.userId], { kind: "선정", title: `${quote.cro_name} 선정 완료 · ${rfq.rfq_no}`, body: "선정한 기관에 연락처를 전달했습니다. 기관이 곧 연락드리며, 계약은 기관과 직접 진행합니다. 계약 체결이 단추에 기록되면 알림으로 알려 드립니다.", href: `/app/r/${rfq.rfq_no}` }, { to: [rfq.email] });

  return NextResponse.json({ ok: true, awardId: award.id });
}
