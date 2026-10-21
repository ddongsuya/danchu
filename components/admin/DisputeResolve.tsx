"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 의뢰자가 이의를 남긴 계약 보고를 운영자가 정리한다 (2026-10-20 결정 2, 0025 resolve_contract_dispute).
 * - 보고대로 확정: 운영자 확정으로 기록하고 요청을 마친다. 확정한 달에 정산한다
 * - 보고 취소: 보고를 지우고 기관이 다시 보고한다
 * 금액이나 체결일을 고쳐야 하면 먼저 요청 화면의 체결 정보 정정으로 고친 뒤 확정한다.
 * 사유는 필수이며 감사 기록에 남는다.
 */
export function DisputeResolve({ awardId }: { awardId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<"confirm" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ready = !!resolution && !!note.trim();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/awards/${awardId}/dispute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolution, note: note.trim() }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) throw new Error(d.error || "정리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setMsg({ ok: true, text: d.message || "정리했습니다." });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "정리하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="stack" style={{ gap: 4 }}>
        <button type="button" className="btxt" style={{ padding: 0, fontSize: 13 }} onClick={() => { setOpen(true); setMsg(null); }}>이의 정리</button>
        {msg?.ok && <p className="note note--ok" role="status" style={{ fontSize: 13 }}>{msg.text}</p>}
      </div>
    );
  }
  return (
    <form className="card card--pad stack" style={{ gap: 10, background: "var(--sf)", marginTop: 6 }} onSubmit={save}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="fld__lab" style={{ marginBottom: 6 }}>결과</legend>
        <div className="chips">
          <button type="button" className="chip" aria-pressed={resolution === "confirm"} onClick={() => setResolution("confirm")}>보고대로 확정</button>
          <button type="button" className="chip" aria-pressed={resolution === "reject"} onClick={() => setResolution("reject")}>보고 취소</button>
        </div>
      </fieldset>
      <div className="fld">
        <label className="fld__lab" htmlFor={`dr-n-${awardId}`}>확인한 내용<span className="req">*</span></label>
        <textarea id={`dr-n-${awardId}`} className="inp" rows={3} value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} />
        <p className="fld__help">
          {resolution === "reject"
            ? "보고를 지우면 기관이 체결일과 금액을 다시 보고합니다."
            : "금액이나 체결일이 다르면 먼저 요청 화면에서 체결 정보를 정정한 뒤 확정해 주세요."}{" "}
          감사 기록에 남습니다.
        </p>
      </div>
      {msg && !msg.ok && <p className="note note--err" role="alert">{msg.text}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="b1 bsm" disabled={!ready || busy}>{busy ? "저장 중…" : "정리"}</button>
        <button type="button" className="b2 bsm" disabled={busy} onClick={() => setOpen(false)}>닫기</button>
      </div>
    </form>
  );
}
