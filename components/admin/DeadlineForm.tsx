"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** 회신 기한 변경. 기한이 지났는데 회신이 없을 때 여기서 늘린 뒤 재배포한다 */
export function DeadlineForm({ no, current, min }: { no: string; current: string | null; min: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [replyBy, setReplyBy] = useState(current && current >= min ? current : min);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    if (busy || !replyBy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/rfqs/${no}/deadline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replyBy }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) throw new Error(d.error || "바꾸지 못했습니다.");
      setMsg({ ok: true, text: d.message || "바꿨습니다." });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "바꾸지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <button type="button" className="btxt" style={{ padding: 0, fontSize: 13 }} onClick={() => setOpen(true)}>회신 기한 변경</button>
        {msg && <span style={{ fontSize: 12, color: msg.ok ? "var(--ok)" : "var(--err)" }}>{msg.text}</span>}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input className="inp" type="date" min={min} value={replyBy} onChange={(e) => setReplyBy(e.target.value)} style={{ height: 32, fontSize: 13 }} aria-label="새 회신 기한" />
      <button type="button" className="b1 bsm" disabled={busy || !replyBy || replyBy < min} onClick={save}>{busy ? "…" : "바꾸기"}</button>
      <button type="button" className="b2 bsm" disabled={busy} onClick={() => setOpen(false)}>취소</button>
      {msg && !msg.ok && <span style={{ fontSize: 12, color: "var(--err)" }}>{msg.text}</span>}
    </span>
  );
}
