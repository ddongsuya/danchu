import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** POST { name, company, dept, phone, orgType } — 내 프로필 수정 */
export async function POST(req: Request) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const v = (k: string, max = 120) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) || null : undefined);
  const patch: Record<string, string | null> = {};
  for (const [k, col] of [["name", "name"], ["company", "company"], ["dept", "dept"], ["phone", "phone"], ["orgType", "org_type"]] as const) {
    const x = v(k, k === "phone" ? 40 : 120);
    if (x !== undefined) patch[col] = x;
  }
  if (!patch.name) return NextResponse.json({ error: "성명은 비울 수 없습니다." }, { status: 400 });
  if (s.profile.role === "requester" && !patch.company) return NextResponse.json({ error: "회사·기관명은 비울 수 없습니다." }, { status: 400 });
  const { error } = await getSupabaseAdmin()!.from("profiles").update(patch).eq("id", s.userId);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
