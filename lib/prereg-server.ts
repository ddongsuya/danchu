import { cookies } from "next/headers";
import type { Session } from "./auth";
import { DEMO_PREREG_COOKIE } from "./demo";
import { inPrereg } from "./prereg";

/** 이 세션이 사전예약 대기 화면을 보는가. 미리보기(lib/demo.ts)는 /demo?…&prereg=1 로 켠 경우에만 */
export async function sessionInPrereg(s: Session): Promise<boolean> {
  if (s.demo) return s.profile.role !== "admin" && (await cookies()).get(DEMO_PREREG_COOKIE)?.value === "1";
  return inPrereg({ role: s.profile.role, email: s.email, created_at: s.profile.created_at ?? null });
}
