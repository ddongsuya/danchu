import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { findDuplicateOrg, parseManagedOrg } from "@/lib/concierge";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST { name, contactEmail, categories, contactName?, contactPhone?, businessNo?, glpCerts?, aaalac?, otherCerts?, website? }
 * 운영자가 아직 가입하지 않은 기관을 직접 등록한다 (운영자 관리 기관, managed).
 * - 바로 참여 중(approved)으로 만들고 승인 메일은 보내지 않는다. 담당자 계정은 없다.
 * - 자동 배포·보충·의뢰자 지명 목록에는 들어가지 않는다 (참여 계약이 없는 기관). 운영자가 배포 패널에서 요청마다 고른다.
 *   청구 명세·카탈로그는 다른 승인 기관과 같게 쓴다 (관리 기관도 견적을 내면 청구 대상, 0020). 메일 링크는 로그인 없는 /q/{token} 으로 간다.
 * - 사업자번호나 법인 표기를 뗀 이름이 같은 기관이 있으면 만들지 않고 409 와 그 기관 id 를 돌려준다.
 * - 나중에 그 기관 담당자가 직접 가입하면 가입 화면의 중복 판정이 이 기관으로 합류 신청을 남긴다.
 *   운영자가 연결하면 managed 가 풀린다 (app/api/admin/users/[id]/route.ts).
 */
export async function POST(req: Request) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const parsed = parseManagedOrg(await req.json().catch(() => null));
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });
  // 기관 수는 수백 곳 이하라 전부 읽어 같은 규칙(lib/concierge.ts)으로 비교한다. DB unique 는 이름 소문자·사업자번호만 본다
  const { data: orgs, error: le } = await sb.from("cro_orgs").select("id, name, business_no, status, managed").limit(5000);
  if (le) return NextResponse.json({ error: "기존 기관을 확인하지 못했습니다." }, { status: 500 });
  const dup = findDuplicateOrg(parsed, orgs ?? []);
  if (dup) return NextResponse.json({ error: `이미 등록된 기관입니다: ${dup.name}`, existingId: dup.id }, { status: 409 });

  const { data: org, error } = await sb
    .from("cro_orgs")
    .insert({ ...parsed, status: "approved", approved_at: new Date().toISOString(), managed: true })
    .select("id, name")
    .single();
  if (error?.code === "23505") {
    // 동시 등록 레이스: DB unique 가 막았다. 방금 생긴 기관을 찾아 돌려준다
    const { data: again } = await sb.from("cro_orgs").select("id, name, business_no").limit(5000);
    const hit = findDuplicateOrg(parsed, again ?? []);
    return NextResponse.json({ error: `이미 등록된 기관입니다${hit ? `: ${hit.name}` : "."}`, existingId: hit?.id }, { status: 409 });
  }
  if (error || !org) return NextResponse.json({ error: "기관을 저장하지 못했습니다." }, { status: 500 });

  await audit({ userId: s.userId, email: s.email }, "org.create", { type: "cro_org", id: org.id, label: org.name }, { after: { status: "approved", managed: true, contact_email: parsed.contact_email, categories: parsed.categories } });
  return NextResponse.json({ ok: true, id: org.id, message: `${org.name}을(를) 운영자 관리 기관으로 추가했습니다. 자동 배포에는 들어가지 않으며, 요청 화면의 배포 패널에서 골라 보낼 수 있습니다.` });
}
