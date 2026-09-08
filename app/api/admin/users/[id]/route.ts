import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** POST { role, croOrgId } — 역할·기관 연결 변경 (본인 역할은 바꿀 수 없다) */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { role?: unknown; croOrgId?: unknown };
  const role = typeof b.role === "string" && ["requester", "cro", "admin"].includes(b.role) ? b.role : "";
  const croOrgId = typeof b.croOrgId === "string" && /^[0-9a-f-]{36}$/.test(b.croOrgId) ? b.croOrgId : null;
  if (!role) return NextResponse.json({ error: "역할이 올바르지 않습니다." }, { status: 400 });
  if (id === s.userId && role !== "admin") return NextResponse.json({ error: "본인의 운영자 권한은 해제할 수 없습니다." }, { status: 400 });
  const { error } = await getSupabaseAdmin()!.from("profiles").update({ role, cro_org_id: role === "cro" ? croOrgId : null }).eq("id", id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
