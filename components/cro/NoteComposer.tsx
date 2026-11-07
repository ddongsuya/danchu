"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "@phosphor-icons/react";

/** 고객 메모 남기기 (0038). 아래에 고정된 한 줄 입력 + 알림 날짜. 저장하면 기록을 새로 읽는다 */
export function NoteComposer({ clientKey, disabled }: { clientKey: string; disabled?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [date, setDate] = useState("");
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/cro/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientKey, body, remindOn: date || null }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "메모를 저장하지 못했어요.");
      setBody("");
      setDate("");
      setPick(false);
      router.refresh();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "메모를 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cl__compose" onSubmit={save}>
      {pick && (
        <label className="cl__date" htmlFor="note-date">
          알림 날짜
          <input id="note-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="inp" />
          {date && <button type="button" className="b2 bsm" onClick={() => setDate("")}>지우기</button>}
        </label>
      )}
      <div className="cl__row">
        <label htmlFor="note-body" className="sr-only">메모</label>
        <input id="note-body" className="inp" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="메모 남기기 · 통화 내용, 다음에 챙길 일" disabled={disabled || busy} />
        <button type="button" className={`cl__ic${date ? " cl__ic--on" : ""}`} aria-label={date ? `알림 날짜 ${date}` : "알림 날짜 정하기"} aria-pressed={pick} onClick={() => setPick((v) => !v)} disabled={disabled}><Clock size={20} aria-hidden="true" /></button>
        <button type="submit" className="b1" disabled={disabled || busy || !body.trim()}>{busy ? "저장 중" : "남기기"}</button>
      </div>
      <p className={err ? "cl__err" : "cl__hint"} role={err ? "alert" : undefined}>{err || (date ? `${+date.slice(5, 7)}월 ${+date.slice(8, 10)}일에 알림으로 알려요. 우리 기관만 봐요.` : "우리 기관만 봐요. 시계를 눌러 날짜를 정하면 그날 알려요.")}</p>
    </form>
  );
}
