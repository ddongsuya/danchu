import { getSupabaseAdmin, type Admin } from "./supabase";

/**
 * 이 코드가 기대하는 DB 마이그레이션 번호. supabase/migrations 의 마지막 파일 번호와 같고,
 * DB 함수 danchu_schema_version() 이 돌려주는 값과 같아야 한다 (0022 부터).
 * 새 마이그레이션을 추가하면 그 파일에서 danchu_schema_version() 을 새 번호로 바꾸고 이 값도 올린다.
 * scripts/check-schema.mjs 의 REQUIRED 도 같은 값이다 (tests/selection-integrity.test.ts 가 셋이 같은지 본다).
 */
export const REQUIRED_SCHEMA_VERSION = 27;

export type SchemaStatus =
  | { ok: true; version: number; required: number }
  | { ok: false; version: number | null; required: number; reason: "no_db" | "missing" | "behind" | "error"; message: string };

/** DB 의 스키마 판을 읽는다. 함수가 없으면(0022 미적용) missing, 번호가 모자라면 behind */
export async function readSchemaStatus(sb: Admin | null = getSupabaseAdmin()): Promise<SchemaStatus> {
  const required = REQUIRED_SCHEMA_VERSION;
  if (!sb) return { ok: false, version: null, required, reason: "no_db", message: "Supabase 환경변수가 없어 DB 판을 확인하지 못했습니다." };
  const { data, error } = await sb.rpc("danchu_schema_version");
  if (error) {
    // PostgREST 는 없는 함수를 PGRST202, Postgres 는 42883 으로 알린다. 오류 코드로만 나눈다
    // (권한 오류처럼 메시지에 함수 이름이 들어간 다른 오류를 "미적용"으로 잘못 안내하지 않게)
    const missing = error.code === "PGRST202" || error.code === "42883";
    return missing
      ? { ok: false, version: null, required, reason: "missing", message: `DB 에 마이그레이션 0019~00${required} 이 적용되지 않았습니다 (danchu_schema_version 없음).` }
      : { ok: false, version: null, required, reason: "error", message: `DB 판을 확인하지 못했습니다: ${error.message}` };
  }
  const version = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(version) || version < required) {
    return { ok: false, version: Number.isFinite(version) ? version : null, required, reason: "behind", message: `DB 마이그레이션이 ${version} 까지만 적용되었습니다. 이 코드는 ${required} 이 필요합니다.` };
  }
  return { ok: true, version, required };
}

export class SchemaNotReadyError extends Error {
  constructor(readonly status: Extract<SchemaStatus, { ok: false }>) {
    super(`[danchu] ${status.message} 배포를 멈춥니다. README "배포 순서" 를 따라 마이그레이션을 적용한 뒤 다시 시도해 주세요.`);
    this.name = "SchemaNotReadyError";
  }
}

// 한 번 맞으면 이 서버 인스턴스에서는 다시 묻지 않는다 (마이그레이션은 앞으로만 간다). 틀리면 매번 다시 묻는다
let confirmed = false;

/** 배포처럼 "조용히 0건"이 되면 안 되는 작업 앞에서 부른다. DB 판이 모자라면 SchemaNotReadyError 를 던진다 */
export async function assertSchemaReady(sb: Admin | null = getSupabaseAdmin()): Promise<void> {
  if (confirmed) return;
  const s = await readSchemaStatus(sb);
  if (!s.ok) throw new SchemaNotReadyError(s);
  confirmed = true;
}

/** 테스트용: 확인 기억을 지운다 */
export function resetSchemaCheck(): void {
  confirmed = false;
}
