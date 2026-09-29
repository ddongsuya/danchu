import { getSupabaseAdmin } from "./supabase";

/**
 * 공유 속도 제한. Supabase 함수 rate_limit_hit 가 키별 고정 윈도 카운터를 올린다.
 * 서버리스 인스턴스마다 초기화되는 메모리 카운터 대신 모든 인스턴스가 같은 값을 본다.
 * DB 를 쓸 수 없거나 함수가 없으면 인스턴스 메모리로 대신한다 (없는 것보다는 낫다).
 */
const WINDOWS = new Map<string, number[]>();

function memoryHit(key: string, limit: number, windowSec: number): boolean {
  const now = Date.now();
  const arr = (WINDOWS.get(key) ?? []).filter((t) => now - t < windowSec * 1000);
  arr.push(now);
  WINDOWS.set(key, arr);
  if (WINDOWS.size > 5000) WINDOWS.clear();
  return arr.length > limit;
}

/** true 면 제한 초과 → 429 로 응답한다 */
export async function rateLimited(scope: string, id: string, limit: number, windowSec: number): Promise<boolean> {
  const key = `${scope}:${(id || "unknown").toLowerCase().slice(0, 200)}`;
  const sb = getSupabaseAdmin();
  if (!sb) return memoryHit(key, limit, windowSec);
  const { data, error } = await sb.rpc("rate_limit_hit", { p_key: key, p_limit: limit, p_window_seconds: windowSec });
  if (error) {
    console.error("rate_limit_hit", error.message);
    return memoryHit(key, limit, windowSec);
  }
  return data === true;
}

/** 프록시 뒤의 클라이언트 IP. 없으면 "unknown" */
export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for") || "";
  const ip = xf.split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  return /^[0-9a-fA-F.:]+$/.test(ip) ? ip : "unknown";
}

export const TOO_MANY = "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
