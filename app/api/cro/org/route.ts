import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CATS } from "@/lib/rfq-schema";

export const runtime = "nodejs";

const GLP_OPTS = ["식약처(KGLP)", "OECD GLP", "US FDA GLP", "US EPA GLP", "기후에너지환경부·국립환경과학원", "농촌진흥청", "농림축산검역본부"];

/** POST — 내 기관 정보 수정 (CRO 담당자) */
export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  if (!s || !s.profile.cro_org_id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const v = (k: string, max = 120) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) || null : null);
  const arr = (k: string, allow: readonly string[]) => (Array.isArray(b[k]) ? (b[k] as unknown[]).filter((x): x is string => typeof x === "string" && allow.includes(x)) : []);
  const name = v("name");
  const categories = arr("categories", CATS);
  if (!name) return NextResponse.json({ error: "기관명을 입력해 주세요." }, { status: 400 });
  if (!categories.length) return NextResponse.json({ error: "수행 가능 시험 분야를 하나 이상 선택해 주세요." }, { status: 400 });

  const { error } = await getSupabaseAdmin()!
    .from("cro_orgs")
    .update({
      name,
      business_no: v("businessNo", 40),
      website: v("website", 200),
      address: v("address", 200),
      contact_name: v("contactName"),
      contact_email: v("contactEmail", 200),
      contact_phone: v("contactPhone", 40),
      other_certs: v("otherCerts", 200),
      intro: v("intro", 1000),
      glp_certs: arr("glpCerts", GLP_OPTS),
      categories,
      aaalac: typeof b.aaalac === "boolean" ? b.aaalac : null,
    })
    .eq("id", s.profile.cro_org_id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
