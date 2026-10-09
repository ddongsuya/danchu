"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** 운영자가 계정을 삭제한다. 두 번 눌러야 실행된다 (window.confirm 대신 인라인 확인) */
export function DeleteUserButton({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const [arm, setArm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!arm) return <button type="button" className="btxt" style={{ fontSize: 12, color: "var(--err)" }} onClick={() => setArm(true)}>삭제</button>;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
      <span>{email} 계정을 삭제합니다. 요청서는 익명화되고 되돌릴 수 없습니다.</span>
      <span style={{ display: "inline-flex", gap: 6 }}>
        <button
          type="button"
          className="b2 b2--danger bsm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr("");
            const r = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
            const d = (await r.json().catch(() => ({}))) as { error?: string };
            if (!r.ok) { setErr(d.error || "삭제 실패"); setBusy(false); return; }
            router.refresh();
          }}
        >
          {busy ? "…" : "삭제 확정"}
        </button>
        <button type="button" className="b2 bsm" disabled={busy} onClick={() => setArm(false)}>취소</button>
      </span>
      {err && <span style={{ color: "var(--err)" }}>{err}</span>}
    </span>
  );
}
