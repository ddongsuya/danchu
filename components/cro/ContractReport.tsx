"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ContractReport({ awardId }: { awardId: string }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ok = !!date && /^\d{1,13}$/.test(amount);

  return (
    <form
      className="card card--pad stack"
      style={{ gap: 12, background: "var(--sf)" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok || busy) return;
        setBusy(true);
        setError("");
        try {
          const res = await fetch(`/api/awards/${awardId}/contract`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, amount, note }) });
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) throw new Error(d.error || "저장하지 못했습니다.");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
          setBusy(false);
        }
      }}
    >
      <b style={{ fontSize: 14, fontWeight: 700 }}>계약 체결 보고</b>
      <div className="grid2">
        <div className="fld">
          <label className="fld__lab" htmlFor={`d-${awardId}`}>체결일<span className="req">*</span></label>
          <input id={`d-${awardId}`} className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="fld">
          <label className="fld__lab" htmlFor={`a-${awardId}`}>계약금액 (VAT 별도)<span className="req">*</span></label>
          <div className="numin">
            <input id={`a-${awardId}`} type="text" inputMode="numeric" value={amount ? Number(amount).toLocaleString("ko-KR") : ""} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 13))} placeholder="금액" />
            <span>원</span>
          </div>
        </div>
      </div>
      <div className="fld">
        <label className="fld__lab" htmlFor={`n-${awardId}`}>비고</label>
        <input id={`n-${awardId}`} className="inp" style={{ height: 44 }} value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="예: 항목 일부 조정, 착수 예정일" />
      </div>
      {error && <p className="note note--err" role="alert">{error}</p>}
      <button type="submit" className="b1" disabled={!ok || busy}>{busy ? "저장 중…" : "체결 보고"}</button>
    </form>
  );
}
