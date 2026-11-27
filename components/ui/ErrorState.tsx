"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";

export type ErrorCause = "network" | "server" | "timeout";

const COPY: Record<ErrorCause, [string, string]> = {
  network: ["불러오지 못했어요", "인터넷 연결을 확인한 뒤 다시 시도해 주세요."],
  server: ["문제가 생겼어요", "잠시 뒤 다시 시도해 주세요."],
  timeout: ["응답이 늦어요", "30초 동안 응답이 없어 멈췄어요. 다시 시도해 주세요."],
};

/**
 * 불러오지 못한 화면 (시안 v7 6절). 본문 자리에만 그려 주변 메뉴는 그대로 둔다.
 * 원인(연결·서버·시간 초과)을 나눠 말하고 "다시 불러오기" 하나를 준다. onRetry 가 없으면 화면을 새로 불러온다.
 */
export function ErrorState({ cause = "server", title, children, code, onRetry }: { cause?: ErrorCause; title?: string; children?: React.ReactNode; code?: string; onRetry?: () => void | Promise<unknown> }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [t, d] = COPY[cause];
  return (
    <div className="empty ix-state" data-kind="error" role="alert">
      <b>{title ?? t}</b>
      <p>{children ?? d}</p>
      {code && <p className="ix-state__code tnum">오류 번호 {code}</p>}
      <div className="ix-state__act">
        <Button className="b2 bsm" pending={refreshing} onClick={onRetry ?? (() => startRefresh(() => router.refresh()))}>다시 불러오기</Button>
      </div>
    </div>
  );
}
