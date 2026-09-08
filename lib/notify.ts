import { getSupabaseAdmin } from "./supabase";
import { sendMail, mailWrap, esc } from "./mail";

export type NotifyKind = "접수" | "배포" | "견적" | "비교" | "선정" | "계약" | "기관" | "시스템";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://danchu.kr").replace(/\/$/, "");
}

/**
 * 앱 내 알림 + (선택) 이메일.
 * 사용자 ID 목록에 알림 행을 만들고, email 이 주어지면 같은 내용을 Resend로 보낸다.
 */
export async function notifyUsers(
  userIds: string[],
  n: { kind: NotifyKind; title: string; body?: string; href?: string },
  email?: { to: string[]; subject?: string; html?: string; replyTo?: string },
): Promise<void> {
  const sb = getSupabaseAdmin();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (sb && ids.length) {
    const rows = ids.map((user_id) => ({ user_id, kind: n.kind, title: n.title, body: n.body ?? null, href: n.href ?? null }));
    const { error } = await sb.from("notifications").insert(rows);
    if (error) console.error("notifications insert", error);
  }
  if (email && email.to.length) {
    const link = n.href ? `${siteUrl()}${n.href}` : siteUrl();
    const html =
      email.html ??
      mailWrap(`
        <h2 style="margin:0 0 12px;font-size:20px">${esc(n.title)}</h2>
        ${n.body ? `<p style="white-space:pre-wrap">${esc(n.body)}</p>` : ""}
        <p style="margin-top:20px"><a href="${esc(link)}" style="display:inline-block;background:#A3690F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">단추에서 보기</a></p>`);
    await sendMail({ to: email.to, subject: email.subject ?? `[단추] ${n.title}`, html, replyTo: email.replyTo }).catch((e) => console.error("notify mail", e));
  }
}

/** 요청 진행 이력 한 줄 */
export async function logEvent(
  rfqId: string,
  kind: string,
  title: string,
  body?: string,
  actorId?: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from("rfq_events").insert({ rfq_id: rfqId, kind, title, body: body ?? null, actor_id: actorId ?? null, meta: meta ?? {} });
  if (error) console.error("rfq_events insert", error);
}

/** 운영자 계정 ID 목록 (알림 대상) */
export async function adminUserIds(): Promise<string[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data } = await sb.from("profiles").select("id").eq("role", "admin");
  return (data ?? []).map((r) => r.id as string);
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
}
