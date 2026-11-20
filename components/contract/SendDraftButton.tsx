"use client";

import { useState } from "react";

/** 기관: 계약서(안)을 의뢰자에게 보내기. 보낸 뒤에는 보낸 날을 보인다 */
export function SendDraftButton({ awardId, sentAt }: { awardId: string; sentAt: string | null }) {
  const [state, setState] = useState<{ kind: "idle" | "sending" } | { kind: "sent"; at: string } | { kind: "error"; message: string }>(sentAt ? { kind: "sent", at: sentAt } : { kind: "idle" });
  const send = async () => {
    setState({ kind: "sending" });
    try {
      const r = await fetch(`/api/awards/${awardId}/contract-draft`, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { sentAt?: string; error?: string };
      setState(r.ok && j.sentAt ? { kind: "sent", at: j.sentAt } : { kind: "error", message: j.error || "보내지 못했어요. 다시 시도해 주세요." });
    } catch {
      setState({ kind: "error", message: "연결이 끊겼어요. 다시 시도해 주세요." });
    }
  };
  return (
    <>
      {state.kind === "error" && (
        <span className="note note--err" role="alert">
          {state.message}
        </span>
      )}
      <button type="button" className="b1" disabled={state.kind === "sending"} aria-busy={state.kind === "sending"} onClick={() => void send()}>
        {state.kind === "sending" ? "보내는 중" : state.kind === "sent" ? "다시 보내기" : "의뢰자에게 보내기"}
      </button>
      {state.kind === "sent" && <span className="ct__meta">보냄 {state.at.slice(0, 10)}</span>}
    </>
  );
}
