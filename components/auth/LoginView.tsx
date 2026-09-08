"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Done, ErrorBox, Field, PasswordInput, TextInput, postJson } from "@/components/AuthBits";

const ERRORS: Record<string, string> = {
  link: "링크가 올바르지 않습니다. 메일의 버튼을 다시 눌러 주세요.",
  expired: "링크가 만료되었거나 이미 사용되었습니다. 아래에서 다시 요청해 주세요.",
  config: "로그인 기능이 아직 설정되지 않았습니다. 운영자에게 문의해 주세요.",
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
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(ERRORS[sp.get("error") || ""] || "");
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
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
      setError(err instanceof Error ? err.message : "로그인하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="auth__card">
        <Done title="로그인 링크를 보냈습니다">
          <p>
            <b>{email}</b>의 받은 편지함을 확인해 주세요. 링크는 1시간 동안 유효합니다.
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
        <p className="auth__sub">{next === "/app/new" ? "로그인하면 바로 견적 요청 화면이 열립니다." : "견적 요청 진행 상황과 비교표를 확인하세요."}</p>
      </div>

      <div className="auth__tabs" role="tablist">
        <button type="button" role="tab" aria-pressed={mode === "password"} onClick={() => setMode("password")}>비밀번호</button>
        <button type="button" role="tab" aria-pressed={mode === "magic"} onClick={() => setMode("magic")}>이메일 링크</button>
      </div>

      <form className="auth__form" onSubmit={submit}>
        <Field id="email" label="이메일" required>
          <TextInput id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoFocus />
        </Field>
        {mode === "password" ? (
          <Field id="pw" label="비밀번호" required>
            <PasswordInput id="pw" value={pw} onChange={setPw} placeholder="비밀번호" autoComplete="current-password" />
          </Field>
        ) : (
          <p className="field__help" style={{ margin: 0 }}>비밀번호 없이, 이메일로 받은 링크를 눌러 로그인합니다.</p>
        )}
        <ErrorBox>{error}</ErrorBox>
        <button type="submit" className="btn--next" disabled={busy || !email || (mode === "password" && !pw)}>
          {busy ? "확인 중…" : mode === "password" ? "로그인" : "로그인 링크 받기"}
        </button>
        {mode === "password" && (
          <div className="auth__row">
            <span />
            <Link href="/forgot">비밀번호를 잊으셨나요?</Link>
          </div>
        )}
      </form>

      <div className="auth__links">
        <span>
          처음이신가요? <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}>의뢰자 가입</Link>
        </span>
        <span>
          시험기관(CRO)이라면 <Link href="/signup/cro">CRO 가입 신청</Link>
        </span>
      </div>
    </div>
  );
}
