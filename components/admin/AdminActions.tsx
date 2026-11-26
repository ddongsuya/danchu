"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useConfirm, type ConfirmOptions } from "@/components/ui/ConfirmDialog";
import { LONG_ACTION_TIMEOUT_MS, failureText } from "@/components/ui/toast-queue";

/**
 * 운영자 진행 관리. "회신 마감"은 compared_at 을 채워 비교표를 열고 남은 회신 링크를 닫는다 (lib/reply-window.ts).
 * 회신 기한이 지난 요청에서만 보인다. 다음 날 예약 작업이 같은 일을 하므로 그보다 먼저 열 때만 쓴다.
 * 기한 전 마감(의뢰자 요청 포함)은 없다 (2026-10-21 결정 2). 열린 비교표는 다시 열 수 없다 (결정 3).
 */
export function AdminActions({ no, status, submitted, pending, early, closed, note: initialNote, award }: { no: string; status: string; submitted: number; pending: number; early: boolean; closed: boolean; note: string; award: { cro: string; at: string; contract: string } | null }) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const confirm = useConfirm();

  const call = async (key: string, url: string, body: unknown, ask?: ConfirmOptions) => {
    if (busy) return;
    if (ask && !(await confirm(ask))) return;
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(LONG_ACTION_TIMEOUT_MS) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(d.error || "처리하지 못했습니다.");
      setMsg({ ok: true, text: d.message || "처리했습니다." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: failureText(e, "처리하지 못했습니다. 다시 시도해 주세요.") });
    } finally {
      setBusy("");
    }
  };
  const done = status === "closed" || status === "cancelled";
  // 기한이 지난 요청만 마감한다. 기한 전에는 참여가 마감된 뒤 참여한 기관이 모두 제출하면 DB 가 연다 (2026-10-21 결정 2)
  const closeConfirm: ConfirmOptions = {
    title: `견적 ${submitted}건으로 회신을 마감하고 비교표를 여시겠습니까?`,
    body: `${pending ? `참여했지만 제출하지 않은 ${pending}곳의 회신 링크도 닫힙니다. ` : ""}의뢰자에게 요약을 보냅니다. 열린 비교표는 다시 닫거나 회신 기한을 늘릴 수 없습니다.`,
    confirmLabel: "회신 마감",
    danger: true,
  };
  const canClose = !done && !closed && !early && ["distributed", "quoted"].includes(status);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canClose && (
          <Button className="b1" pending={busy === "close-replies"} disabled={submitted === 0 || (!!busy && busy !== "close-replies")} title={submitted === 0 ? "제출된 견적이 있어야 마감할 수 있습니다" : undefined} onClick={() => call("close-replies", `/api/admin/rfqs/${no}/close-replies`, {}, closeConfirm)}>
            회신 마감 (견적 {submitted}건)
          </Button>
        )}
        {!done && (
          <Button className="b2" pending={busy === "close"} disabled={!!busy && busy !== "close"} onClick={() => call("close", `/api/admin/rfqs/${no}/status`, { status: "closed" }, { title: "이 요청을 종료 처리하시겠습니까?", body: "계약 체결을 확인한 뒤 종료합니다.", confirmLabel: "종료" })}>종료</Button>
        )}
        {!done && (
          <Button className="b2 b2--danger" pending={busy === "cancel"} disabled={!!busy && busy !== "cancel"} onClick={() => call("cancel", `/api/admin/rfqs/${no}/status`, { status: "cancelled" }, { title: "이 요청을 취소 처리하시겠습니까?", body: "의뢰자와 배포된 기관에 취소 알림이 갑니다.", confirmLabel: "요청 취소", cancelLabel: "닫기", danger: true })}>취소</Button>
        )}
        {done && (
          <button type="button" className="b2" disabled={!!busy} onClick={() => call("reopen", `/api/admin/rfqs/${no}/status`, { status: "reopen" })}>다시 열기</button>
        )}
      </div>
      {!done && !closed && early && ["distributed", "quoted"].includes(status) && (
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>회신 기한 전에는 마감하지 않습니다. 비교표는 참여가 마감된 뒤 참여한 기관이 모두 제출하면 바로 열리고, 그렇지 않으면 회신 기한 다음 날 열립니다.</p>
      )}
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
          <Button className="b2 bsm" pending={busy === "note"} disabled={note === initialNote || (!!busy && busy !== "note")} onClick={() => call("note", `/api/admin/rfqs/${no}/status`, { note })}>메모 저장</Button>
        </div>
      </div>
      {msg && <p className={`note ${msg.ok ? "note--ok" : "note--err"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
    </div>
  );
}
