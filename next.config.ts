import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { buildCsp } from "./lib/csp";

// 첨부 업로드는 서버를 거치지 않고 Supabase Storage 서명 URL로 직접 올린다
// (Vercel 함수 요청 본문 한도 4.5MB). 서버 바디 제한을 늘릴 필요가 없다.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: buildCsp() },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

// Sentry 는 DSN 이 있을 때만 빌드에 끼운다. 소스맵 업로드는 SENTRY_AUTH_TOKEN 이 있을 때만 일어난다.
const sentryOn = !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
export default sentryOn
  ? withSentryConfig(nextConfig, { silent: true, widenClientFileUpload: false, sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN } })
  : nextConfig;
