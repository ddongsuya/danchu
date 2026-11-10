/**
 * 다른 사이트에서 온 변경 요청인지 (proxy.ts).
 * 브라우저는 POST·PATCH·PUT·DELETE 에 Origin 을 붙인다. 그 Origin 이 우리 호스트가 아니면 막는다.
 * Origin 이 없는 요청(서버끼리, curl)은 쿠키를 훔쳐 쓸 수 없으니 그대로 둔다.
 */
export function crossSiteWrite(method: string, origin: string | null, hosts: (string | null | undefined)[]): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return false;
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return true; // "null" 같은 불투명 출처
  }
  return !hosts.some((h) => !!h && h.toLowerCase() === host);
}

export const CROSS_SITE = "다른 사이트에서 온 요청은 받지 않아요.";
