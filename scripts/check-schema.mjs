#!/usr/bin/env node
/**
 * 운영 DB 판 확인 (배포 순서 검증). npm run check:schema
 * DB 함수 danchu_schema_version() 을 service role 로 불러, 이 코드가 기대하는 번호(REQUIRED) 이상인지 본다.
 * 함수가 없거나(0022 미적용) 번호가 모자라면 종료 코드 1. 코드 배포 전과 배포 뒤에 한 번씩 돌린다 (README "배포 순서").
 *
 * 환경 변수: NEXT_PUBLIC_SUPABASE_URL (또는 SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.
 * 로컬 파일에서 읽으려면: node --env-file=.env.local scripts/check-schema.mjs
 * 주소·키 값은 출력하지 않는다.
 */
import { pathToFileURL } from "node:url";

/** lib/schema-version.ts REQUIRED_SCHEMA_VERSION 과 같아야 한다 (tests/selection-integrity.test.ts 가 확인) */
export const REQUIRED = 28;

/** @param {{ url: string; key: string; required?: number; fetchImpl?: typeof fetch }} o */
export async function checkSchema({ url, key, required = REQUIRED, fetchImpl = fetch }) {
  if (!url || !key) return { ok: false, version: null, message: "NEXT_PUBLIC_SUPABASE_URL(또는 SUPABASE_URL)과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다." };
  let base;
  try {
    base = new URL(url.includes("://") ? url : `https://${url}`).origin;
  } catch {
    return { ok: false, version: null, message: "Supabase 주소 형식이 올바르지 않습니다." };
  }
  let res;
  try {
    res = await fetchImpl(`${base}/rest/v1/rpc/danchu_schema_version`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
    });
  } catch (e) {
    return { ok: false, version: null, message: `DB 에 연결하지 못했습니다: ${e instanceof Error ? e.message : String(e)}` };
  }
  const text = await res.text();
  if (!res.ok) {
    let code = "";
    try {
      code = JSON.parse(text).code ?? "";
    } catch {
      /* 본문이 JSON 이 아님 */
    }
    if (res.status === 404 || code === "PGRST202" || code === "42883") {
      return { ok: false, version: null, message: `danchu_schema_version() 이 없습니다. ${Array.from({ length: Math.max(required - 18, 1) }, (_, k) => String(19 + k).padStart(4, "0")).join(" → ")} 을 순서대로 적용해 주세요.` };
    }
    return { ok: false, version: null, message: `DB 판을 읽지 못했습니다 (HTTP ${res.status}${code ? `, ${code}` : ""}).` };
  }
  const version = Number(text.trim());
  if (!Number.isFinite(version)) return { ok: false, version: null, message: "DB 판 응답을 읽지 못했습니다." };
  if (version < required) return { ok: false, version, message: `DB 판 ${version}. 이 코드는 ${required} 이 필요합니다. 빠진 마이그레이션을 적용해 주세요.` };
  return { ok: true, version, message: `DB 판 ${version} (필요 ${required}). 배포해도 됩니다.` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await checkSchema({
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim(),
    key: (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  });
  (r.ok ? console.log : console.error)(`[check:schema] ${r.message}`);
  process.exit(r.ok ? 0 : 1);
}
