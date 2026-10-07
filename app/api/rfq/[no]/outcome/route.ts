import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";

export const runtime = "nodejs";

const OUTCOMES = ["외부 진행", "보류", "취소"] as const;
type Outcome = (typeof OUTCOMES)[number];

/**
 * POST { outcome: '외부 진행'|'보류'|'취소', note?: string }
 * 의뢰자가 비교표를 보고도 기관을 선정하지 않은 채 요청을 마무리할 때 그 결과를 남긴다.
 * - 외부 진행: 단추 밖에서 어느 기관과 진행했는지(note). 전달 기관 중 하나면 선정 없이 계약이 성사된 신호
 * - 보류: 당장 진행하지 않음
 * - 취소: 시험 계획 자체가 바뀜
 * 요청은 종료(closed)되고 남은 회신은 닫힌다. 선정 없이 닫힌 요청은 운영자 명세의 이상 탐지 대상이다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin")) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (rfq.selected_quote_id) return NextResponse.json({ error: "이미 기관을 선정한 요청입니다." }, { status: 409 });
  if (["closed", "cancelled"].includes(rfq.status)) return NextResponse.json({ error: "이미 마무리된 요청입니다." }, { status: 409 });

  const b = (await req.json().catch(() => ({}))) as { outcome?: unknown; note?: unknown };
  const outcome = OUTCOMES.find((o) => o === b.outcome) as Outcome | undefined;
  if (!outcome) return NextResponse.json({ error: "마무리 사유를 선택해 주세요." }, { status: 400 });
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) : "";
  if (outcome === "외부 진행" && !note) return NextResponse.json({ error: "어느 기관과 진행하는지 적어 주세요." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const now = new Date().toISOString();
  const { error } = await sb
    .from("rfq_requests")
    .update({ outcome, outcome_note: note || null, outcome_at: now, status: outcome === "취소" ? "cancelled" : "closed", closed_at: now })
    .eq("id", rfq.id)
    .is("selected_quote_id", null);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  await sb.from("rfq_invites").update({ status: "expired" }).eq("rfq_id", rfq.id).in("status", ["sent", "draft"]);

  await logEvent(rfq.id, "outcome", `선정 없이 마무리 · ${outcome}`, note || undefined, s.userId, { outcome });
  await notifyUsers(
    await adminUserIds(),
    { kind: "선정", title: `${rfq.rfq_no} 선정 없이 마무리 · ${outcome}`, body: note || "사유 없음", href: `/admin/r/${rfq.rfq_no}` },
    { to: adminEmails() },
  );
  return NextResponse.json({ ok: true });
}
