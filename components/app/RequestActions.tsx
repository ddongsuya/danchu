"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(url: string, body?: unknown): Promise<void> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error || "처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
}

/**
 * 기관이 보고한 계약 내용을 의뢰자가 확인한다. 맞으면 요청을 마치고, 다르면 운영자가 기관과 확인한다.
 * 7일 안에 답이 없으면 보고 내용대로 마무리된다는 사실을 함께 알린다.
 */
export function ContractConfirm({ no, cro, date, amount, autoOn, gap }: { no: string; cro: string; date: string; amount: string; autoOn: string; gap?: string }) {
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
      setErr(e instanceof Error ? e.message : "처리하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div id="contract-confirm" className="card" style={{ padding: 18, scrollMarginTop: 88 }}>
      <div className="sec-title" style={{ margin: "0 0 6px" }}>
        <h2>계약 내용이 맞나요?</h2>
      </div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>
        <b style={{ fontWeight: 600, color: "var(--ink)" }}>{cro} 보고 · 체결일 {date} · 계약금액 {amount}</b>
        {gap && (
          <>
            <br />
            <span className="tnum">{gap}</span>
          </>
        )}
        <br />
        {autoOn}까지 답이 없으면 보고 내용대로 마무리해요.
      </p>
      {mode === "dispute" && (
        <div className="fld" style={{ marginBottom: 12 }}>
          <label className="fld__lab" htmlFor="dispute-note">실제와 다른 부분</label>
          <textarea id="dispute-note" className="ta" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          <span className="fld__help">운영자가 기관과 확인한 뒤 알려요.</span>
        </div>
      )}
      {err && <p className="note note--err" role="alert" style={{ marginBottom: 12 }}>{err}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {mode === "ask" ? (
          <>
            <button type="button" className="b1" disabled={busy} onClick={() => run("confirm")}>{busy ? "처리 중…" : "맞아요"}</button>
            <button type="button" className="b2" disabled={busy} onClick={() => setMode("dispute")}>달라요</button>
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

type SponsorStatus = "signed" | "negotiating" | "not_signed";
const SPONSOR_CHOICES: [SponsorStatus, string][] = [
  ["signed", "계약했어요"],
  ["negotiating", "협의 중이에요"],
  ["not_signed", "계약하지 않기로 했어요"],
];

/**
 * 의뢰자가 선정한 기관과의 계약 결과를 알린다 (0034). 기관 보고와 따로 남아, 서로 다르면 운영자가 확인한다.
 * 이미 알렸으면 그 내용을 보여 주고 바꿀 수 있게 한다. 계약이 확정되면 이 카드는 나오지 않는다
 */
export function SponsorContractResult({ no, cro, minDate, today, current }: { no: string; cro: string; minDate: string; today: string; current: { status: SponsorStatus; label: string; at: string } | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(!current);
  const [status, setStatus] = useState<SponsorStatus | "">(current?.status ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!status || busy) return;
    setBusy(true);
    setErr("");
    try {
      await post(`/api/rfq/${encodeURIComponent(no)}/contract-result`, { status, amount: amount || undefined, date: date || undefined, note });
      setOpen(false);
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };
  if (!open && current) {
    return (
      <div className="note" style={{ flexDirection: "column", gap: 4 }}>
        <b>알려 주신 계약 결과 · {current.at}</b>
        <span>{current.label}</span>
        <span>
          <button type="button" className="btxt" style={{ padding: 0 }} onClick={() => setOpen(true)}>바뀐 내용 알리기</button>
        </span>
      </div>
    );
  }
  return (
    <form id="contract-result" className="card" style={{ padding: 18, scrollMarginTop: 88 }} onSubmit={send}>
      <div className="sec-title" style={{ margin: "0 0 6px" }}>
        <h2>선정한 기관과 계약은 어떻게 됐나요?</h2>
      </div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>
        <b style={{ fontWeight: 600, color: "var(--ink)" }}>{cro}</b>
        <br />
        기관의 계약 보고와 맞는지 확인하는 데 써요. 적어 주신 금액은 기관에 보이지 않아요.
      </p>
      <div className="chips" style={{ marginBottom: 12 }}>
        {SPONSOR_CHOICES.map(([v, label]) => (
          <button key={v} type="button" className="chip" aria-pressed={status === v} onClick={() => setStatus(v)}>{label}</button>
        ))}
      </div>
      {status === "signed" && (
        <div className="grid2" style={{ marginBottom: 12 }}>
          <div className="fld">
            <label className="fld__lab" htmlFor="sr-amount">계약금액 (VAT 별도, 선택)</label>
            <div className="numin">
              <input id="sr-amount" type="text" inputMode="numeric" value={amount ? Number(amount).toLocaleString("ko-KR") : ""} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 13))} />
              <span>원</span>
            </div>
          </div>
          <div className="fld">
            <label className="fld__lab" htmlFor="sr-date">계약일 (선택)</label>
            <input id="sr-date" className="inp" type="date" min={minDate} max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      )}
      <div className="fld" style={{ marginBottom: 12 }}>
        <label className="fld__lab" htmlFor="sr-note">메모 (선택)</label>
        <input id="sr-note" className="inp" value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} />
      </div>
      {err && <p className="note note--err" role="alert" style={{ marginBottom: 12 }}>{err}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="submit" className="b1" disabled={busy || !status}>{busy ? "보내는 중…" : "알리기"}</button>
        {current && <button type="button" className="b2" disabled={busy} onClick={() => setOpen(false)}>닫기</button>}
      </div>
    </form>
  );
}

/** 보류로 마무리한 요청을 다시 연다. 받은 견적으로 비교표에 돌아간다 */
export function ReopenRequest({ no, until }: { no: string; until: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="stack" style={{ gap: 8, marginTop: 6 }}>
      <span>{until}까지 다시 열어 받은 견적으로 이어서 비교할 수 있어요.</span>
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
              setErr(e instanceof Error ? e.message : "다시 열지 못했어요.");
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
              setErr(e instanceof Error ? e.message : "보내지 못했어요.");
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
