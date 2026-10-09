"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** 수주 1건의 성사수수료 면제 승인·반려·취소 */
export function FeeExemptForm({ awardId, claim, decided, exempt, reason }: { awardId: string; claim: string | null; decided: boolean; exempt: boolean; reason: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"" | "approve" | "reject">("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const send = async (next: boolean) => {
    if (busy || !text.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/admin/awards/${awardId}/exempt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exempt: next, reason: text }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || "처리하지 못했습니다.");
      setMode("");
      setText("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
      {decided ? (
        <span className={`pill ${exempt ? "pill--warn" : "pill--sf"}`} style={{ alignSelf: "flex-start" }}>{exempt ? "면제" : "면제 반려"}</span>
      ) : claim ? (
        <span className="pill pill--tint" style={{ alignSelf: "flex-start" }}>면제 요청</span>
      ) : (
        <span style={{ color: "var(--muted)" }}>청구 대상</span>
      )}
      {claim && <span style={{ color: "var(--muted)" }}>{claim}</span>}
      {decided && reason && <span style={{ color: "var(--muted)" }}>{reason}</span>}
      {!mode && (
        <span style={{ display: "inline-flex", gap: 8 }}>
          {!exempt && <button type="button" className="btxt" style={{ fontSize: 12 }} onClick={() => setMode("approve")}>면제 승인</button>}
          {(claim || exempt) && <button type="button" className="btxt" style={{ fontSize: 12 }} onClick={() => setMode("reject")}>{exempt ? "면제 취소" : "반려"}</button>}
        </span>
      )}
      {mode && (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input className="inp" style={{ height: 30, fontSize: 12, padding: "0 8px", minWidth: 180 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "approve" ? "확인한 증빙 (예: 2025-11 계약서 사본)" : "사유"} aria-label={mode === "approve" ? "면제 근거" : "반려 사유"} />
          <button type="button" className="btxt" style={{ fontSize: 12 }} disabled={busy || !text.trim()} onClick={() => send(mode === "approve")}>{busy ? "처리 중…" : "확인"}</button>
          <button type="button" className="btxt" style={{ fontSize: 12 }} disabled={busy} onClick={() => { setMode(""); setText(""); }}>취소</button>
        </span>
      )}
      {err && <span style={{ color: "var(--err)" }}>{err}</span>}
    </div>
  );
}
