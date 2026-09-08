"use client";

import Link from "next/link";
import { useMe } from "@/lib/use-me";

const LABEL = { requester: "내 요청", cro: "CRO 포털", admin: "운영" } as const;

/** 공개 사이트 헤더의 로그인/포털 링크 — 로그인 상태면 역할별 홈으로 */
export function HeaderAuth({ className }: { className?: string }) {
  const { me } = useMe();
  if (!me) return <Link href="/login" className={className}>로그인</Link>;
  return (
    <Link href={me.to} className={className} style={{ fontWeight: 600, color: "var(--ink)" }}>
      {LABEL[me.role]}
    </Link>
  );
}
