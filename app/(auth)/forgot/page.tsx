"use client";

import { useState } from "react";
import Link from "next/link";
import { Done, ErrorBox, Field, TextInput, postJson } from "@/components/AuthBits";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !email) return;
    setBusy(true);
    setError("");
    try {
      await postJson("/api/auth/forgot", { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "보내지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth__card">
      {sent ? (
        <Done title="재설정 메일을 보냈습니다">
          <p>
            <b>{email}</b>이 가입된 주소라면 비밀번호 재설정 링크가 도착합니다. 링크는 1시간 동안 유효합니다.
          </p>
          <Link href="/login" className="btn--ghost" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>로그인으로</Link>
        </Done>
      ) : (
        <>
          <div>
            <h1 className="auth__title">비밀번호 재설정</h1>
            <p className="auth__sub">가입한 이메일을 입력하면 새 비밀번호를 정할 수 있는 링크를 보냅니다.</p>
          </div>
          <form className="auth__form" onSubmit={submit}>
            <Field id="email" label="이메일" required>
              <TextInput id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoFocus />
            </Field>
            <ErrorBox>{error}</ErrorBox>
            <button type="submit" className="btn--next" disabled={busy || !email}>
              {busy ? "보내는 중…" : "재설정 링크 받기"}
            </button>
          </form>
          <div className="auth__links">
            <Link href="/login">로그인으로 돌아가기</Link>
          </div>
        </>
      )}
    </div>
  );
}
