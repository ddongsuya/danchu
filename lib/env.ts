/**
 * Supabase 프로젝트 기본 주소.
 * 대시보드에서 "https://xxx.supabase.co/rest/v1" 같은 REST 주소를 복사해 넣어도
 * 프로토콜+호스트만 남겨 항상 올바른 기본 주소가 되게 한다.
 */
export function supabaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

export function supabaseAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
}

export function supabaseServiceKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && env.DANCHU_DESIGN_PREVIEW !== "1";
}

/**
 * 운영 배포에 반드시 있어야 하는 환경변수.
 * 하나라도 없으면 "성공처럼 보이는 실패"가 생긴다: 접수가 임시 번호로 200을 돌려주거나,
 * 메일이 Resend 기본 발신자로만 나가거나, 크론이 조용히 401을 받는다.
 * 대체 이름이 있는 항목은 둘 중 하나만 있으면 된다.
 */
export const PROD_REQUIRED_ENV: readonly (readonly string[])[] = [
  ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
  ["SUPABASE_SERVICE_ROLE_KEY"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  ["RESEND_API_KEY"],
  ["RESEND_FROM"],
  ["ADMIN_EMAIL"],
  ["CRON_SECRET"],
  ["NEXT_PUBLIC_SITE_URL", "SITE_URL"],
];

/** 비어 있는 필수 변수 이름 목록. 운영이 아니면 빈 배열(로컬은 fallback으로 돈다). */
export function missingProdEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  if (!isProduction(env)) return [];
  return PROD_REQUIRED_ENV.filter((names) => !names.some((n) => (env[n] || "").trim())).map((names) => names[0]);
}
