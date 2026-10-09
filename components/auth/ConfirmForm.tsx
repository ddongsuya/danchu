"use client";
import { useEffect, useRef, useState } from "react";

/**
 * 토큰을 POST 로 보내는 폼. 마운트 직후 한 번 자동 제출한다 (사람의 브라우저는 JS 를 실행하지만
 * 메일 링크 스캐너 대부분은 GET 만 한다). 자동 제출이 막히면 버튼이 남는다.
 */
export function ConfirmForm({ tokenHash, type, next }: { tokenHash: string; type: string; next: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setBusy(true);
      ref.current?.requestSubmit();
    }, 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <form ref={ref} method="post" action="/api/auth/confirm" className="auth__form" onSubmit={() => setBusy(true)}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      {next && <input type="hidden" name="next" value={next} />}
      <button type="submit" className="btn--next" disabled={busy}>{busy ? "확인 중…" : "계속하기"}</button>
    </form>
  );
}
