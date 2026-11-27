"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Done, ErrorBox, Field, PasswordInput, TextInput, emailError, errStatus, postJson } from "@/components/AuthBits";

const ERRORS: Record<string, string> = {
  link: "링크를 확인하지 못했어요. 메일의 버튼을 다시 눌러주세요.",
  expired: "링크가 만료됐거나 이미 쓰였어요. 아래에서 새 링크를 받아 주세요.",
  config: "지금은 로그인을 쓸 수 없어요. support@danchu.kr로 알려주세요.",
};

const NOTICES: Record<string, string> = {
  deleted: "탈퇴가 완료됐어요.",
};

export function LoginView() {
  return (
    <Suspense fallback={<div className="auth__card" />}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "";
  // 메일 속 링크(요청·비교 보고서)로 들어온 사람. 로그인 없이 요청한 의뢰자는 비밀번호가 없으니 이메일 링크 하나로 이어 준다 (2026-11-02 가상 35명 테스트 1번)
  const fromMail = /^\/app\/r\//.test(next);
  // 시안 l-login: 비밀번호가 먼저. 메일 링크로 들어온 사람만 이메일 링크가 먼저
  const [mode, setMode] = useState<"password" | "magic">(fromMail ? "magic" : "password");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(ERRORS[sp.get("error") || ""] || "");
  const [sent, setSent] = useState(false);
  const [errs, setErrs] = useState<{ email?: string; pw?: string }>({});
  const [locked, setLocked] = useState("");
  const notice = NOTICES[sp.get("notice") || ""] || "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const found = { email: emailError(email) || undefined, pw: mode === "password" && !pw ? "비밀번호를 입력해 주세요." : undefined };
    setErrs(found);
    setLocked("");
    if (found.email || found.pw) { document.getElementById(found.email ? "email" : "pw")?.focus(); return; }
    setBusy(true);
    setError("");
    try {
      if (mode === "password") {
        const d = await postJson<{ to: string }>("/api/auth/login", { email, password: pw, next });
        router.push(d.to);
        return;
      }
      await postJson("/api/auth/magic", { email, next });
      setSent(true);
    } catch (err) {
      const text = err instanceof Error ? err.message : "로그인하지 못했어요.";
      const st = errStatus(err);
      // 틀린 비밀번호는 비밀번호 칸 아래, 여러 번 틀려 막히면 위쪽 띠 (시안 l-login~wrong · ~locked)
      if (st === 429) setLocked(text);
      else if (st === 401 && mode === "password") setErrs({ pw: text });
      else setError(text);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="auth__card">
        <Done title="로그인 링크를 보냈어요">
          <p>
            <b>{email}</b>의 받은 편지함을 확인해 주세요. 링크는 1시간 동안 쓸 수 있어요.{next ? " 누르면 보던 화면으로 바로 이어져요." : ""}
          </p>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>메일이 오지 않으면 스팸함을 확인하거나, 가입한 주소가 맞는지 확인해 주세요. 아직 계정이 없다면 <Link href="/signup">가입</Link>부터 해 주세요.</p>
          <button type="button" className="btn--ghost" onClick={() => setSent(false)}>다른 이메일로 받기</button>
        </Done>
      </div>
    );
  }

  return (
    <div className="auth__card">
      <div>
        <h1 className="auth__title">로그인</h1>
        {next === "/app/new" ? <p className="auth__sub">로그인하면 쓰던 요청서로 바로 이어져요.</p> : fromMail ? <p className="auth__sub">로그인하면 메일에서 누른 화면이 열려요.</p> : null}
      </div>

      <div className="auth__tabs" role="group" aria-label="로그인 방법">
        <button type="button" aria-pressed={mode === "password"} onClick={() => { setMode("password"); setErrs({}); }}>비밀번호</button>
        <button type="button" aria-pressed={mode === "magic"} onClick={() => { setMode("magic"); setErrs({}); }}>이메일 링크</button>
      </div>

      {locked && <div className="auth__ban" role="alert"><span>{locked}</span><Link href="/forgot">비밀번호 찾기</Link></div>}

      <form className="auth__form" onSubmit={submit} noValidate>
        <Field id="email" label="이메일" required error={errs.email}>
          <TextInput id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" aria-invalid={!!errs.email || undefined} autoFocus />
        </Field>
        {mode === "password" ? (
          <Field id="pw" label="비밀번호" required error={errs.pw}>
            <PasswordInput id="pw" value={pw} onChange={setPw} placeholder="비밀번호" autoComplete="current-password" />
          </Field>
        ) : (
          <p className="field__help" style={{ margin: 0 }}>메일로 받은 링크로 로그인해요.</p>
        )}
        {notice && <p className="field__help" role="status" style={{ margin: 0 }}>{notice}</p>}
        <ErrorBox>{error}</ErrorBox>
        <button type="submit" className="btn--next" disabled={busy} aria-busy={busy || undefined}>
          {busy ? (mode === "password" ? "로그인하는 중" : "보내는 중") : mode === "password" ? "로그인" : "로그인 링크 받기"}
        </button>
      </form>

      <div className="auth__links">
        <Link href="/forgot">비밀번호 찾기</Link>
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}>의뢰자 가입</Link>
        <Link href="/signup/cro">기관으로 참여 신청</Link>
      </div>
    </div>
  );
}
