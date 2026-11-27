"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Caret } from "@/components/app/ui";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const TYPES = ["견적 문의", "일정", "CDA·기밀", "계약", "계정", "기타"];
const FAIL = "문의를 보내지 못했어요. 입력한 내용은 그대로 있어요.";

/**
 * 문의하기 (시안 r-support · c-support). 칸은 관련 요청 · 유형 · 내용 · 답변 받을 이메일.
 * 시안은 어느 화면에서든 뜨는 창이지만 주소(/app/support?rfq=&type=)로 여는 곳이 있어 화면으로 둔다.
 * 보내면 "문의를 보냈어요" 토스트를 띄우고 온 화면으로 돌아간다.
 */
export function SupportForm({ email: initialEmail, requests, initialRfq, initialType }: { email: string; initialRfq?: string; initialType?: string; requests: { no: string; substance: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [rfq, setRfq] = useState(requests.some((r) => r.no === initialRfq) ? initialRfq! : "");
  const [type, setType] = useState(initialType && TYPES.includes(initialType) ? initialType : "견적 문의");
  const [text, setText] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [textErr, setTextErr] = useState("");
  const [error, setError] = useState("");

  const send = async () => {
    if (!text.trim()) {
      setTextErr("내용을 입력해 주세요.");
      document.getElementById("text")?.focus();
      return;
    }
    setTextErr("");
    setError("");
    try {
      const res = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, type, rfqNo: rfq, text }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(res.status < 500 && d.error ? d.error : FAIL);
      toast("문의를 보냈어요");
      if (window.history.length > 1) router.back();
      else setText("");
    } catch (e) {
      setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : FAIL);
    }
  };

  return (
    <div className="card card--pad stack" style={{ gap: 18, maxWidth: 560 }}>
      {requests.length > 0 && (
        <div className="fld">
          <label className="fld__lab" htmlFor="rfq">관련 요청</label>
          <div className="selwrap">
            <select id="rfq" className="sel" value={rfq} onChange={(e) => setRfq(e.target.value)}>
              <option value="">해당 없음</option>
              {requests.map((r) => (
                <option key={r.no} value={r.no}>{r.no} · {r.substance}</option>
              ))}
            </select>
            <Caret dir="down" color="var(--muted)" />
          </div>
        </div>
      )}
      <div className="fld">
        <label className="fld__lab" htmlFor="type">유형</label>
        <div className="selwrap">
          <select id="type" className="sel" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <Caret dir="down" color="var(--muted)" />
        </div>
      </div>
      <div className="fld">
        <label className="fld__lab" htmlFor="text">내용<span className="req">*</span></label>
        <textarea id="text" className="ta" rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!!textErr} aria-describedby={textErr ? "text-err" : undefined} />
        {textErr && <p id="text-err" className="fld__err">{textErr}</p>}
      </div>
      <div className="fld">
        <label className="fld__lab" htmlFor="email">답변 받을 이메일<span className="req">*</span></label>
        <input id="email" className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && <p className="note note--err" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="b2" onClick={() => router.back()}>취소</button>
        <Button className="b1" onClick={send}>{error ? "다시 보내기" : "보내기"}</Button>
      </div>
    </div>
  );
}
