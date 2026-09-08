"use client";

import Link from "next/link";
import { useMe } from "@/lib/use-me";

/**
 * 견적 요청 진입점 — 목적지는 앱 위자드(/app/new).
 * - 로그인한 의뢰자: 바로 /app/new
 * - CRO·운영자: 각자의 홈
 * - 로그인 전: 가입(next=/app/new). 확인 메일 버튼을 누르면 바로 위자드가 열린다
 * 세션 확인이 끝나기 전에 눌러도 /app/new로 가고, 서버(proxy)가 로그인 전이면 가입으로 보낸다.
 */
export const REQUEST_HREF = "/app/new";
export const SIGNUP_HREF = `/signup?next=${encodeURIComponent(REQUEST_HREF)}`;

export function RfqLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const { me, loading } = useMe();
  const href = loading ? REQUEST_HREF : !me ? SIGNUP_HREF : me.role === "requester" ? REQUEST_HREF : me.to;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
