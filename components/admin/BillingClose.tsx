"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** 청구 월 마감·해제 버튼. 마감하면 그 달 전달의 청구 토글이 막힌다 */
export function BillingClose({ month, closed }: { month: string; closed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [arm, setArm] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/admin/billing/close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, closed: !closed }) });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) { setErr(d.error || "처리하지 못했습니다."); setBusy(false); return; }
    setArm(false);
    setBusy(false);
    router.refresh();
  };
  if (!arm) {
    return (
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <button type="button" className={closed ? "b2" : "b1"} onClick={() => setArm(true)}>{closed ? "마감 해제" : "이 달 청구 마감"}</button>
        {err && <span style={{ fontSize: 12, color: "var(--err)" }}>{err}</span>}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
      <span>{closed ? "해제하면 청구 제외를 다시 바꿀 수 있습니다." : "마감하면 이 달 청구 제외를 바꿀 수 없습니다."}</span>
      <button type="button" className="b1 bsm" disabled={busy} onClick={go}>{busy ? "…" : "확인"}</button>
      <button type="button" className="b2 bsm" disabled={busy} onClick={() => setArm(false)}>취소</button>
    </span>
  );
}
