import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** POST { id? } — 알림 읽음 처리. id가 없으면 전체 */
export async function POST(req: Request) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const sb = getSupabaseAdmin()!;
  const b = (await req.json().catch(() => ({}))) as { id?: unknown };
  let q = sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", s.userId).is("read_at", null);
  if (typeof b.id === "string") q = q.eq("id", b.id);
  const { error } = await q;
  if (error) return NextResponse.json({ error: "처리하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
