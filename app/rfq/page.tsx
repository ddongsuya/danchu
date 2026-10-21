import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/** 옛 공개 폼 주소. 로그인 상태면 앱 위자드로, 아니면 공개 요청서로 (가입은 보내기 직전에 한다). */
export default async function RfqRedirect() {
  const s = await getSession();
  redirect(s ? (s.profile.role === "requester" ? "/app/new" : "/") : "/request");
}
