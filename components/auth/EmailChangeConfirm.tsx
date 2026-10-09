"use client";
import { useEffect, useRef, useState } from "react";

/** 토큰을 POST 로 보내는 폼. 마운트 직후 한 번 자동 제출한다 */
export function EmailChangeConfirm({ token }: { token: string }) {
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
    <form ref={ref} method="post" action="/api/profile/email/confirm" className="auth__form" onSubmit={() => setBusy(true)}>
      <input type="hidden" name="token" value={token} />
      <button type="submit" className="btn--next" disabled={busy}>{busy ? "확인 중…" : "이메일 변경 확인"}</button>
    </form>
  );
}
