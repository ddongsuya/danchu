"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckDisc, CheckMark } from "@/components/app/ui";

/**
 * 선정 확인. 비교표가 열린 뒤에만 선정할 수 있다 (2026-10-20 결정 1, 0025 select_quote 는 열리기 전이면 not_compared).
 * 그래서 기한 전 선정 확인 단계는 없다.
 * 선정하면 이 기관과 서로 연락처를 주고받는다: 의뢰자 회사명·담당자는 기관에, 기관 담당자 연락처는 의뢰자에게.
 * revision: 이 화면이 보여 준 견적 판. 그 사이 기관이 견적을 고쳤으면 서버가 409 quote_changed 로 거절한다 (0022).
 * 그러면 화면을 새로 불러와 바뀐 내용을 보여 주고, 동의를 다시 받는다.
 */
export function SelectCroForm({
  no, quoteId, revision, croName, summary, others, contact,
}: {
  no: string; quoteId: string; revision: number; croName: string;
  summary: [string, string][];
  others: { name: string; total: string }[];
  contact: string;
}) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const ready = agree;
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
        <b style={{ fontWeight: 600 }}>선택하면 서로 연락처를 주고받습니다</b>
        <span>이 기관에 공개되는 우리 연락처: {contact}</span>
        <span>기관 담당자 연락처는 선택 직후 요청 상세에 표시되고 메일로도 보내 드립니다.</span>
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
        <span>견적서 원본(PDF)을 확인했고, 이 기관과 회사명·담당자 연락처(성명·이메일·휴대전화)를 계약 협의 목적으로 서로 주고받는 것에 동의합니다.</span>
      </button>

      {error && <p className="note note--err" role="alert">{error}</p>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="b1 blg" style={{ flex: 1 }} disabled={!ready || busy} onClick={go}>
          {busy ? "저장 중…" : "이 기관으로 진행"}
        </button>
        <Link href={`/app/r/${no}/compare`} className="b2" style={{ height: 56 }}>비교표로</Link>
      </div>
    </div>
  );
}
