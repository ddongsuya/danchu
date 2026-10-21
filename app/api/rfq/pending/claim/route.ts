import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { claimPending, isPendingToken } from "@/lib/rfq-pending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 접수와 참여 안내까지 기다린다
export const maxDuration = 60;

/**
 * POST { token } — 메일 버튼으로 로그인한 의뢰자가 맡긴 요청서 요약을 보고 "보내기"를 누른 경우 (/app/claim/<token>).
 * 화면을 여는 것(GET)만으로는 접수하지 않는다. 다른 사람이 만든 임시 요청서 링크를 열어도 내 계정으로 기관에 안내되지 않게.
 * 이메일 일치·의뢰자 계정·보관 기간·한 번만 접수는 claimPending 이 본다.
 */
export async function POST(req: Request) {
  const s = await sessionOrNull("requester");
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (await rateLimited("pending-claim:user", s.userId, 10, 15 * 60)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { token?: unknown };
  const token = isPendingToken(b.token) ? b.token : "";
  if (!token) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const r = await claimPending(token, { id: s.userId, email: s.email });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, rfqNo: r.rfqNo, started: r.started });
}
