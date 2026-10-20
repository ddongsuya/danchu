"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckDisc, CheckMark } from "@/components/app/ui";

export function SelectCroForm({
  no, quoteId, croName, summary, others, contact,
}: {
  no: string; quoteId: string; croName: string;
  summary: [string, string][];
  others: { name: string; total: string }[];
  contact: string;
}) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const go = async () => {
    if (!agree || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/rfq/${no}/select`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "선택을 저장하지 못했습니다.");
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "선택을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card rise-in" style={{ padding: "36px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
        <CheckDisc size={64} />
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>선택을 마쳤습니다</h2>
        <p style={{ fontSize: 15, color: "var(--body)", maxWidth: 360 }}>{croName} · 서로 연락처를 주고받았습니다. 기관 담당자 연락처는 요청 상세에 있습니다. 계약을 맺고 기관이 보고하면 그 내용을 확인해 주세요.</p>
        <Link href={`/app/r/${no}`} className="b1" style={{ marginTop: 8 }}>진행 상태 보기</Link>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 640 }}>
      <div style={{ border: "1px solid var(--brand)", background: "var(--tint)", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{croName}</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", fontSize: 14 }}>
          {summary.map(([k, v]) => (
            <div key={k} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{k}</span>
              <span className="tnum" style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="note note--tint" style={{ flexDirection: "column", gap: 4 }}>
        <b style={{ fontWeight: 600 }}>이 기관에 공개되는 우리 연락처</b>
        <span>{contact}</span>
      </div>

      {others.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>선택하지 않은 기관에는 결과만 안내됩니다</div>
          {others.map((o) => (
            <div key={o.name} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 16px", border: "1px solid var(--cline)", borderRadius: 12, fontSize: 14, background: "var(--wh)" }}>
              <span>{o.name}</span>
              <span className="tnum" style={{ color: "var(--muted)" }}>{o.total}</span>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="chkcard" aria-pressed={agree} onClick={() => setAgree(!agree)}>
        <span className="chkcard__box">
          <CheckMark />
        </span>
        <span>견적서 원본(PDF)을 확인했고, 이 기관과 회사명·담당자 연락처를 서로 주고받는 것에 동의합니다.</span>
      </button>

      {error && <p className="note note--err" role="alert">{error}</p>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="b1 blg" style={{ flex: 1 }} disabled={!agree || busy} onClick={go}>
          {busy ? "저장 중…" : `${croName}으로 진행`}
        </button>
        <Link href={`/app/r/${no}/compare`} className="b2" style={{ height: 56 }}>비교표로</Link>
      </div>
    </div>
  );
}
