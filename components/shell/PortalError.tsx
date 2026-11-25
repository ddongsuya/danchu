"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * 로그인 후 화면 본문을 그리다 난 오류 (app/app·cro·admin 의 error.tsx).
 * 이 경계가 layout 안쪽에 있어 왼쪽 메뉴와 위 바는 그대로 남고 본문 자리만 바뀐다.
 * "다시 시도"는 Next 의 retry 로 같은 화면을 다시 그린다.
 */
export function PortalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { where: "portal-error-boundary" } });
  }, [error]);
  return (
    <ErrorState title="화면을 불러오지 못했습니다" code={error.digest} onRetry={retry}>
      저장한 내용은 그대로 있습니다. 다시 시도해도 같으면 support@danchu.kr로 알려 주세요.
    </ErrorState>
  );
}
