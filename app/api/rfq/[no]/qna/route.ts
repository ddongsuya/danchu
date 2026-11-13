import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { logEvent } from "@/lib/notify";
import { rateLimited } from "@/lib/rate-limit";
import { answerQuestion, askQuestion, QNA_ERRORS } from "@/lib/rpc";
import { cleanText, hasContact, isTopic, QNA_TOPIC_LABEL } from "@/lib/qna";
import { notifyInvites, otherJoinedInvites, snippet } from "@/lib/qna-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/;

/**
 * 의뢰자 쪽 질의응답 (0045). 요청 주인만. 운영자는 묻거나 답하지 않는다.
 * POST { action: "ask", inviteId, topic, testSeq, body } — 비교표가 열린 뒤 견적을 낸 기관에 질의
 * POST { action: "answer", questionId, answer, scope } — 기관 질의에 답변. scope private = 질의 기관만, all = 참여 기관 전체
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (s.profile.role === "admin") return NextResponse.json({ error: QNA_ERRORS.operator_not_allowed.message }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !ownsRfq(rfq, s.userId)) return NextResponse.json({ error: "요청을 찾을 수 없어요." }, { status: 404 });
  if (await rateLimited("qna-sponsor", s.userId, 30, 600)) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sb = getSupabaseAdmin()!;

  if (b.action === "ask") {
    const inviteId = typeof b.inviteId === "string" && UUID.test(b.inviteId) ? b.inviteId : "";
    const body = cleanText(b.body);
    const testSeq = typeof b.testSeq === "number" && Number.isInteger(b.testSeq) && b.testSeq > 0 ? b.testSeq : null;
    if (!inviteId || !body || !isTopic(b.topic)) return NextResponse.json({ error: QNA_ERRORS.bad_body.message }, { status: 400 });
    const { data: inv } = await sb.from("rfq_invites").select("id, rfq_id, cro_name").eq("id", inviteId).maybeSingle();
    if (!inv || inv.rfq_id !== rfq.id) return NextResponse.json({ error: QNA_ERRORS.not_found.message }, { status: 404 });
    const res = await askQuestion({ inviteId, userId: s.userId, direction: "sponsor", topic: b.topic, testSeq, body, hasContact: hasContact(body) });
    if (!res.ok) return fail(res.code);
    await logEvent(rfq.id, "qna", "의뢰자 질의", QNA_TOPIC_LABEL[b.topic], s.userId);
    const topic = QNA_TOPIC_LABEL[b.topic];
    await notifyInvites([inviteId], () => ({
      title: `의뢰자 질의 · ${rfq.rfq_no} ${rfq.substance}`,
      body: `${topic}\n${snippet(body)}`,
      questionId: res.id,
    }));
    return NextResponse.json({ ok: true, id: res.id });
  }

  if (b.action === "answer") {
    const questionId = typeof b.questionId === "string" && UUID.test(b.questionId) ? b.questionId : "";
    const answer = cleanText(b.answer);
    const scope = b.scope === "private" || b.scope === "all" ? b.scope : null;
    if (!questionId || !answer || !scope) return NextResponse.json({ error: QNA_ERRORS.bad_body.message }, { status: 400 });
    const { data: q } = await sb.from("rfq_questions").select("id, rfq_id, invite_id, topic, body").eq("id", questionId).maybeSingle();
    if (!q || q.rfq_id !== rfq.id) return NextResponse.json({ error: QNA_ERRORS.not_found.message }, { status: 404 });
    const res = await answerQuestion({ questionId, userId: s.userId, inviteId: null, answer, hasContact: hasContact(answer), scope });
    if (!res.ok) return fail(res.code);
    const topic = QNA_TOPIC_LABEL[q.topic as keyof typeof QNA_TOPIC_LABEL] ?? "기타";
    await logEvent(rfq.id, "qna", `의뢰자 답변 · ${res.scope === "all" ? "참여 기관 전체" : "질의 기관만"}`, topic, s.userId);
    const others = res.scope === "all" ? await otherJoinedInvites(rfq.id, q.invite_id) : [];
    await notifyInvites([q.invite_id, ...others], (id) =>
      id === q.invite_id
        ? { title: `질의 답변 · ${rfq.rfq_no} ${rfq.substance}`, body: `${topic}\n${snippet(answer)}`, questionId }
        : { title: `공개 답변 · ${rfq.rfq_no} ${rfq.substance}`, body: `${topic}\n질의: ${snippet(q.body)}\n답변: ${snippet(answer)}`, questionId },
    );
    return NextResponse.json({ ok: true, scope: res.scope });
  }

  return NextResponse.json({ error: QNA_ERRORS.bad_body.message }, { status: 400 });
}

function fail(code: string) {
  const e = QNA_ERRORS[code];
  return NextResponse.json({ error: e?.message ?? "보내지 못했어요. 잠시 후 다시 시도해 주세요.", code }, { status: e?.status ?? 500 });
}
