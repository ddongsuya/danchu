"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** 열린 초대 1건의 운영 조치: 배포 메일 재발송, 초대 취소 */
export function InviteActions({ inviteId, croName }: { inviteId: string; croName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const call = async (key: "resend" | "cancel") => {
    if (busy) return;
    let reason = "";
    if (key === "cancel") {
      const r = window.prompt(`${croName} 초대를 취소합니다. 회신 링크가 닫히고 청구에서 빠집니다.\n사유 (선택):`);
      if (r === null) return;
      reason = r.trim();
    }
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/invites/${inviteId}/${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(d.error || "처리하지 못했습니다.");
      setMsg({ ok: true, text: d.message || "처리했습니다." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "처리하지 못했습니다." });
    } finally {
      setBusy("");
    }
  };

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
      <button type="button" className="btxt" style={{ fontSize: 12 }} disabled={!!busy} onClick={() => call("resend")}>{busy === "resend" ? "보내는 중…" : "메일 재발송"}</button>
      <button type="button" className="btxt" style={{ fontSize: 12, color: "var(--err)" }} disabled={!!busy} onClick={() => call("cancel")}>{busy === "cancel" ? "취소 중…" : "초대 취소"}</button>
      {msg && <span style={{ color: msg.ok ? "var(--ok)" : "var(--err)" }} role="status">{msg.text}</span>}
    </span>
  );
}
