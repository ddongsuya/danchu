"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 견적 요청 진입점.
 * 폰(터치 + 좁은 화면)에서는 앱 위자드(/app/new)로, 그 외에는 웹 폼(/rfq)으로 보낸다.
 * 서버 렌더는 /rfq로 나가고, 마운트 후 기기 판정에 따라 href만 바꾼다.
 */
export function RfqLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const [href, setHref] = useState("/rfq");
  useEffect(() => {
    if (matchMedia("(pointer: coarse) and (max-width: 900px)").matches) setHref("/app/new");
  }, []);
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
