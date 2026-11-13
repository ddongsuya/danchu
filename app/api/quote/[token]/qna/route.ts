import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { loadQuote } from "@/lib/quote-load";
import { loadOptsFor } from "@/lib/concierge";
import { logEvent } from "@/lib/notify";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { answerQuestion, askQuestion, QNA_ERRORS } from "@/lib/rpc";
import { cleanText, hasContact, isTopic, partyLabels, QNA_TOPIC_LABEL } from "@/lib/qna";
import { comparisonOpened } from "@/lib/reply-window";
import { notifySponsor, snippet } from "@/lib/qna-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/;

/**
 * 기관 쪽 질의응답 (0045). 회신 링크(토큰)나 포털 담당자 로그인으로. 운영자는 기관 대신 묻거나 답하지 않는다.
 * POST { action: "ask", topic, testSeq, body } — 참여 뒤 비교표가 열리기 전까지 의뢰자에게 질의
 * POST { action: "answer", questionId, answer } — 의뢰자 질의에 답변 (질의한 의뢰자만 본다)
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const s = await sessionOrNull();
  if (s?.profile.role === "admin") return NextResponse.json({ error: QNA_ERRORS.operator_not_allowed.message }, { status: 403 });
  const got = await loadQuote(token, { ...loadOptsFor(s?.profile.role), markOpened: false });
  if (!got || !got.joined) return NextResponse.json({ error: "유효하지 않거나 만료된 링크예요." }, { status: 404 });
  // 다른 기관 담당자로 로그인한 채 링크를 열었으면 막는다
  if (s?.profile.role === "cro" && got.croOrgId && s.profile.cro_org_id !== got.croOrgId) {
    return NextResponse.json({ error: "다른 기관 담당자 계정으로 로그인되어 있어 보낼 수 없어요." }, { status: 403 });
  }
  const actor = s?.profile.role === "cro" ? s.userId : null;
  if (await rateLimited("qna-cro", actor ?? clientIp(req), 30, 600)) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sb = getSupabaseAdmin()!;
  const { data: rfq } = await sb.from("rfq_requests").select("id, rfq_no, substance, user_id, email, compared_at, selected_quote_id").eq("id", got.rfqId).maybeSingle();
  if (!rfq) return NextResponse.json({ error: QNA_ERRORS.not_found.message }, { status: 404 });

  // 의뢰자 알림에 쓰는 기관 표시명: 비교표가 열리기 전에는 기관 A·B·C
  const label = async () => {
    const { data: invs } = await sb.from("rfq_invites").select("id, cro_name, joined_at, sent_at").eq("rfq_id", rfq.id).not("joined_at", "is", null);
    return partyLabels(invs ?? [], comparisonOpened(rfq)).get(got.inviteId) ?? "참여 기관";
  };

  if (b.action === "ask") {
    const body = cleanText(b.body);
    const testSeq = typeof b.testSeq === "number" && Number.isInteger(b.testSeq) && b.testSeq > 0 ? b.testSeq : null;
    if (!body || !isTopic(b.topic)) return NextResponse.json({ error: QNA_ERRORS.bad_body.message }, { status: 400 });
    const res = await askQuestion({ inviteId: got.inviteId, userId: actor, direction: "cro", topic: b.topic, testSeq, body, hasContact: hasContact(body) });
    if (!res.ok) return fail(res.code);
    const topic = QNA_TOPIC_LABEL[b.topic];
    await logEvent(rfq.id, "qna", "기관 질의", topic, actor);
    await notifySponsor(rfq, { title: `기관 질의 · ${rfq.rfq_no} ${rfq.substance}`, body: `${await label()} · ${topic}\n${snippet(body)}`, questionId: res.id });
    return NextResponse.json({ ok: true, id: res.id });
  }

  if (b.action === "answer") {
    const questionId = typeof b.questionId === "string" && UUID.test(b.questionId) ? b.questionId : "";
    const answer = cleanText(b.answer);
    if (!questionId || !answer) return NextResponse.json({ error: QNA_ERRORS.bad_body.message }, { status: 400 });
    const res = await answerQuestion({ questionId, userId: actor, inviteId: got.inviteId, answer, hasContact: hasContact(answer), scope: null });
    if (!res.ok) return fail(res.code);
    await logEvent(rfq.id, "qna", "기관 답변", undefined, actor);
    await notifySponsor(rfq, { title: `질의 답변 · ${rfq.rfq_no} ${rfq.substance}`, body: `${await label()}\n${snippet(answer)}`, questionId });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: QNA_ERRORS.bad_body.message }, { status: 400 });
}

function fail(code: string) {
  const e = QNA_ERRORS[code];
  return NextResponse.json({ error: e?.message ?? "보내지 못했어요. 잠시 후 다시 시도해 주세요.", code }, { status: e?.status ?? 500 });
}
