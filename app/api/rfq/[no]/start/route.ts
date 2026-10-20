import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { startRfq } from "@/lib/rfq-create";

export const runtime = "nodejs";
// 기관 메일 발송까지 기다린다. 완료 화면이 안내 결과(보냈는지)를 보여 주도록
export const maxDuration = 60;

/**
 * POST — 첨부 업로드를 마친 위자드가 부른다(첨부가 없으면 접수 직후). 참여 안내(분야가 맞는 승인 기관 전부 + 지명 기관)와 접수 메일 한 통을 보낸다.
 * 이미 시작한 요청이면 아무것도 하지 않는다 (started_at 으로 한 번만).
 * 업로드가 일부 실패해도 부른다. 빠진 첨부는 요청 화면에서 다시 올릴 수 있고, 그때 기관에 알림이 간다.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (rfq.started_at) return NextResponse.json({ ok: true, already: true });
  if (["closed", "cancelled"].includes(rfq.status)) return NextResponse.json({ error: "이미 마무리된 요청입니다." }, { status: 409 });
  try {
    const r = await startRfq(rfq.id);
    // 안내한 기관 수는 의뢰자에게 돌려주지 않는다 (참여 선택형, 0023). 참여·제출 수는 요청 화면의 진행 현황으로 본다
    return NextResponse.json({ ok: true, started: r.started, offered: r.sent > 0 });
  } catch (e) {
    console.error("start rfq", e);
    // 시작 표시가 남았으면 예약 작업도 다시 하지 않는다. 운영자가 요청 화면에서 직접 전달한다
    return NextResponse.json({ ok: false, error: "참여 안내를 마치지 못했습니다. 운영자가 확인해 안내합니다." }, { status: 500 });
  }
}
