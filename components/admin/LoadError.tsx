"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * 목록·본문 자리에만 그리는 불러오기 실패 (시안 검토판 LIST err · PAGE err). 제목 줄·탭·검색어는 그대로 두고 "다시 불러오기" 하나를 준다.
 * components/ui/ErrorState 와 같은 모양(.ix-state)이고, 버튼 이름만 시안대로 "다시 불러오기"다.
 */
export function LoadError({ title }: { title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="empty ix-state" data-kind="error" role="alert">
      <b>{title}</b>
      <div className="ix-state__act">
        <Button className="b2 bsm" pending={pending} onClick={() => start(() => router.refresh())}>다시 불러오기</Button>
      </div>
    </div>
  );
}
