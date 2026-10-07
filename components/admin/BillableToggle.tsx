"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const REASONS = ["허위 요청", "동일 요청 중복", "수행 범위 불일치", "의뢰자 철회", "기타"];

/** 전달 1건의 청구 가능 여부. 제외할 때는 사유를 고른다 */
export function BillableToggle({ inviteId, billable, reason }: { inviteId: string; billable: boolean; reason: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);

  const send = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/invites/${inviteId}/billing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billable: next, reason: next ? "" : pick }) });
      if (r.ok) { setEditing(false); router.refresh(); }
    } finally {
      setBusy(false);
    }
  };

  if (!billable) {
    return (
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12 }}>
        <span className="pill pill--err">제외 · {reason}</span>
        <button type="button" className="btxt" disabled={busy} onClick={() => send(true)}>복원</button>
      </span>
    );
  }
  if (!editing) return <button type="button" className="btxt" style={{ fontSize: 12 }} onClick={() => setEditing(true)}>청구 제외</button>;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <select className="inp" style={{ height: 30, fontSize: 12, padding: "0 8px" }} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="제외 사유">
        {REASONS.map((r) => <option key={r}>{r}</option>)}
      </select>
      <button type="button" className="btxt" style={{ fontSize: 12 }} disabled={busy} onClick={() => send(false)}>확인</button>
      <button type="button" className="btxt" style={{ fontSize: 12 }} disabled={busy} onClick={() => setEditing(false)}>취소</button>
    </span>
  );
}
