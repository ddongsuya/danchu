"use client";

import { ErrorState } from "@/components/ui/ErrorState";

/** 비교표를 그리다 난 오류: 본문 자리에만 오류와 다시 불러오기 (시안 r-compare "불러오기 실패") */
export default function CompareError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState title="비교표를 불러오지 못했어요" code={error.digest} onRetry={retry} />;
}
