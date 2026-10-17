"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/concierge";
import type { ContractStatus } from "@/lib/db-types";

type Mode = "signed" | "negotiating" | "not_signed" | "pending";
const MODES: [Mode, string][] = [
  ["signed", "체결"],
  ["negotiating", "협의 중"],
  ["not_signed", "미체결"],
  ["pending", "확인 전"],
];

/**
 * 선정된 수주의 계약 결과를 운영자가 기록한다 (기관이 보고하지 않거나 계정이 없을 때).
 * 체결은 체결일·금액과 함께 기관 보고와 같은 경로(report_contract)로 저장하고, 협의 중·미체결·확인 전은 상태만 남긴다.
 */
export function ContractRecord({ awardId, status, reported, today, minDate, note: initialNote }: { awardId: string; status: ContractStatus; reported: boolean; today: string; minDate: string; note: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(reported ? "signed" : status === "signed" ? "signed" : status);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState(reported ? "" : initialNote ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const signedReady = !!date && /^\d{1,13}$/.test(amount) && Number(amount) > 0;
  const ready = mode === "signed" ? signedReady : mode === "not_signed" ? !!note.trim() : true;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r =
        mode === "signed"
          ? await fetch(`/api/awards/${awardId}/contract`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, amount, note }) })
          : await fetch(`/api/admin/awards/${awardId}/contract-status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: mode, note }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) throw new Error(d.error || "저장하지 못했습니다.");
      setMsg({ ok: true, text: d.message || "기록했습니다." });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "저장하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>계약 상태</span>
        <span className={`pill ${CONTRACT_STATUS_TONE[status] ?? "pill--sf"}`}>{CONTRACT_STATUS_LABEL[status] ?? status}</span>
        {!open && (
          <button type="button" className="btxt" style={{ padding: 0, fontSize: 13 }} onClick={() => { setOpen(true); setMsg(null); }}>
            {reported ? "체결 정보 정정" : "계약 결과 기록"}
          </button>
        )}
      </div>
      {open && (
        <form className="card card--pad stack" style={{ gap: 12, background: "var(--sf)" }} onSubmit={save}>
          {!reported && (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="fld__lab" style={{ marginBottom: 6 }}>결과</legend>
              <div className="chips">
                {MODES.map(([m, label]) => (
                  <button key={m} type="button" className="chip" aria-pressed={mode === m} onClick={() => setMode(m)}>{label}</button>
                ))}
              </div>
            </fieldset>
          )}
          {mode === "signed" && (
            <div className="grid2">
              <div className="fld">
                <label className="fld__lab" htmlFor={`cr-d-${awardId}`}>체결일<span className="req">*</span></label>
                <input id={`cr-d-${awardId}`} className="inp" type="date" min={minDate} max={today} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="fld">
                <label className="fld__lab" htmlFor={`cr-a-${awardId}`}>계약금액 (VAT 별도)<span className="req">*</span></label>
                <div className="numin">
                  <input id={`cr-a-${awardId}`} type="text" inputMode="numeric" value={amount ? Number(amount).toLocaleString("ko-KR") : ""} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 13))} />
                  <span>원</span>
                </div>
              </div>
            </div>
          )}
          <div className="fld">
            <label className="fld__lab" htmlFor={`cr-n-${awardId}`}>{mode === "not_signed" ? <>미체결 사유<span className="req">*</span></> : "메모"}</label>
            <input id={`cr-n-${awardId}`} className="inp" value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} />
            <p className="fld__help">
              {mode === "signed"
                ? "기관이 보고하는 것과 같은 기록입니다. 체결일은 선정일부터 오늘 사이여야 합니다."
                : mode === "not_signed"
                  ? "예: 의뢰자 일정 보류, 다른 경로로 진행. 미체결로 기록하면 계약 리마인더를 더 보내지 않습니다."
                  : "누구에게 확인했는지 적어 두면 나중에 찾기 쉽습니다."}
            </p>
          </div>
          {msg && !msg.ok && <p className="note note--err" role="alert">{msg.text}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="b1 bsm" disabled={!ready || busy}>{busy ? "저장 중…" : "기록"}</button>
            <button type="button" className="b2 bsm" disabled={busy} onClick={() => setOpen(false)}>닫기</button>
          </div>
        </form>
      )}
      {msg?.ok && <p className="note note--ok" role="status" style={{ fontSize: 13 }}>{msg.text}</p>}
    </div>
  );
}
