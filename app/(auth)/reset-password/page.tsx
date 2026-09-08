"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorBox, Field, PasswordInput, postJson } from "@/components/AuthBits";

export default function ResetPassword() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ok = pw.length >= 8 && pw === pw2;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    setError("");
    try {
      await postJson("/api/auth/reset", { password: pw });
      const me = await fetch("/api/auth/me").then((r) => r.json()).catch(() => ({ to: "/app" }));
      router.push(me.to || "/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "변경하지 못했습니다.");
      setBusy(false);
    }
  };

  return (
    <div className="auth__card">
      <div>
        <h1 className="auth__title">새 비밀번호</h1>
        <p className="auth__sub">8자 이상으로 정해 주세요. 저장하면 바로 로그인 상태로 이동합니다.</p>
      </div>
      <form className="auth__form" onSubmit={submit}>
        <Field id="pw" label="새 비밀번호" required>
          <PasswordInput id="pw" value={pw} onChange={setPw} />
        </Field>
        <Field id="pw2" label="새 비밀번호 확인" required help={pw2 && pw !== pw2 ? "두 비밀번호가 다릅니다." : undefined}>
          <PasswordInput id="pw2" value={pw2} onChange={setPw2} placeholder="다시 입력" />
        </Field>
        <ErrorBox>{error}</ErrorBox>
        <button type="submit" className="btn--next" disabled={!ok || busy}>
          {busy ? "저장 중…" : "비밀번호 저장"}
        </button>
      </form>
    </div>
  );
}
