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
