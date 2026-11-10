import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";
import { missingProdEnv } from "@/lib/env";

/**
 * 서버 기동 시 한 번. 필수 환경변수가 비어 있으면 로그로 크게 알린다.
 * 기동을 막지는 않는다(배포 전체가 죽는 것보다 운영자 화면 경고가 낫다). 운영자 홈도 같은 목록을 보여 준다.
 */
export async function register() {
  const missing = missingProdEnv();
  if (missing.length) console.error(`[danchu] 운영 환경변수 누락: ${missing.join(", ")}. 접수·메일·크론이 제대로 동작하지 않습니다.`);

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // 회신 토큰이 든 주소는 밖으로 내보내지 않는다 (lib/sentry-scrub.ts)
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubEvent(crumb),
  });
}

export const onRequestError = Sentry.captureRequestError;
