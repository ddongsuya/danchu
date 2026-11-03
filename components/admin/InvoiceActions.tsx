"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(url: string, body: unknown): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
    return { ok: r.ok, message: r.ok ? d.message || "처리했습니다." : d.error || "처리하지 못했습니다." };
  } catch {
    return { ok: false, message: "연결이 끊겨 처리하지 못했습니다. 다시 시도해 주세요." };
  }
}

/** 마감한 달 청구서 만들기 (+ 바로 보내기) */
export function InvoiceIssue({ month, hasAny, notSent }: { month: string; hasAny: boolean; notSent: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const go = async (send: boolean) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    setMsg(await post("/api/admin/billing/invoices", { month, send }));
    setBusy(false);
    router.refresh();
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="b1" disabled={busy} aria-busy={busy || undefined} onClick={() => go(true)}>
          {busy ? "처리하는 중" : hasAny ? `빠진 청구서 만들고 안 보낸 ${notSent}장 보내기` : "청구서 만들고 보내기"}
        </button>
        <button type="button" className="b2" disabled={busy} onClick={() => go(false)}>만들기만</button>
      </div>
      <span className="fld__help">합계가 0원보다 큰 기관마다 1장, 부가세 10% 포함, 납부 기한은 오늘부터 14일입니다. 이미 있는 청구서는 다시 만들지 않습니다.</span>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`note ${msg.ok ? "note--ok" : "note--warn"}`} style={{ margin: 0 }}>{msg.message}</p>}
    </div>
  );
}

/** 청구서 1장: 보내기 · 입금 확인 · 취소 */
export function InvoiceActions({ id, sent }: { id: string; sent: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"" | "paid" | "void">("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [paidOn, setPaidOn] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }));
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const run = async (body: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await post(`/api/admin/billing/invoices/${id}`, body);
    setMsg(r);
    setBusy(false);
    if (r.ok) { setMode(""); router.refresh(); }
  };
  return (
    <div className="stack" style={{ gap: 6, minWidth: 180 }}>
      {mode === "" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" className="b2 bsm" disabled={busy} onClick={() => run({ action: "send" })}>{sent ? "다시 보내기" : "보내기"}</button>
          <button type="button" className="b2 bsm" disabled={busy} onClick={() => setMode("paid")}>입금 확인</button>
          <button type="button" className="b2 bsm" disabled={busy} onClick={() => setMode("void")}>취소</button>
        </div>
      )}
      {mode === "paid" && (
        <form className="stack" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); run({ action: "paid", paidOn, note }); }}>
          <label className="fld__lab" htmlFor={`paid-${id}`}>입금일</label>
          <input id={`paid-${id}`} className="inp tnum" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
          <label className="fld__lab" htmlFor={`note-${id}`}>메모 (선택)</label>
          <input id={`note-${id}`} className="inp" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="입금자명, 은행" />
          <div style={{ display: "flex", gap: 6 }}>
            <button type="submit" className="b1 bsm" disabled={busy} aria-busy={busy || undefined}>{busy ? "저장하는 중" : "입금 확인"}</button>
            <button type="button" className="b2 bsm" disabled={busy} onClick={() => setMode("")}>닫기</button>
          </div>
        </form>
      )}
      {mode === "void" && (
        <form className="stack" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); run({ action: "void", reason }); }}>
          <label className="fld__lab" htmlFor={`void-${id}`}>취소 사유</label>
          <input id={`void-${id}`} className="inp" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} required aria-describedby={`void-help-${id}`} />
          <span id={`void-help-${id}`} className="fld__help">취소해도 기록은 남습니다. 같은 달 청구서를 다시 만들 수 있습니다.</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="submit" className="b1 bsm" disabled={busy} aria-busy={busy || undefined}>{busy ? "취소하는 중" : "청구서 취소"}</button>
            <button type="button" className="b2 bsm" disabled={busy} onClick={() => setMode("")}>닫기</button>
          </div>
        </form>
      )}
      {msg && <span role={msg.ok ? "status" : "alert"} style={{ fontSize: 12, color: msg.ok ? "var(--ok)" : "var(--err)" }}>{msg.message}</span>}
    </div>
  );
}
