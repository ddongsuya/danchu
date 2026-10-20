"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(url: string, body?: unknown): Promise<void> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error || "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
}

/**
 * 기관이 보고한 계약 내용을 의뢰자가 확인한다. 맞으면 요청을 마치고, 다르면 운영자가 기관과 확인한다.
 * 7일 안에 답이 없으면 보고 내용대로 마무리된다는 사실을 함께 알린다.
 */
export function ContractConfirm({ no, cro, date, amount, autoOn }: { no: string; cro: string; date: string; amount: string; autoOn: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"ask" | "dispute">("ask");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (action: "confirm" | "dispute") => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await post(`/api/rfq/${encodeURIComponent(no)}/contract`, { action, note });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="sec-title" style={{ margin: "0 0 6px" }}>
        <h2>계약 내용이 맞나요?</h2>
      </div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>
        <b style={{ fontWeight: 600, color: "var(--ink)" }}>{cro} 보고 · 체결일 {date} · 계약금액 {amount}</b>
        <br />
        {autoOn}까지 답이 없으면 보고 내용대로 마무리합니다.
      </p>
      {mode === "dispute" && (
        <div className="fld" style={{ marginBottom: 12 }}>
          <label className="fld__lab" htmlFor="dispute-note">실제와 다른 부분</label>
          <textarea id="dispute-note" className="ta" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          <span className="fld__help">운영자가 기관과 확인한 뒤 알려 드립니다.</span>
        </div>
      )}
      {err && <p className="note note--err" role="alert" style={{ marginBottom: 12 }}>{err}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {mode === "ask" ? (
          <>
            <button type="button" className="b1" disabled={busy} onClick={() => run("confirm")}>{busy ? "처리 중…" : "맞습니다"}</button>
            <button type="button" className="b2" disabled={busy} onClick={() => setMode("dispute")}>다릅니다</button>
          </>
        ) : (
          <>
            <button type="button" className="b1" disabled={busy || !note.trim()} onClick={() => run("dispute")}>{busy ? "보내는 중…" : "운영자에게 보내기"}</button>
            <button type="button" className="b2" disabled={busy} onClick={() => setMode("ask")}>돌아가기</button>
          </>
        )}
      </div>
    </div>
  );
}

/** 보류로 마무리한 요청을 다시 연다. 받은 견적으로 비교표에 돌아간다 */
export function ReopenRequest({ no, until }: { no: string; until: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="stack" style={{ gap: 8, marginTop: 6 }}>
      <span>{until}까지 다시 열어 받은 견적으로 이어서 비교할 수 있습니다.</span>
      {err && <span role="alert" style={{ color: "var(--err)" }}>{err}</span>}
      <div>
        <button
          type="button"
          className="b2"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr("");
            try {
              await post(`/api/rfq/${encodeURIComponent(no)}/reopen`);
              router.push(`/app/r/${encodeURIComponent(no)}/compare`);
              router.refresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "다시 열지 못했습니다.");
              setBusy(false);
            }
          }}
        >
          {busy ? "여는 중…" : "다시 열기"}
        </button>
      </div>
    </div>
  );
}

/** 접수는 됐지만 기관 전달이 시작되지 않은 요청 (첨부를 올리다 창을 닫은 경우). 빠진 첨부 없이 지금 보낸다 */
export function StartNow({ no }: { no: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="stack" style={{ gap: 8, marginTop: 10 }}>
      {err && <span role="alert" style={{ color: "var(--err)", fontSize: 14 }}>{err}</span>}
      <div>
        <button
          type="button"
          className="b1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr("");
            try {
              await post(`/api/rfq/${encodeURIComponent(no)}/start`);
              router.refresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "보내지 못했습니다.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "보내는 중…" : "지금 보내기"}
        </button>
      </div>
    </div>
  );
}
