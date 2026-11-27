"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

const OPTS = [["received", "접수"], ["making", "제작 중"], ["review", "검토"], ["applied", "적용"], ["cancelled", "취소"]] as const;

/** 운영자: 양식 제작 요청 한 줄 (단계·기관에 보일 답) */
export function DesignRequestRow({ id, org, date, status: s0, note, reply: r0, files }: { id: string; org: string; date: string; status: string; note: string; reply: string; files: { name: string; size: number }[] }) {
  const [status, setStatus] = useState(s0);
  const [reply, setReply] = useState(r0);
  const [err, setErr] = useState("");
  const toast = useToast();
  // 저장은 토스트, 실패는 칸 아래 한 줄 (시안 a-qd~saved)
  const save = async () => {
    setErr("");
    const r = await fetch(`/api/admin/design-requests/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reply }) }).catch(() => null);
    if (r?.ok) toast("기관에 보일 답을 저장했어요");
    else setErr("답을 저장하지 못했어요. 입력한 내용은 그대로 있어요.");
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
        <Button className="b1" onClick={save}>저장</Button>
      </div>
      {err && <span className="fld__err" role="alert">{err}</span>}
    </div>
  );
}
