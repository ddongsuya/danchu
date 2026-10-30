"use client";

import Link from "next/link";
import { useMe } from "@/lib/use-me";

/**
 * 견적 요청 진입점.
 * - 로그인한 의뢰자: 네 갈래 첫 화면 /request (고른 요청서는 /request/new 가 앱 위자드 /app/new 로 넘긴다)
 * - CRO·운영자: 각자의 홈
 * - 로그인 전: 공개 요청서 /request. 가입은 다 쓰고 보내기 직전에 이메일 인증으로 한다 (쓴 내용은 그대로 접수된다)
 * 세션 확인이 끝나기 전에 누르면 /request(누구나 볼 수 있는 첫 화면)로 간다.
 */
export const REQUEST_HREF = "/app/new";
export const GUEST_REQUEST_HREF = "/request";


export function RfqLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const { me, loading } = useMe();
  const href = loading || !me || me.role === "requester" ? GUEST_REQUEST_HREF : me.to;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
