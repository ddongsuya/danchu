import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceKey, supabaseUrl } from "./env";
import type { Database } from "./db-types";

export type Admin = SupabaseClient<Database>;

/**
 * 서버 전용 Supabase 클라이언트 (service role).
 * 환경변수가 없으면 null — API는 로컬 fallback으로 동작한다.
 */
export function getSupabaseAdmin(): Admin | null {
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
