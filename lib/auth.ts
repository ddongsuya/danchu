import { redirect } from "next/navigation";
import { cache } from "react";
import { createSessionClient } from "./supabase-server";
import { getSupabaseAdmin } from "./supabase";

export type Role = "requester" | "cro" | "admin";

export type Profile = {
  id: string;
  email: string;
  role: Role;
  name: string | null;
  company: string | null;
  dept: string | null;
  phone: string | null;
  org_type: string | null;
  cro_org_id: string | null;
  /** 기존 기관에 담당자로 합류 신청한 상태 (운영자가 연결하기 전) */
  pending_org_id?: string | null;
  /** 기관 내 역할. owner 만 기관 정보 수정·담당자 관리 */
  org_role?: "owner" | "member";
};

export type CroOrg = {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  business_no: string | null;
  website: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  glp_certs: string[];
  aaalac: boolean | null;
  other_certs: string | null;
  categories: string[];
  intro: string | null;
  created_at: string;
  approved_at: string | null;
  /** 기한까지 손대지 않은 초안을 예비 견적으로 자동 제출 */
  auto_reply?: boolean;
  /** 약정: 월 전달 한도(null 이면 없음), 전달 1건당 이용료(원, null 이면 미정) */
  monthly_cap?: number | null;
  per_request_fee?: number | null;
};

export type Session = { userId: string; email: string; profile: Profile; org: CroOrg | null; /** 합류 신청 중인 기관 */ pendingOrg: CroOrg | null };

/** 역할별 홈 */
export function homeOf(role: Role): string {
  return role === "admin" ? "/admin" : role === "cro" ? "/cro" : "/app";
}

/**
 * 현재 로그인 사용자 + 프로필. 없으면 null.
 * 요청 한 번 안에서는 캐시된다.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const sb = await createSessionClient();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (!user || !user.email) return null;

  const admin = getSupabaseAdmin();
  if (!admin) return null;

  let { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) {
    // 트리거가 아직 없던 시점에 가입한 사용자 — 여기서 만든다
    const md = (user.user_metadata || {}) as Record<string, string>;
    const { data: created } = await admin
      .from("profiles")
      .insert({ id: user.id, email: user.email, role: "requester", name: md.name || null, company: md.company || null })
      .select("*")
      .single();
    profile = created;
  }
  if (!profile) return null;

  // 운영자 권한은 DB의 role 로만 정한다. 이메일이 설정값과 같다는 이유로 자동 승격하지 않는다.
  // (ADMIN_EMAIL 은 알림 메일 수신 주소로만 쓴다. 운영자 지정은 운영자 콘솔이나 SQL 로 한다)

  let org: CroOrg | null = null;
  let pendingOrg: CroOrg | null = null;
  if (profile.cro_org_id) {
    const { data: o } = await admin.from("cro_orgs").select("*").eq("id", profile.cro_org_id).maybeSingle();
    org = (o as CroOrg | null) ?? null;
  } else if (profile.pending_org_id) {
    const { data: o } = await admin.from("cro_orgs").select("*").eq("id", profile.pending_org_id).maybeSingle();
    pendingOrg = (o as CroOrg | null) ?? null;
  }
  return { userId: user.id, email: user.email, profile: profile as Profile, org, pendingOrg };
});

/**
 * 로그인 필수 (+ 역할 제한). 아니면 로그인 화면으로, 역할이 다르면 그 역할의 홈으로 보낸다.
 * 운영자는 모든 영역에 들어갈 수 있다.
 */
export async function requireSession(role?: Role, next?: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (role && s.profile.role !== role && s.profile.role !== "admin") redirect(homeOf(s.profile.role));
  return s;
}

/** 라우트 핸들러용: 세션이 없으면 null (redirect 대신) */
export async function sessionOrNull(role?: Role): Promise<Session | null> {
  const s = await getSession();
  if (!s) return null;
  if (role && s.profile.role !== role && s.profile.role !== "admin") return null;
  return s;
}
