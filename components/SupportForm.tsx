"use client";

import { useState } from "react";
import { Caret, CheckDisc } from "@/components/app/ui";

const TYPES = ["견적 문의", "일정", "CDA·기밀", "계약", "계정", "기타"];

export function SupportForm({ email: initialEmail, requests }: { email: string; requests: { no: string; substance: string }[] }) {
  const [rfq, setRfq] = useState("");
  const [type, setType] = useState("견적 문의");
  const [text, setText] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, type, rfqNo: rfq, text }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "문의를 보내지 못했습니다.");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "문의를 보내지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="card rise-in" style={{ padding: "36px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
        <CheckDisc size={56} />
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>문의를 보냈습니다</h2>
        <p style={{ fontSize: 15, color: "var(--body)" }}>영업일 1일 내 {email}로 답변합니다.</p>
        <button type="button" className="btxt" onClick={() => { setSent(false); setText(""); }}>새 문의 작성</button>
      </div>
    );
  }

  return (
    <div className="card card--pad stack" style={{ gap: 18, maxWidth: 640 }}>
      {requests.length > 0 && (
        <div className="fld">
          <label className="fld__lab" htmlFor="rfq">관련 요청</label>
          <div className="selwrap">
            <select id="rfq" className="sel" value={rfq} onChange={(e) => setRfq(e.target.value)}>
              <option value="">해당 없음 (일반 문의)</option>
              {requests.map((r) => (
                <option key={r.no} value={r.no}>{r.no} · {r.substance}</option>
              ))}
            </select>
            <Caret dir="down" color="var(--muted)" />
          </div>
        </div>
      )}
      <div className="fld">
        <span className="fld__lab">유형</span>
        <div className="chips">
          {TYPES.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={type === t} onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="fld">
        <label className="fld__lab" htmlFor="text">내용<span className="req">*</span></label>
        <textarea id="text" className="ta" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 견적의 조직병리 포함 범위가 비교표와 PDF에서 다르게 보입니다. 확인 부탁드립니다." />
      </div>
      <div className="fld">
        <label className="fld__lab" htmlFor="email">답변 받을 이메일</label>
        <input id="email" className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && <p className="note note--err" role="alert">{error}</p>}
      <div>
        <button type="button" className="b1" disabled={!text.trim() || busy} onClick={send}>{busy ? "보내는 중…" : "보내기"}</button>
      </div>
    </div>
  );
}
