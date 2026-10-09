import { getSupabaseAdmin } from "./supabase";
import { captureError } from "./observe";

export type AuditAction =
  | "org.approve" | "org.reject" | "org.suspend" | "org.terms"
  | "user.role" | "user.delete"
  | "invite.billing" | "invite.resend" | "invite.cancel" | "billing.close"
  | "rfq.deadline" | "rfq.terms" | "award.contract";

/**
 * 운영자 행위를 남긴다. 요청 단위 이력(rfq_events)과 달리 기관·사용자·청구처럼 요청 밖의 변경을 모은다.
 * 실패해도 본 작업을 막지 않는다. before/after 에는 바뀐 필드만 넣는다.
 */
export async function audit(
  actor: { userId: string; email: string },
  action: AuditAction,
  target: { type: "cro_org" | "profile" | "rfq_invite" | "rfq_request" | "rfq_award" | "billing_period"; id: string | null; label?: string },
  change?: { before?: Record<string, unknown>; after?: Record<string, unknown>; note?: string },
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from("admin_audit").insert({
    actor_id: actor.userId,
    actor_email: actor.email,
    action,
    target_type: target.type,
    target_id: target.id,
    target_label: target.label ?? null,
    before: change?.before ?? null,
    after: change?.after ?? null,
    note: change?.note ?? null,
  });
  if (error) captureError(error, "audit:insert", { action });
}

/** 두 객체에서 값이 달라진 키만 뽑는다 (감사 로그용) */
export function diffFields<T extends Record<string, unknown>>(before: T, after: Partial<T>): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      b[k] = before[k];
      a[k] = after[k];
    }
  }
  return { before: b, after: a };
}
