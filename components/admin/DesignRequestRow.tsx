"use client";

import { useState } from "react";

const OPTS = [["received", "접수"], ["making", "제작 중"], ["review", "검토"], ["applied", "적용"], ["cancelled", "취소"]] as const;

/** 운영자: 양식 제작 요청 한 줄 (단계·기관에 보일 답) */
export function DesignRequestRow({ id, org, date, status: s0, note, reply: r0, files }: { id: string; org: string; date: string; status: string; note: string; reply: string; files: { name: string; size: number }[] }) {
  const [status, setStatus] = useState(s0);
  const [reply, setReply] = useState(r0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async () => {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/admin/design-requests/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reply }) }).catch(() => null);
    setBusy(false);
    setMsg(r?.ok ? "저장했어요" : "저장하지 못했어요");
  };
  return (
    <div style={{ padding: "16px 0", display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <b>{org}</b>
        <span className="tnum" style={{ fontSize: 13, color: "var(--muted)" }}>{date}</span>
      </div>
      {note && <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{note}</p>}
      {files.length > 0 && (
        <div className="chips">
          {files.map((f, i) => <a key={i} className="tag" href={`/api/admin/design-requests/${id}?file=${i}`}>{f.name}</a>)}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 160px) minmax(0, 1fr) auto", gap: 8, alignItems: "end" }}>
        <div className="fld"><label className="fld__lab" htmlFor={`st-${id}`}>단계</label>
          <select id={`st-${id}`} className="sel" value={status} onChange={(e) => setStatus(e.target.value)}>{OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
        <div className="fld"><label className="fld__lab" htmlFor={`rp-${id}`}>기관에 보일 답</label>
          <input id={`rp-${id}`} className="inp" value={reply} maxLength={2000} placeholder="예: 11월 10일까지 시안을 보내요" onChange={(e) => setReply(e.target.value)} />
        </div>
        <button type="button" className="b1" disabled={busy} onClick={save}>{busy ? "저장 중…" : "저장"}</button>
      </div>
      {msg && <span role="status" style={{ fontSize: 13, color: "var(--muted)" }}>{msg}</span>}
    </div>
  );
}
