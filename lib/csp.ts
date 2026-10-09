/**
 * Content-Security-Policy. next.config 가 빌드 때 만든다.
 * Next 가 심는 인라인 부트스트랩 스크립트 때문에 script-src 에 'unsafe-inline' 이 필요하다 (nonce 를 쓰면 모든 페이지가 동적 렌더가 된다).
 * 그래도 object/base/form-action/frame-ancestors/connect-src 는 잠근다: 외부로 데이터가 새는 길과 클릭재킹을 막는 것이 목적이다.
 */
export function buildCsp(env: Record<string, string | undefined> = process.env): string {
  const supabase = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const connect = ["'self'", supabase || "https://*.supabase.co", "https://*.supabase.co", "https://*.ingest.sentry.io", "https://*.ingest.de.sentry.io", "https://vercel.live", "wss://ws-us3.pusher.com"];
  const script = ["'self'", "'unsafe-inline'", "https://vercel.live"];
  if (env.NODE_ENV !== "production") script.push("'unsafe-eval'"); // Next dev 런타임
  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${[...new Set(connect)].join(" ")}`,
    "frame-src https://vercel.live",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // upgrade-insecure-requests 는 넣지 않는다: 로컬 http 에서 리소스를 https 로 올려 깨지고, 운영은 HSTS 가 이미 잡는다
  ].join("; ");
}
