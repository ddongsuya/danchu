import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/** 옛 공개 폼 주소 — 이제 견적 요청은 계정에서 한다. 로그인 상태면 위자드로, 아니면 가입으로. */
export default async function RfqRedirect() {
  const s = await getSession();
  redirect(s ? (s.profile.role === "requester" ? "/app/new" : "/") : "/signup?next=%2Fapp%2Fnew");
}
