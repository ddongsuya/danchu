import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EMAIL_RE, authErrorKo, sendLoginLink } from "@/lib/auth-links";
import { adminEmails, adminUserIds, notifyUsers } from "@/lib/notify";
import { CATS } from "@/lib/rfq-schema";

export const runtime = "nodejs";

const GLP_OPTS = ["식약처(KGLP)", "OECD GLP", "US FDA GLP", "US EPA GLP", "기후에너지환경부·국립환경과학원", "농촌진흥청", "농림축산검역본부"];

/**
 * POST — CRO 가입 신청. 기관(pending) + 담당자 계정을 만들고 확인 링크를 보낸다.
 * 운영자가 승인하기 전까지 CRO 화면은 "승인 대기"만 보인다.
 * body: { email, password, name, phone?, org: { name, businessNo?, website?, address?, contactPhone?, glpCerts?, aaalac?, otherCerts?, categories?, intro? } }
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const o = (b.org && typeof b.org === "object" ? b.org : {}) as Record<string, unknown>;
  const s = (src: Record<string, unknown>, k: string, max = 120) => (typeof src[k] === "string" ? (src[k] as string).trim().slice(0, max) : "");
  const arr = (src: Record<string, unknown>, k: string, allow: readonly string[]) =>
    Array.isArray(src[k]) ? (src[k] as unknown[]).filter((x): x is string => typeof x === "string" && allow.includes(x)) : [];

  const email = s(b, "email", 200).toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  const name = s(b, "name");
  const orgName = s(o, "name");

  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "이메일 형식을 확인해 주세요." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  if (!name || !orgName) return NextResponse.json({ error: "담당자 성명과 기관명을 입력해 주세요." }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 });

  // 같은 이름의 기관이 이미 있으면 그 기관에 담당자로 합류 신청 (운영자가 확인)
  const { data: existing } = await admin.from("cro_orgs").select("id, status").ilike("name", orgName).maybeSingle();
  let orgId = existing?.id as string | undefined;
  if (!orgId) {
    const { data: org, error: oe } = await admin
      .from("cro_orgs")
      .insert({
        name: orgName,
        business_no: s(o, "businessNo", 40) || null,
        website: s(o, "website", 200) || null,
        address: s(o, "address", 200) || null,
        contact_name: name,
        contact_email: email,
        contact_phone: s(o, "contactPhone", 40) || s(b, "phone", 40) || null,
        glp_certs: arr(o, "glpCerts", GLP_OPTS),
        aaalac: typeof o.aaalac === "boolean" ? o.aaalac : null,
        other_certs: s(o, "otherCerts", 200) || null,
        categories: arr(o, "categories", CATS),
        intro: s(o, "intro", 1000) || null,
      })
      .select("id")
      .single();
    if (oe || !org) {
      console.error("cro_orgs insert", oe);
      return NextResponse.json({ error: "기관 정보를 저장하지 못했습니다." }, { status: 500 });
    }
    orgId = org.id;
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { role: "cro", name, phone: s(b, "phone", 40), company: orgName, cro_org_id: orgId },
  });
  if (error) {
    const msg = authErrorKo(error.message);
    const dup = msg.startsWith("이미 가입");
    if (!dup) console.error("signup-cro createUser", error);
    if (!existing) await admin.from("cro_orgs").delete().eq("id", orgId); // 방금 만든 기관은 되돌린다
    return NextResponse.json({ error: msg }, { status: dup ? 409 : 400 });
  }

  const sent = await sendLoginLink("signup", email);
  await notifyUsers(
    await adminUserIds(),
    { kind: "기관", title: `CRO 가입 신청 · ${orgName}`, body: `${name} (${email})${existing ? " · 기존 기관에 담당자 추가 신청" : ""}`, href: "/admin/cros" },
    { to: adminEmails(), replyTo: email },
  );
  return NextResponse.json({ ok: true, mailed: sent.ok, joined: !!existing });
}
