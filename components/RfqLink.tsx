"use client";

import Link from "next/link";
import { useMe } from "@/lib/use-me";

/**
 * 견적 요청 진입점.
 * - 로그인한 의뢰자: 앱 위자드 /app/new
 * - CRO·운영자: 각자의 홈
 * - 로그인 전: 공개 요청서 /request. 가입은 다 쓰고 보내기 직전에 이메일 인증으로 한다 (쓴 내용은 그대로 접수된다)
 * 세션 확인이 끝나기 전에 눌러도 /app/new로 가고, 서버(proxy)가 로그인 전이면 /request로 보낸다.
 */
export const REQUEST_HREF = "/app/new";
export const GUEST_REQUEST_HREF = "/request";


export function RfqLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const { me, loading } = useMe();
  const href = loading ? REQUEST_HREF : !me ? GUEST_REQUEST_HREF : me.role === "requester" ? REQUEST_HREF : me.to;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
