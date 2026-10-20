"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 운영자 진행 관리. "회신 마감"은 compared_at 을 채워 남은 회신 링크를 닫는다 (비교표 공개 단계는 없다, lib/reply-window.ts).
 * 기한 다음 날 cron 이 같은 일을 하므로, 기한 전에 닫아야 할 때만 쓴다(전원 회신 또는 의뢰자 요청). 다시 열려면 회신 기한을 늘린다.
 */
export function AdminActions({ no, status, submitted, pending, early, closed, note: initialNote, award }: { no: string; status: string; submitted: number; pending: number; early: boolean; closed: boolean; note: string; award: { cro: string; at: string; contract: string } | null }) {
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
  // 기한 전 마감은 참여한 기관이 모두 제출했거나 의뢰자가 요청한 경우만 (약관 제4조7항). 미회신 기관이 있으면 의뢰자 요청으로 기록한다
  const closeConfirm = !early
    ? `견적 ${submitted}건으로 회신을 마감할까요?${pending ? ` 참여했지만 제출하지 않은 ${pending}곳의 회신 링크도 닫힙니다.` : ""} 의뢰자에게 요약을 보냅니다. 다시 열려면 기한을 늘려 주세요.`
    : pending
      ? `아직 회신 기한 전이고 참여했지만 제출하지 않은 기관이 ${pending}곳 있습니다. 기한 전 마감은 의뢰자가 요청한 경우에만 할 수 있습니다. 의뢰자의 마감 요청을 받았습니까? 확인을 누르면 의뢰자 요청으로 기록하고 견적 ${submitted}건으로 회신을 마감합니다. 이 요청의 모든 기관에 마감을 알리고 의뢰자에게 요약을 보냅니다. 다시 열려면 기한을 늘려 주세요.`
      : `견적 ${submitted}건으로 회신을 마감할까요? 아직 회신 기한 전이지만 참여한 기관이 모두 제출했습니다. 제출한 기관에 마감을 알리고 의뢰자에게 요약을 보냅니다. 다시 열려면 기한을 늘려 주세요.`;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!done && !closed && ["distributed", "quoted"].includes(status) && (
          <button type="button" className="b1" disabled={submitted === 0 || !!busy} title={submitted === 0 ? "제출된 견적이 있어야 마감할 수 있습니다" : undefined} onClick={() => call("close-replies", `/api/admin/rfqs/${no}/close-replies`, { sponsorRequested: early && pending > 0 }, closeConfirm)}>
            {busy === "close-replies" ? "처리 중…" : `회신 마감 (견적 ${submitted}건)`}
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
