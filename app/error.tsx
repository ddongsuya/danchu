"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

/**
 * 화면을 그리다 난 오류. 이 파일이 없으면 Next 의 영어 기본 화면이 나온다.
 * 로그인 후 화면에서는 왼쪽 메뉴(layout)가 그대로 남고 본문 자리만 이 화면으로 바뀐다.
 */
export default function ErrorScreen({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { where: "error-boundary" } });
  }, [error]);

  return (
    <main className="err-screen" role="alert">
      <h1>화면을 불러오지 못했어요</h1>
      <p>저장한 내용은 그대로 있어요. 다시 시도해도 같으면 support@danchu.kr로 알려 주세요.</p>
      {error.digest && <p className="err-screen__code">오류 번호 {error.digest}</p>}
      <div className="err-screen__acts">
        <button type="button" className="err-screen__btn" onClick={() => retry()}>다시 시도</button>
        <Link className="err-screen__link" href="/">홈으로</Link>
      </div>
    </main>
  );
}
