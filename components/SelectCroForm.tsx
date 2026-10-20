"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckDisc, CheckMark } from "@/components/app/ui";

/**
 * 선정 확인. caution 이 있으면(회신 기한 전이거나 아직 회신하지 않은 기관이 있으면) 기한·미회신 수·남은 회신 링크가 닫힌다는 사실을
 * 보여 주고 따로 확인받는다 (lib/reply-window.ts selectionCaution).
 * revision: 이 화면이 보여 준 견적 판. 그 사이 기관이 견적을 고쳤으면 서버가 409 quote_changed 로 거절한다 (0022).
 * 그러면 화면을 새로 불러와 바뀐 내용을 보여 주고, 동의를 다시 받는다.
 */
export function SelectCroForm({
  no, quoteId, revision, croName, summary, others, contact, caution,
}: {
  no: string; quoteId: string; revision: number; croName: string;
  summary: [string, string][];
  others: { name: string; total: string }[];
  contact: string;
  caution?: { early: boolean; pending: number; replyBy: string | null } | null;
}) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [early, setEarly] = useState(false);
  const ready = agree && (!caution || early);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const go = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/rfq/${no}/select`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId, revision }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (res.status === 409 && d.code === "quote_changed") {
        // 화면을 연 뒤 견적이 바뀌었다. 새 내용을 불러오고, 바뀐 견적에 다시 동의하게 한다
        setAgree(false);
        setEarly(false);
        setError(d.error || "견적이 바뀌었습니다. 바뀐 내용을 다시 확인한 뒤 선택해 주세요.");
        router.refresh();
        return;
      }
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
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{croName}을 선택했습니다</h2>
        <p style={{ fontSize: 15, color: "var(--body)", maxWidth: 360 }}>선택한 기관에 연락처를 전달했습니다. 기관과 직접 계약을 진행하고 요청 상세에서 진행 상황을 확인하세요.</p>
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
        <b style={{ fontWeight: 600 }}>CRO에 공개되는 연락처</b>
        <span>{contact}</span>
      </div>

      {others.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>선택하지 않은 CRO에는 결과만 안내됩니다</div>
          {others.map((o) => (
            <div key={o.name} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 16px", border: "1px solid var(--cline)", borderRadius: 12, fontSize: 14, background: "var(--wh)" }}>
              <span>{o.name}</span>
              <span className="tnum" style={{ color: "var(--muted)" }}>{o.total}</span>
            </div>
          ))}
        </div>
      )}

      {caution && (
        <div className="note note--warn" role="note" style={{ flexDirection: "column", gap: 6 }}>
          <b style={{ fontWeight: 600 }}>{caution.early ? "아직 회신 기한 전입니다" : "참여했지만 아직 제출하지 않은 기관이 있습니다"}</b>
          <span>
            회신 기한 {caution.replyBy ?? "미정"} · 참여했지만 아직 제출하지 않은 기관 <span className="tnum">{caution.pending}곳</span>.
            {" "}지금 선정하면 남은 회신 링크가 닫혀 더는 견적을 받지 않고, 이미 제출한 기관도 견적을 고칠 수 없습니다.
          </span>
        </div>
      )}

      {caution && (
        <button type="button" className="chkcard" aria-pressed={early} onClick={() => setEarly(!early)}>
          <span className="chkcard__box">
            <CheckMark />
          </span>
          <span>{caution.early ? "회신 기한 전에 선정하며, " : ""}선정하면 남은 회신 링크가 닫힌다는 것을 확인했습니다.</span>
        </button>
      )}

      <button type="button" className="chkcard" aria-pressed={agree} onClick={() => setAgree(!agree)}>
        <span className="chkcard__box">
          <CheckMark />
        </span>
        <span>견적서 원본(PDF)을 확인했고, 선택한 CRO에 회사명과 담당자 연락처(성명·이메일·휴대전화)를 계약 협의 목적으로 제공하는 것에 동의합니다.</span>
      </button>

      {error && <p className="note note--err" role="alert">{error}</p>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="b1 blg" style={{ flex: 1 }} disabled={!ready || busy} onClick={go}>
          {busy ? "저장 중…" : `${croName}으로 진행`}
        </button>
        <Link href={`/app/r/${no}/compare`} className="b2" style={{ height: 56 }}>비교표로</Link>
      </div>
    </div>
  );
}
