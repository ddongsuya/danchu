import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo } from "@/lib/data";
import { logEvent } from "@/lib/notify";
import { audit, diffFields } from "@/lib/audit";
import { CONFIDENTIALITY_OPTIONS, countsTowardLimit, CRO_COUNT_OPTIONS, invitationLimit } from "@/lib/request-policy";

export const runtime = "nodejs";

/**
 * PATCH { croCount?, confidentiality? } — 의뢰자가 잘못 고른 전달 기관 수·기밀 등급을 운영자가 바로잡는다.
 * 종료·취소된 요청은 바꾸지 않는다. 기관 수를 이미 전달한 수보다 줄일 수는 없다 (전달 기록이 청구 근거라서).
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (["closed", "cancelled"].includes(rfq.status)) return NextResponse.json({ error: "종료·취소된 요청은 바꿀 수 없습니다." }, { status: 409 });

  const b = (await req.json().catch(() => ({}))) as { croCount?: unknown; confidentiality?: unknown };
  const patch: { cro_count?: string; confidentiality?: string } = {};
  if (b.croCount !== undefined) {
    if (!(CRO_COUNT_OPTIONS as readonly string[]).includes(b.croCount as string)) return NextResponse.json({ error: "전달 기관 수 값이 올바르지 않습니다." }, { status: 400 });
    patch.cro_count = b.croCount as string;
  }
  if (b.confidentiality !== undefined) {
    if (!(CONFIDENTIALITY_OPTIONS as readonly string[]).includes(b.confidentiality as string)) return NextResponse.json({ error: "기밀 등급 값이 올바르지 않습니다." }, { status: 400 });
    patch.confidentiality = b.confidentiality as string;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "바꿀 항목이 없습니다." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  if (patch.cro_count) {
    const { data: inv } = await sb.from("rfq_invites").select("status").eq("rfq_id", rfq.id);
    const used = (inv ?? []).filter((i) => countsTowardLimit(i.status)).length;
    if (used > invitationLimit(patch.cro_count)) return NextResponse.json({ error: `이미 ${used}곳에 전달되어 그보다 적게 줄일 수 없습니다. 필요하면 초대를 개별로 취소하세요.` }, { status: 409 });
  }
  const before = { cro_count: rfq.cro_count, confidentiality: rfq.confidentiality };
  const { error } = await sb.from("rfq_requests").update(patch).eq("id", rfq.id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  const changed = diffFields(before, { ...before, ...patch });
  const label = [patch.cro_count && `전달 기관 수 ${rfq.cro_count ?? "-"} → ${patch.cro_count}`, patch.confidentiality && `기밀 등급 ${rfq.confidentiality ?? "일반"} → ${patch.confidentiality}`].filter(Boolean).join(" · ");
  await logEvent(rfq.id, "terms", "요청 조건 변경", label, s.userId, patch);
  await audit({ userId: s.userId, email: s.email }, "rfq.terms", { type: "rfq_request", id: rfq.id, label: rfq.rfq_no }, changed);
  const wider = patch.cro_count && invitationLimit(patch.cro_count) > invitationLimit(rfq.cro_count);
  return NextResponse.json({ ok: true, message: wider ? "저장했습니다. 늘어난 자리는 배포 패널에서 채우거나 다음 자동 보충 때 채워집니다." : "저장했습니다." });
}
