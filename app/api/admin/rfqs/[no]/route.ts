import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo } from "@/lib/data";
import { logEvent } from "@/lib/notify";
import { audit, diffFields } from "@/lib/audit";
import { CONFIDENTIALITY_OPTIONS, CRO_COUNT_OPTIONS, invitationLimit } from "@/lib/request-policy";
import { setSeatCount } from "@/lib/rpc";

export const runtime = "nodejs";

/**
 * PATCH { croCount?, confidentiality? } — 의뢰자가 잘못 고른 전달 기관 수·기밀 등급을 운영자가 바로잡는다.
 * 종료·취소된 요청은 바꾸지 않는다. 자리 수를 이미 참여한 기관 수(참여·작성 중·제출)보다 줄일 수는 없다 (0023: 안내는 자리 수와 무관).
 * 참여 안내를 보낸 뒤(distributed_at)에는 비교표가 열리기 전 자리 수를 줄일 수 없다 (409). 줄이면 참여가 일찍 마감되어
 * 기한 전에 비교표가 열릴 수 있어서다 (2026-10-21 결정 2: 운영자 조기 마감 없음). 늘리기는 된다.
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
    if (rfq.distributed_at && !rfq.compared_at && invitationLimit(patch.cro_count) < invitationLimit(rfq.cro_count)) {
      return NextResponse.json({ error: "참여 안내를 보낸 뒤에는 자리 수를 줄일 수 없습니다. 자리를 줄이면 참여가 일찍 마감되어 회신 기한 전에 비교표가 열릴 수 있습니다.", code: "seat_shrink" }, { status: 409 });
    }
  }
  if (b.confidentiality !== undefined) {
    if (!(CONFIDENTIALITY_OPTIONS as readonly string[]).includes(b.confidentiality as string)) return NextResponse.json({ error: "기밀 등급 값이 올바르지 않습니다." }, { status: 400 });
    patch.confidentiality = b.confidentiality as string;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "바꿀 항목이 없습니다." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const before = { cro_count: rfq.cro_count, confidentiality: rfq.confidentiality };
  if (patch.cro_count) {
    // 자리 수는 DB 함수가 요청 행을 잠그고 참여 수를 센 뒤 바꾼다 (동시 참여와 겹쳐도 참여 수 > 자리 수가 되지 않는다)
    const r = await setSeatCount(rfq.id, patch.cro_count);
    if (!r.ok) {
      if (r.code === "too_few") return NextResponse.json({ error: `이미 ${r.used ?? "여러"}곳이 참여해 그보다 적게 줄일 수 없습니다. 기관이 철회를 알려 오면 회신 링크 화면에서 철회로 기록해 주세요.` }, { status: 409 });
      if (r.code === "closed") return NextResponse.json({ error: "종료·취소된 요청은 바꿀 수 없습니다." }, { status: 409 });
      return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
    }
  }
  if (patch.confidentiality) {
    const { error } = await sb.from("rfq_requests").update({ confidentiality: patch.confidentiality }).eq("id", rfq.id);
    if (error) return NextResponse.json({ error: patch.cro_count ? "자리 수는 바꿨지만 기밀 등급을 저장하지 못했습니다." : "저장하지 못했습니다." }, { status: 500 });
  }
  const changed = diffFields(before, { ...before, ...patch });
  const label = [patch.cro_count && `전달 기관 수 ${rfq.cro_count ?? "-"} → ${patch.cro_count}`, patch.confidentiality && `기밀 등급 ${rfq.confidentiality ?? "일반"} → ${patch.confidentiality}`].filter(Boolean).join(" · ");
  await logEvent(rfq.id, "terms", "요청 조건 변경", label, s.userId, patch);
  await audit({ userId: s.userId, email: s.email }, "rfq.terms", { type: "rfq_request", id: rfq.id, label: rfq.rfq_no }, changed);
  const wider = patch.cro_count && invitationLimit(patch.cro_count) > invitationLimit(rfq.cro_count);
  return NextResponse.json({ ok: true, message: wider ? "저장했습니다. 늘어난 자리에는 참여 안내를 받은 기관이 참여할 수 있습니다." : "저장했습니다." });
}
