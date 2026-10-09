import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { normalizeBusinessNo } from "@/lib/request-policy";

export const runtime = "nodejs";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 기관의 기존 고객 목록. 선정 시 의뢰자 회사명과 대조해 성사수수료 면제 후보로 표시한다 (참여 약정서 제5조 6항).
 * 대표 담당자(owner)만 고친다. 목록은 이 기관에만 보이고 의뢰자·다른 기관에는 보이지 않는다.
 */
async function owner() {
  const s = await sessionOrNull("cro");
  if (!s || !s.profile.cro_org_id) return null;
  if (s.profile.org_role !== "owner") return null;
  return s;
}

/** POST { name, businessNo?, lastContractOn?, note? } */
export async function POST(req: Request) {
  const s = await owner();
  if (!s) return NextResponse.json({ error: "기존 고객 목록은 기관 대표 담당자만 고칠 수 있습니다." }, { status: 403 });
  if (await rateLimited("org-clients", s.userId, 60, 600)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const v = (k: string, max: number) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const name = v("name", 120);
  if (name.length < 2) return NextResponse.json({ error: "회사명을 입력해 주세요." }, { status: 400 });
  const businessNo = normalizeBusinessNo(v("businessNo", 40));
  if (v("businessNo", 40) && (!businessNo || businessNo.length !== 10)) return NextResponse.json({ error: "사업자등록번호는 숫자 10자리입니다." }, { status: 400 });
  const lastContractOn = v("lastContractOn", 10);
  if (lastContractOn && !YMD.test(lastContractOn)) return NextResponse.json({ error: "마지막 계약일은 YYYY-MM-DD 형식입니다." }, { status: 400 });
  const sb = getSupabaseAdmin()!;
  const { count } = await sb.from("cro_org_clients").select("id", { count: "exact", head: true }).eq("org_id", s.profile.cro_org_id!);
  if ((count ?? 0) >= 500) return NextResponse.json({ error: "기존 고객은 500곳까지 등록할 수 있습니다." }, { status: 400 });
  const { data, error } = await sb
    .from("cro_org_clients")
    .insert({ org_id: s.profile.cro_org_id!, name, business_no: businessNo, last_contract_on: lastContractOn || null, note: v("note", 200) || null, created_by: s.userId })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "이미 등록된 회사입니다." }, { status: 409 });
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

/** DELETE { id } */
export async function DELETE(req: Request) {
  const s = await owner();
  if (!s) return NextResponse.json({ error: "기존 고객 목록은 기관 대표 담당자만 고칠 수 있습니다." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof b.id === "string" && /^[0-9a-f-]{36}$/.test(b.id) ? b.id : "";
  if (!id) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const { error } = await getSupabaseAdmin()!.from("cro_org_clients").delete().eq("id", id).eq("org_id", s.profile.cro_org_id!);
  if (error) return NextResponse.json({ error: "삭제하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
