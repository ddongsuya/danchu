"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrgApproval({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const act = async (action: string, confirmText: string) => {
    if (busy || !window.confirm(confirmText)) return;
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/cros/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
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
    <div className="stack" style={{ gap: 12 }}>
      <div className="fld">
        <label className="fld__lab" htmlFor="reason">안내 문구 (반려·중지 시 메일에 포함)</label>
        <input id="reason" className="inp" style={{ height: 44 }} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} placeholder="예: 사업자등록번호 확인 필요" />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {status !== "approved" && <button type="button" className="b1" disabled={!!busy} onClick={() => act("approve", "이 기관을 승인할까요? 담당자에게 승인 메일이 갑니다.")}>{busy === "approve" ? "처리 중…" : "승인"}</button>}
        {status === "pending" && <button type="button" className="b2 b2--danger" disabled={!!busy} onClick={() => act("reject", "반려할까요?")}>반려</button>}
        {status === "approved" && <button type="button" className="b2 b2--danger" disabled={!!busy} onClick={() => act("suspend", "참여를 중지할까요? 새 요청서가 배포되지 않습니다.")}>중지</button>}
      </div>
      {msg && <p className={`note ${msg.ok ? "note--ok" : "note--err"}`} role="status">{msg.text}</p>}
    </div>
  );
}
