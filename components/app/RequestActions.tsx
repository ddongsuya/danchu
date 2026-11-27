"use client";
import { useRef, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useRouter } from "next/navigation";

async function post(url: string, body?: unknown): Promise<void> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error || "처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
}

/**
 * 기관이 보고한 계약 내용을 의뢰자가 확인한다 (시안 r-confirm · r-dispute). 이 카드가 확인창 역할이라 "맞아요"는 바로 확정하고,
 * "달라요"는 확인창에서 실제와 다른 부분을 받아 운영자에게 보낸다. 보고 7일 뒤 답이 없으면 자동 확정된다.
 */
export function ContractConfirm({ no, cro, date, amount, amountWon, gap }: { no: string; cro: string; date: string; amount: string; amountWon: string; autoOn?: string; gap?: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const note = useRef("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await post(`/api/rfq/${encodeURIComponent(no)}/contract`, { action: "confirm" });
      router.refresh();
    } catch {
      setErr("계약을 확정하지 못했어요. 계약 상태는 바뀌지 않았어요.");
    } finally {
      setBusy(false);
    }
  };
  const dispute = async () => {
    note.current = "";
    const sent = await confirm({
      title: "계약 내용이 다르다고 알릴까요?",
      body: (
        <>
          <p>보내면 운영자가 기관과 확인한 뒤 알려 주고, 그동안 자동 확정은 멈춥니다.</p>
          <label className="fld">
            <span className="fld__label">실제와 다른 부분</span>
            <textarea className="ta" rows={3} maxLength={1000} onChange={(e) => { note.current = e.currentTarget.value; }} />
          </label>
        </>
      ),
      confirmLabel: "운영자에게 보내기",
      cancelLabel: "돌아가기",
      pendingLabel: "보내는 중",
      action: async () => {
        if (!note.current.trim()) throw new Error("실제와 다른 부분을 적어 주세요.");
        await post(`/api/rfq/${encodeURIComponent(no)}/contract`, { action: "dispute", note: note.current }).catch(() => {
          throw new Error("운영자에게 보내지 못했어요. 입력한 내용은 그대로 있어요.");
        });
      },
    });
    if (sent) router.refresh();
  };
  return (
    <div id="contract-confirm" className="card" style={{ padding: 18, scrollMarginTop: 88 }}>
      <div className="sec-title" style={{ margin: "0 0 6px" }}>
        <h2>계약 내용이 맞나요?</h2>
      </div>
      <p style={{ fontSize: 14, color: "var(--body)", marginBottom: 12 }}>맞아요를 누르면 계약금액 {amountWon}으로 계약이 확정되고, 확정한 뒤에는 고칠 수 없습니다.</p>
      <div className="card--rows" style={{ marginBottom: 12 }}>
        <div className="kv"><span className="kv__k">기관</span><span className="kv__v">{cro}</span></div>
        <div className="kv"><span className="kv__k">계약금액 (VAT 별도)</span><span className="kv__v tnum">{amount}</span></div>
        <div className="kv"><span className="kv__k">계약일</span><span className="kv__v tnum">{date}</span></div>
        {gap && <div className="kv"><span className="kv__k">견적 대비</span><span className="kv__v tnum">{gap}</span></div>}
      </div>
      {err && <p className="note note--err" role="alert" style={{ marginBottom: 12 }}>{err}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="b2" disabled={busy} onClick={() => void dispute()}>달라요</button>
        <button type="button" className="b1" disabled={busy} aria-busy={busy || undefined} onClick={ok}>{busy ? "확정하는 중" : err ? "다시 확정" : "맞아요"}</button>
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
/** 참여 안내 보내기 (/api/rfq/[no]/start). 접수 완료 화면에서는 실패 줄 옆 "다시 보내기"로 쓴다 */
export function StartNow({ no, label = "지금 보내기" }: { no: string; label?: string }) {
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
          aria-busy={busy || undefined}
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
          {busy ? "보내는 중" : label}
        </button>
      </div>
    </div>
  );
}
