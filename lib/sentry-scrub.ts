/**
 * Sentry 로 나가는 기록에서 회신 토큰을 지운다.
 * 로그인 없는 회신 링크(/q/{token}, /api/quote/{token}, ?token=)의 토큰은 그 자체가 열쇠라서 밖의 저장소에 남기지 않는다.
 * 서버(instrumentation.ts)와 브라우저(instrumentation-client.ts)의 beforeSend·beforeSendTransaction 에서 쓴다.
 */
const PATH_TOKEN = /(\/(?:q|api\/quote)\/)[^/?#\s"']+/g;
const QUERY_TOKEN = /([?&]token=)[^&#\s"']+/gi;

export function scrubTokens(s: string): string {
  return s.replace(PATH_TOKEN, "$1[token]").replace(QUERY_TOKEN, "$1[token]");
}

/** 이벤트 안의 모든 문자열을 훑는다 (URL, 트랜잭션 이름, breadcrumb, 스팬 설명). 깊이 8까지 */
export function scrubEvent<T>(event: T): T {
  const walk = (v: unknown, depth: number): unknown => {
    if (typeof v === "string") return scrubTokens(v);
    if (depth > 8 || !v || typeof v !== "object") return v;
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) v[i] = walk(v[i], depth + 1);
      return v;
    }
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) o[k] = walk(o[k], depth + 1);
    return v;
  };
  try {
    return walk(event, 0) as T;
  } catch {
    return event;
  }
}
