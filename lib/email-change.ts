import { createHash, randomBytes } from "node:crypto";

/** 이메일 변경 확인 링크. 토큰 원문은 메일로만 가고 DB 에는 해시만 남는다 */
export const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000;

export function newEmailChangeToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashEmailChangeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 저장된 해시·만료·대기 주소가 링크의 토큰과 맞는지 */
export function emailChangeValid(p: { pending_email: string | null; pending_email_hash: string | null; pending_email_expires_at: string | null }, token: string, now = Date.now()): boolean {
  if (!p.pending_email || !p.pending_email_hash || !p.pending_email_expires_at) return false;
  if (new Date(p.pending_email_expires_at).getTime() < now) return false;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return false;
  return hashEmailChangeToken(token) === p.pending_email_hash;
}
