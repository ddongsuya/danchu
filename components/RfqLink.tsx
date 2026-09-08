"use client";

import Link from "next/link";
import { useMe } from "@/lib/use-me";

/**
 * 견적 요청 진입점.
 * 로그인한 의뢰자는 계정 정보가 채워지는 앱 위자드(/app/new)로, 그 외에는 공개 웹 폼(/rfq)으로.
 * 서버 렌더는 /rfq로 나가고, 마운트 후 세션을 확인해 href만 바꾼다.
 */
export function RfqLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const { me } = useMe();
  const href = me?.role === "requester" ? "/app/new" : "/rfq";
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
