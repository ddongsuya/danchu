"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const FAIL = "탈퇴하지 못했어요. 계정은 그대로예요.";

/**
 * 회원 탈퇴 확인 (시안 r-delete). "위 내용을 확인했습니다"를 고르고 계정 이메일을 그대로 적어야 버튼이 열린다.
 * 비밀번호를 쓰는 계정이면 비밀번호도 받는다 (이메일 링크로만 로그인하는 계정은 비워 둔다).
 */
export function DeleteAccountForm({ email, back }: { email: string; back: string }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ready = ok && confirm.trim().toLowerCase() === email.toLowerCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm, password }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(r.status < 500 && d.error ? d.error : FAIL);
      router.replace("/login?notice=deleted");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : FAIL);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} disabled={busy} />
        위 내용을 확인했습니다
      </label>
      <label className="fld">
        <span className="fld__lab">계정 이메일</span>
        <input className="inp" type="email" inputMode="email" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={email} disabled={busy} />
      </label>
      <label className="fld">
        <span className="fld__lab">비밀번호 (비밀번호를 쓰는 계정만)</span>
        <input className="inp" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
      </label>
      {err && <p role="alert" className="note note--err">{err}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Link href={back} className="b2" aria-disabled={busy || undefined}>취소</Link>
        <button type="submit" className={busy ? "b1 b1--danger is-loading" : "b1 b1--danger"} disabled={!ready} aria-busy={busy || undefined}>{busy ? "탈퇴하는 중" : err ? "다시 탈퇴" : "회원 탈퇴"}</button>
      </div>
    </form>
  );
}
