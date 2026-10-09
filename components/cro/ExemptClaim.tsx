"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** 수주 카드의 성사수수료 면제 상태와 기존 고객 신고 폼 */
export function ExemptClaim({ awardId, claim, decided, exempt, reason, canClaim }: { awardId: string; claim: string | null; decided: boolean; exempt: boolean; reason: string | null; canClaim: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    if (busy || note.trim().length < 5) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/awards/${awardId}/exempt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) throw new Error(d.error || "처리하지 못했습니다.");
      setMsg({ ok: true, text: d.message || "신고했습니다." });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "처리하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  if (decided) {
    return <p className="note" style={{ fontSize: 13 }}><b style={{ fontWeight: 600 }}>{exempt ? "성사수수료 면제 확정" : "기존 고객 면제 반려"}</b>{reason ? <span style={{ display: "block", color: "var(--muted)" }}>{reason}</span> : null}</p>;
  }
  return (
    <div className="stack" style={{ gap: 8, fontSize: 13 }}>
      {claim ? (
        <p className="note note--tint" style={{ margin: 0 }}><b style={{ fontWeight: 600 }}>기존 고객 면제 검토 중</b><span style={{ display: "block", color: "var(--muted)" }}>{claim}. 운영자가 확인 뒤 알려 드립니다.</span></p>
      ) : canClaim && !open ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>이 의뢰자와 이미 거래한 적이 있다면 <button type="button" className="btxt" style={{ fontSize: 13, padding: 0 }} onClick={() => setOpen(true)}>기존 고객으로 신고</button>하세요 (선정일부터 10영업일 안). 확인되면 성사수수료가 면제됩니다.</p>
      ) : null}
      {open && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="fld">
            <label className="fld__lab" htmlFor={`ex-${awardId}`}>근거</label>
            <input id={`ex-${awardId}`} className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 2025-11 반복투여독성 계약, 계약번호 ○○" />
            <p className="fld__help">선정일 이전 24개월 안의 계약이어야 합니다. 증빙은 hello@danchu.kr 로 보내 주세요.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="b1 bsm" disabled={busy || note.trim().length < 5} onClick={send}>{busy ? "보내는 중…" : "신고"}</button>
            <button type="button" className="b2 bsm" disabled={busy} onClick={() => setOpen(false)}>취소</button>
          </div>
        </div>
      )}
      {msg && <p className={`note ${msg.ok ? "note--tint" : "note--err"}`} role="status" style={{ margin: 0 }}>{msg.text}</p>}
    </div>
  );
}
