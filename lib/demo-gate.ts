/**
 * 데모 앱(/app) 접근 제한.
 * APP_DEMO_PASSWORD 가 설정되면 /app 화면군은 비밀번호를 입력한 브라우저에만 열린다.
 * CRO 토큰 링크(/app/cro/r/*)와 로그인 화면은 예외.
 * Edge(proxy)와 Node(route) 양쪽에서 쓰므로 Web Crypto만 사용한다.
 */
export const DEMO_COOKIE = "dc_demo";

export function demoPassword(): string {
  return process.env.APP_DEMO_PASSWORD || "";
}

export async function demoToken(password: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`danchu-demo:${password}`));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 비밀번호 없이 열어 두는 경로 */
export function isOpenPath(pathname: string): boolean {
  return pathname === "/app/login" || pathname.startsWith("/app/cro/r/");
}
