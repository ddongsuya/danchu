import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "./env";

/** 공개 키 (브라우저에도 노출되는 값). 세션 쿠키 처리에만 쓰고, 데이터 접근은 service role이 한다. */
export function publicSupabaseEnv(): { url: string; anon: string } | null {
  const url = supabaseUrl();
  const anon = supabaseAnonKey();
  if (!url || !anon) return null;
  return { url, anon };
}

/**
 * 세션(쿠키) 기반 Supabase 클라이언트 — 서버 컴포넌트·라우트 핸들러용.
 * 로그인·로그아웃·현재 사용자 확인에만 쓴다. 표 접근은 getSupabaseAdmin()으로.
 */
export async function createSessionClient() {
  const env = publicSupabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient(env.url, env.anon, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다 — proxy가 세션 갱신을 맡는다
        }
      },
    },
  });
}
