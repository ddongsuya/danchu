/** PostgREST 필터 값 보조 */

/** ilike 패턴 문자를 이스케이프해 문자열 전체가 정확히(대소문자 무시) 같은 행만 찾는다 */
export function likeExact(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * `.or("a.eq.x,b.ilike.y")` 문자열 안에 넣을 값.
 * 쉼표·괄호·점이 들어 있으면 필터 문법이 깨지므로 큰따옴표로 감싸고 안쪽 따옴표를 이스케이프한다.
 */
export function orValue(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
