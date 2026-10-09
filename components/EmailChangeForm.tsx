"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EMAIL_RE } from "@/lib/auth-links";

/** 로그인 이메일 변경. 새 주소로 간 확인 링크를 누르기 전까지는 바뀌지 않는다 */
export function EmailChangeForm({ current, pending }: { current: string; pending: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const valid = EMAIL_RE.test(email.trim()) && email.trim().toLowerCase() !== current.toLowerCase();

  const call = async (method: "POST" | "DELETE") => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile/email", { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify({ email: email.trim() }) : undefined });
      const d = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(d.error || "처리하지 못했습니다.");
      setMsg({ ok: true, text: d.message || (method === "DELETE" ? "변경 요청을 취소했습니다." : "처리했습니다.") });
      setOpen(false);
      setEmail("");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "처리하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{current}</div>
          {pending && <div style={{ fontSize: 12, color: "var(--muted)" }}>{pending} 로 변경 대기 중 · 새 주소의 메일에서 확인해 주세요</div>}
        </div>
        {!open && (
          <span style={{ display: "inline-flex", gap: 10 }}>
            {pending && <button type="button" className="btxt" style={{ fontSize: 13 }} disabled={busy} onClick={() => call("DELETE")}>요청 취소</button>}
            <button type="button" className="btxt" style={{ fontSize: 13 }} onClick={() => setOpen(true)}>{pending ? "다시 보내기" : "이메일 변경"}</button>
          </span>
        )}
      </div>
      {open && (
        <form className="stack" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (valid) call("POST"); }}>
          <div className="fld">
            <label className="fld__lab" htmlFor="new-email">새 이메일</label>
            <input id="new-email" className="inp" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="fld__help">새 주소로 확인 링크를 보냅니다. 링크를 누르기 전까지는 지금 주소로 로그인합니다.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="b1 bsm" disabled={!valid || busy}>{busy ? "보내는 중…" : "확인 메일 보내기"}</button>
            <button type="button" className="b2 bsm" disabled={busy} onClick={() => { setOpen(false); setEmail(""); }}>취소</button>
          </div>
        </form>
      )}
      {msg && <p className={`note ${msg.ok ? "note--tint" : "note--err"}`} role="status" style={{ margin: 0 }}>{msg.text}</p>}
    </div>
  );
}
