import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { POST as declineByToken } from "@/app/api/quote/[token]/decline/route";

export const runtime = "nodejs";

/**
 * POST { mode, reason? } — 운영자 전용 요약 화면(/admin/r/[no]/offer/[id])에서 기관이 알린 불참·철회를 초대 id 로 기록한다 (0023).
 * 운영자 화면이 토큰을 내보내지 않도록 서버에서 토큰을 찾아 회신 링크의 불참 라우트에 그대로 넘긴다 (운영자 세션, 감사 기록 포함).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "초대를 찾을 수 없습니다." }, { status: 404 });
  const sb = getSupabaseAdmin()!;
  const { data: inv } = await sb.from("rfq_invites").select("token").eq("id", id).maybeSingle();
  if (!inv?.token) return NextResponse.json({ error: "초대를 찾을 수 없습니다." }, { status: 404 });
  return declineByToken(req, { params: Promise.resolve({ token: inv.token }) });
}
