import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isPendingToken } from "@/lib/rfq-pending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?token= — 메일 버튼으로 다른 탭에서 접수가 끝났는지. 번호를 기다리는 화면이 몇 초마다 묻는다.
 * 토큰을 가진 화면만 물을 수 있고, 접수 번호 말고는 돌려주지 않는다.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!isPendingToken(token)) return NextResponse.json({ claimed: false }, { status: 400 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ claimed: false });
  const { data } = await sb.from("rfq_pending").select("claimed_rfq_no").eq("token", token).maybeSingle();
  return NextResponse.json({ claimed: !!data?.claimed_rfq_no, rfqNo: data?.claimed_rfq_no ?? null }, { headers: { "Cache-Control": "no-store" } });
}
