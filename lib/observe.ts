import * as Sentry from "@sentry/nextjs";

/**
 * 서버 오류를 한 곳으로 모은다. SENTRY_DSN 이 있으면 Sentry 로, 없으면 콘솔로만.
 * 개인정보는 넣지 않는다: 이메일·본문 대신 요청 번호·초대 id 같은 식별자만 context 로 준다.
 */
export function captureError(e: unknown, where: string, context?: Record<string, string | number | boolean | null | undefined>): void {
  console.error(`[danchu] ${where}`, e instanceof Error ? e.message : e, context ?? "");
  try {
    Sentry.captureException(e, { tags: { where }, extra: context });
  } catch {
    /* SDK 미초기화 */
  }
}

export function sentryEnabled(): boolean {
  return !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/** 로그용 이메일 마스킹: ab***@domain */
export function maskEmail(s: string): string {
  const at = s.indexOf("@");
  if (at <= 0) return "***";
  return `${s.slice(0, Math.min(2, at))}***${s.slice(at)}`;
}
