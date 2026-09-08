"use client";

import Link from "next/link";
import { useMe } from "@/lib/use-me";

/**
 * 견적 요청 진입점 — 항상 앱 위자드(/app/new)로 간다.
 * 로그인 전이면 가입 화면을 거치고(next=/app/new), 확인 메일 버튼을 누르면 바로 위자드가 열린다.
 * CRO·운영자 계정은 각자의 홈으로.
 */
export const REQUEST_HREF = "/app/new";
export const SIGNUP_HREF = `/signup?next=${encodeURIComponent(REQUEST_HREF)}`;

export function RfqLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const { me } = useMe();
  const href = !me ? SIGNUP_HREF : me.role === "requester" ? REQUEST_HREF : me.to;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
