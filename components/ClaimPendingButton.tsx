"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** 맡긴 요청서를 접수한다 (/api/rfq/pending/claim). 화면을 여는 것만으로는 접수하지 않는다 */
export function ClaimPendingButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/rfq/pending/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; rfqNo?: string };
      if (!r.ok || !d.rfqNo) throw new Error(d.error || "접수하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      router.replace(`/app/new/done?no=${encodeURIComponent(d.rfqNo)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "접수하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 12 }}>
      {err && <p className="note note--err" role="alert">{err}</p>}
      <button type="button" className="b1" disabled={busy} aria-busy={busy} onClick={send}>{busy ? "보내는 중…" : "이 요청서 보내기"}</button>
    </div>
  );
}
