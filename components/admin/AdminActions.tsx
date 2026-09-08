"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminActions({ no, status, submitted, compared, note: initialNote, award }: { no: string; status: string; submitted: number; compared: boolean; note: string; award: { cro: string; at: string; contract: string } | null }) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const call = async (key: string, url: string, body: unknown, confirmText?: string) => {
    if (busy) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
  const done = status === "closed" || status === "cancelled";

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!done && (
          <button type="button" className="b1" disabled={submitted === 0 || !!busy} onClick={() => call("compare", `/api/admin/rfqs/${no}/compare`, {}, compared ? "비교표를 다시 공개하고 의뢰자에게 알림을 보낼까요?" : `회신 ${submitted}건으로 비교표를 공개하고 의뢰자에게 알릴까요?`)}>
            {busy === "compare" ? "처리 중…" : compared ? "비교표 재공개 · 알림" : `비교표 공개 (${submitted}건)`}
          </button>
        )}
        {!done && (
          <button type="button" className="b2" disabled={!!busy} onClick={() => call("close", `/api/admin/rfqs/${no}/status`, { status: "closed" }, "종료 처리할까요? 계약 체결 확인 후 종료합니다.")}>종료</button>
        )}
        {!done && (
          <button type="button" className="b2 b2--danger" disabled={!!busy} onClick={() => call("cancel", `/api/admin/rfqs/${no}/status`, { status: "cancelled" }, "취소 처리할까요? 의뢰자와 배포된 CRO에 취소 알림이 갑니다.")}>취소</button>
        )}
        {done && (
          <button type="button" className="b2" disabled={!!busy} onClick={() => call("reopen", `/api/admin/rfqs/${no}/status`, { status: "reopen" })}>다시 열기</button>
        )}
      </div>
      {award && (
        <div className="note note--ok" style={{ flexDirection: "column", gap: 2 }}>
          <b style={{ fontWeight: 600 }}>{award.cro} 선정 · {award.at}</b>
          <span>{award.contract ? `계약 체결 보고 · ${award.contract}` : "계약 체결 보고 대기"}</span>
        </div>
      )}
      <div className="fld">
        <label className="fld__lab" htmlFor="note">운영 메모 (내부용)</label>
        <textarea id="note" className="ta" rows={3} value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} placeholder="CDA 체결 현황, CRO 문의 내용, 특이사항" />
        <div>
          <button type="button" className="b2 bsm" disabled={note === initialNote || !!busy} onClick={() => call("note", `/api/admin/rfqs/${no}/status`, { note })}>메모 저장</button>
        </div>
      </div>
      {msg && <p className={`note ${msg.ok ? "note--ok" : "note--err"}`} role="status">{msg.text}</p>}
    </div>
  );
}
