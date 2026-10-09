import { NextResponse } from "next/server";
import { likeExact } from "@/lib/sql";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EMAIL_RE, authErrorKo, sendLoginLink } from "@/lib/auth-links";
import { adminEmails, adminUserIds, notifyUsers } from "@/lib/notify";
import { CATS } from "@/lib/rfq-schema";
import { clientIp, rateLimited, TOO_MANY } from "@/lib/rate-limit";

export const runtime = "nodejs";

const GLP_OPTS = ["식약처(KGLP)", "OECD GLP", "US FDA GLP", "US EPA GLP", "기후에너지환경부·국립환경과학원", "농촌진흥청", "농림축산검역본부"];

/**
 * POST — CRO 가입 신청. 기관(pending) + 담당자 계정을 만들고 확인 링크를 보낸다.
 * - 새 기관: 계정을 그 기관에 바로 연결한다 (기관 자체가 승인 대기라 아직 아무것도 못 본다).
 * - 이름이 같은 기관이 이미 있으면: 계정은 만들되 기관에 연결하지 않고 pending_org_id 에 합류 신청만 남긴다.
 *   운영자가 기관 화면에서 연결해야 그 기관의 요청서를 볼 수 있다.
 * 역할·기관은 가입 트리거가 아니라 여기서 service role 로 적는다 (트리거는 metadata 를 믿지 않는다).
 * body: { email, password, name, phone?, org: { name, businessNo?, website?, address?, contactPhone?, glpCerts?, aaalac?, otherCerts?, categories?, intro? } }
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (await rateLimited("signup-cro:ip", ip, 5, 60 * 60)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

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
  if (await rateLimited("signup-cro:email", email, 3, 60 * 60)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 });

  // 같은 이름의 기관이 이미 있으면 합류 신청으로 받는다 (연결은 운영자가 한다)
  const { data: existing } = await admin.from("cro_orgs").select("id, status").ilike("name", likeExact(orgName)).limit(1).maybeSingle();
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

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { name, phone: s(b, "phone", 40), company: orgName },
  });
  if (error || !created.user) {
    const msg = authErrorKo(error?.message);
    const dup = msg.startsWith("이미 가입");
    if (!dup) console.error("signup-cro createUser", error);
    if (!existing) await admin.from("cro_orgs").delete().eq("id", orgId); // 방금 만든 기관은 되돌린다
    return NextResponse.json({ error: msg }, { status: dup ? 409 : 400 });
  }

  // 역할·기관은 서버가 직접 적는다. 기존 기관이면 합류 신청(pending_org_id)만 남긴다.
  const { error: pe } = await admin
    .from("profiles")
    .update({ role: "cro", cro_org_id: existing ? null : orgId, pending_org_id: existing ? orgId : null, phone: s(b, "phone", 40) || null })
    .eq("id", created.user.id);
  if (pe) console.error("signup-cro profile update", pe);

  const sent = await sendLoginLink("signup", email);
  await notifyUsers(
    await adminUserIds(),
    { kind: "기관", title: `CRO 가입 신청 · ${orgName}`, body: `${name} (${email})${existing ? " · 기존 기관에 담당자 합류 신청 (기관 화면에서 연결)" : ""}`, href: existing ? `/admin/cros/${orgId}` : "/admin/cros" },
    { to: adminEmails(), replyTo: email },
  );
  return NextResponse.json({ ok: true, mailed: sent.ok, joined: !!existing });
}
