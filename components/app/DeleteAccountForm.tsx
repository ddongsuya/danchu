"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 회원 탈퇴 확인 폼. 계정 이메일을 그대로 적어야 버튼이 열린다.
 * 비밀번호를 쓰는 계정이면 비밀번호도 받는다 (이메일 링크로만 로그인하는 계정은 비워 둔다).
 */
export function DeleteAccountForm({ email }: { email: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ready = confirm.trim().toLowerCase() === email.toLowerCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm, password }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || "탈퇴 처리에 실패했습니다.");
      router.replace("/login?notice=deleted");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "탈퇴 처리에 실패했습니다.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
      <label className="fld">
        <span className="fld__label">확인을 위해 계정 이메일을 입력</span>
        <input className="inp" type="email" inputMode="email" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={email} />
      </label>
      <label className="fld">
        <span className="fld__label">비밀번호 (비밀번호를 쓰는 계정만)</span>
        <input className="inp" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {err && <p role="alert" style={{ fontSize: 13, color: "var(--err)" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="b2 b2--danger" disabled={!ready || busy}>{busy ? "삭제 중" : "계정 삭제"}</button>
        <button type="button" className="b2" disabled={busy} onClick={() => router.back()}>돌아가기</button>
      </div>
    </form>
  );
}
