import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CATS } from "@/lib/rfq-schema";
import { distributeOpenRfqs } from "@/lib/distribute";

export const runtime = "nodejs";

const GLP_OPTS = ["식약처(KGLP)", "OECD GLP", "US FDA GLP", "US EPA GLP", "기후에너지환경부·국립환경과학원", "농촌진흥청", "농림축산검역본부"];

/** POST — 내 기관 정보 수정 (CRO 담당자) */
export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  if (!s || !s.profile.cro_org_id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  if (s.profile.org_role !== "owner") return NextResponse.json({ error: "기관 정보는 기관 대표 담당자만 수정할 수 있습니다." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const v = (k: string, max = 120) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) || null : null);
  const arr = (k: string, allow: readonly string[]) => (Array.isArray(b[k]) ? (b[k] as unknown[]).filter((x): x is string => typeof x === "string" && allow.includes(x)) : []);
  const name = v("name");
  const categories = arr("categories", CATS);
  if (!name) return NextResponse.json({ error: "기관명을 입력해 주세요." }, { status: 400 });
  if (!categories.length) return NextResponse.json({ error: "수행 가능 시험 분야를 하나 이상 선택해 주세요." }, { status: 400 });
  // 승인된 기관의 이름·사업자번호는 운영자만 바꾼다 (합류 매칭과 청구 명세의 기준이라 담당자가 임의로 바꾸면 안 된다)
  const org = s.org;
  const bizNo = v("businessNo", 40);
  if (org?.status === "approved" && (name.trim().toLowerCase() !== org.name.trim().toLowerCase() || (bizNo ?? "").replace(/[^0-9]/g, "") !== (org.business_no ?? "").replace(/[^0-9]/g, ""))) {
    return NextResponse.json({ error: "승인된 기관의 기관명·사업자등록번호 변경은 운영자(hello@danchu.kr)에게 요청해 주세요." }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()!
    .from("cro_orgs")
    .update({
      name,
      business_no: bizNo,
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
      auto_reply: b.autoReply === true,
    })
    .eq("id", s.profile.cro_org_id);
  if (error?.code === "23505") return NextResponse.json({ error: "같은 기관명 또는 사업자등록번호의 기관이 이미 있습니다. 운영자에게 문의해 주세요." }, { status: 409 });
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  // 수행 분야가 바뀌었으면 새로 맞는 요청을 바로 받는다
  try {
    await distributeOpenRfqs(s.profile.cro_org_id, s.userId);
  } catch (e) {
    console.error("sync invites", e);
  }
  return NextResponse.json({ ok: true });
}
