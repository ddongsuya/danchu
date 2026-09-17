"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 기관 목록 행에서 바로 승인 (반려·중지는 상세 화면에서) */
export function QuickApprove({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const approve = async () => {
    if (busy || !window.confirm(`${name} 기관을 승인할까요? 담당자에게 승인 메일이 갑니다.`)) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/cros/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve", reason: "" }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "처리하지 못했습니다.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "처리하지 못했습니다.");
      setBusy(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <button type="button" className="b1 bsm" disabled={busy} onClick={approve}>{busy ? "처리 중…" : "승인"}</button>
      {err && <span style={{ fontSize: 12, color: "var(--err)" }}>{err}</span>}
    </span>
  );
}
