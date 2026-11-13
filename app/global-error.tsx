"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/** 최상위 layout 까지 그리지 못했을 때의 마지막 화면. 전역 CSS 가 없을 수 있어 스타일을 직접 적는다 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { where: "global-error" } });
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#fbfbf9", color: "#1b1b19", fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" }}>
        <main role="alert" style={{ maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>화면을 불러오지 못했어요</h1>
          <p style={{ margin: "12px 0 0", lineHeight: 1.6, color: "#33332f" }}>다시 시도해도 같으면 support@danchu.kr로 알려 주세요.</p>
          {error.digest && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#61615c" }}>오류 번호 {error.digest}</p>}
          <button type="button" onClick={() => retry()} style={{ marginTop: 20, height: 44, padding: "0 20px", border: 0, borderRadius: 999, background: "#1b1b19", color: "#fbfbf9", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>다시 시도</button>
        </main>
      </body>
    </html>
  );
}
