import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — 승인된 참여 기관 이름·분야·GLP (요청서의 지명 기관 선택용). 연락처·약정은 내보내지 않는다 */
export async function GET() {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (await rateLimited("orgs-list", s.userId, 60, 60)) return NextResponse.json({ orgs: [] }, { status: 429 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ orgs: [] });
  const { data } = await sb.from("cro_orgs").select("id, name, categories, glp_certs").eq("status", "approved").order("name");
  return NextResponse.json({ orgs: (data ?? []).map((o) => ({ id: o.id, name: o.name, categories: o.categories ?? [], glp: o.glp_certs ?? [] })) });
}
