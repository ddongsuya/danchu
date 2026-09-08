import { redirect } from "next/navigation";
import { getSession, homeOf } from "./auth";
import { safeNext } from "./auth-links";

/** 로그인·가입 화면: 이미 로그인한 사용자는 next(있으면) 또는 역할별 홈으로 보낸다 */
export async function redirectIfLoggedIn(next?: string | null) {
  const s = await getSession();
  if (!s) return;
  const n = safeNext(next);
  redirect(n && (s.profile.role === "requester" || !n.startsWith("/app")) ? n : homeOf(s.profile.role));
}
