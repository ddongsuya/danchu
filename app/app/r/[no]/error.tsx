"use client";

import { ErrorState } from "@/components/ui/ErrorState";

/** 요청 진행을 그리다 난 오류: 본문 자리에만 오류와 다시 불러오기 (시안 r-req "불러오기 실패") */
export default function RequestError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState title="진행 상황을 불러오지 못했어요" code={error.digest} onRetry={retry} />;
}
