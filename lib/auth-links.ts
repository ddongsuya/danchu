import { getSupabaseAdmin } from "./supabase";
import { sendAuthMail } from "./mail";
import { siteUrl } from "./notify";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 내부 경로만 허용 (오픈 리다이렉트 방지) */
export function safeNext(v: unknown, fallback = ""): string {
  return typeof v === "string" && /^\/(?!\/)[\w\-./?=&%]*$/.test(v) ? v : fallback;
}

/**
 * Supabase가 만든 일회용 토큰으로 우리 도메인의 확인 링크를 만들어 Resend로 보낸다.
 * (Supabase 기본 SMTP는 시간당 발송 한도가 매우 낮아 쓰지 않는다)
 */
export async function sendLoginLink(kind: "signup" | "magic" | "recovery", email: string, next = ""): Promise<{ ok: boolean; notFound?: boolean }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false };
  const type = kind === "recovery" ? "recovery" : "magiclink";
  const { data, error } = await admin.auth.admin.generateLink({ type, email });
  if (error || !data?.properties?.hashed_token) {
    const notFound = /not found|does not exist/i.test(error?.message || "");
    if (!notFound) console.error("generateLink", kind, error);
    return { ok: false, notFound };
  }
  const q = new URLSearchParams({ token_hash: data.properties.hashed_token, type });
  if (next) q.set("next", next);
  const link = `${siteUrl()}/auth/confirm?${q}`;
  const ok = await sendAuthMail(kind, email, link);
  return { ok };
}

/** Supabase 오류 메시지를 사용자 문구로 */
export function authErrorKo(msg: string | undefined): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("already") && m.includes("registered")) return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (m.includes("already been registered") || m.includes("duplicate")) return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (m.includes("not confirmed")) return "이메일 확인이 끝나지 않았습니다. 받은 편지함의 확인 링크를 눌러 주세요.";
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "이메일 또는 비밀번호가 맞지 않습니다.";
  if (m.includes("password") && m.includes("least")) return "비밀번호는 8자 이상이어야 합니다.";
  if (m.includes("rate limit") || m.includes("too many")) return "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return "링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요.";
  return "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
