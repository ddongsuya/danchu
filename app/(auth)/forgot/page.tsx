"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorBox, Field, TextInput, emailError, mmss, postJson } from "@/components/AuthBits";

/** 다시 받기까지 기다리는 초 (시안 l-forgot~sent "다시 받기 00:59"). 서버도 15분에 3번까지만 보낸다 (api/auth/forgot) */
const RESEND_WAIT_S = 60;

/**
 * 비밀번호 찾기 (시안 검토판 l-forgot). 이메일 하나를 받아 재설정 메일을 보낸다.
 * 빈칸·형식 오류는 칸 바로 아래. 보낸 뒤에는 보낸 주소와 "다시 받기" 대기 시간을 보여 준다.
 * 가입되지 않은 주소여도 같은 화면이다 (서버가 가입 여부를 알려 주지 않는다).
 */
export default function Forgot() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErr, setFieldErr] = useState("");
  const [sent, setSent] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/auth/forgot", { email });
      setSent(true);
      setWait(RESEND_WAIT_S - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "메일을 보내지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const bad = emailError(email);
    setFieldErr(bad);
    if (bad) { document.getElementById("email")?.focus(); return; }
    await send();
  };

  if (sent) {
    return (
      <div className="auth__card">
        <div>
          <h1 className="auth__title">비밀번호 재설정 메일을 보냈어요</h1>
          <p className="auth__sub">{email}로 보냈어요.</p>
        </div>
        <ErrorBox>{error}</ErrorBox>
        <button type="button" className="btn--ghost" disabled={busy || wait > 0} aria-busy={busy || undefined} onClick={send}>
          {busy ? "보내는 중" : wait > 0 ? `다시 받기 ${mmss(wait)}` : "다시 받기"}
        </button>
        <div className="auth__links">
          <Link href="/login">로그인</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth__card">
      <div>
        <h1 className="auth__title">비밀번호 찾기</h1>
      </div>
      <form className="auth__form" onSubmit={submit} noValidate>
        <Field id="email" label="이메일" required error={fieldErr}>
          <TextInput id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" aria-invalid={!!fieldErr || undefined} autoFocus />
        </Field>
        <ErrorBox>{error}</ErrorBox>
        <button type="submit" className="btn--next" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "보내는 중" : "메일 보내기"}
        </button>
      </form>
      <div className="auth__links">
        <Link href="/login">로그인</Link>
      </div>
    </div>
  );
}
