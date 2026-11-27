"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/concierge";
import type { ContractStatus } from "@/lib/db-types";
import { GapReasonField, gapReady } from "@/components/GapReasonField";
import type { GapReason } from "@/lib/contract-gap";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { adminPost } from "./act";

type Mode = "signed" | "negotiating" | "not_signed" | "pending";
const MODES: [Mode, string][] = [
  ["signed", "체결"],
  ["negotiating", "협의 중"],
  ["not_signed", "미체결"],
  ["pending", "확인 전"],
];

/** 확인창 결과 문장용 (조사 포함) */
const TO_LABEL: Record<Mode, string> = { signed: "체결로", negotiating: "협의 중으로", not_signed: "미체결로", pending: "확인 전으로" };

export type ContractErrors = Partial<Record<"date" | "amount" | "gap" | "note", string>>;

/** 기록 전 칸 검사 (시안 a-r-contract~ferr). 오류는 칸 바로 아래 한 줄 */
export function contractErrors(mode: Mode, f: { date: string; amount: string; note: string; gapOk: boolean }): ContractErrors {
  const e: ContractErrors = {};
  if (mode === "signed") {
    if (!f.date) e.date = "체결일을 골라 주세요.";
    if (!/^\d{1,13}$/.test(f.amount) || Number(f.amount) <= 0) e.amount = "계약금액을 입력해 주세요.";
    else if (!f.gapOk) e.gap = "차이 사유를 골라 주세요.";
  }
  if (mode === "not_signed" && !f.note.trim()) e.note = "미체결 사유를 입력해 주세요.";
  return e;
}

/**
 * 선정된 수주의 계약 결과를 운영자가 기록한다 (기관이 보고하지 않거나 계정이 없을 때, 시안 검토판 a-r-contract).
 * 체결은 체결일·금액과 함께 기관 보고와 같은 경로(report_contract)로 저장하고, 협의 중·미체결·확인 전은 상태만 남긴다.
 * "계약 기록"을 누르면 확인창이 저장하고, 실패하면 창 안에 이유를 보여 준다. 입력은 그대로 남는다.
 */
export function ContractRecord({ awardId, status, reported, today, minDate, note: initialNote, quoteAmount = null }: { awardId: string; status: ContractStatus; reported: boolean; today: string; minDate: string; note: string | null; quoteAmount?: number | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [mode, setMode] = useState<Mode>(reported ? "signed" : status === "signed" ? "signed" : status);
  const [open, setOpen] = useState(!reported);
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState(reported ? "" : initialNote ?? "");
  const [gapReason, setGapReason] = useState<GapReason | "">("");
  const [errs, setErrs] = useState<ContractErrors>({});
  const [done, setDone] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = contractErrors(mode, { date, amount, note, gapOk: gapReady(quoteAmount, amount, gapReason, note) });
    setErrs(found);
    if (Object.keys(found).length) {
      document.getElementById(`cr-${Object.keys(found)[0][0]}-${awardId}`)?.focus();
      return;
    }
    const fallback = "계약 결과를 기록하지 못했어요. 입력한 내용은 그대로 있어요.";
    let message = "";
    const ok = await confirm({
      title: reported ? "체결 정보를 정정할까요?" : "계약 결과를 기록할까요?",
      body: mode === "signed" ? "기록하면 의뢰자에게 계약 내용 확인 요청이 갑니다." : `기록하면 계약 상태가 ${TO_LABEL[mode]} 바뀝니다.`,
      confirmLabel: "계약 기록",
      pendingLabel: "기록하는 중",
      action: async () => {
        const d = mode === "signed"
          ? await adminPost(`/api/awards/${awardId}/contract`, { date, amount, note, gapReason: gapReason || undefined }, fallback)
          : await adminPost(`/api/admin/awards/${awardId}/contract-status`, { status: mode, note }, fallback);
        message = d.message ?? "";
      },
    });
    if (!ok) return;
    setDone(message || "계약 결과를 기록했어요.");
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>계약 상태</span>
        <span className={`pill ${CONTRACT_STATUS_TONE[status] ?? "pill--sf"}`}>{CONTRACT_STATUS_LABEL[status] ?? status}</span>
        {!open && (
          <button type="button" className="btxt" style={{ padding: 0, fontSize: 13 }} onClick={() => { setOpen(true); setDone(""); }}>
            {reported ? "체결 정보 정정" : "계약 결과 기록"}
          </button>
        )}
      </div>
      {open && (
        <form className="stack" style={{ gap: 12 }} onSubmit={save} noValidate>
          {!reported && (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="fld__lab" style={{ marginBottom: 6 }}>결과</legend>
              <div className="chips">
                {MODES.map(([m, label]) => (
                  <button key={m} type="button" className="chip" aria-pressed={mode === m} onClick={() => { setMode(m); setErrs({}); }}>{label}</button>
                ))}
              </div>
            </fieldset>
          )}
          {mode === "signed" && (
            <div className="grid2">
              <div className="fld">
                <label className="fld__lab" htmlFor={`cr-d-${awardId}`}>체결일<span className="req">*</span></label>
                <input id={`cr-d-${awardId}`} className="inp" type="date" min={minDate} max={today} value={date} aria-invalid={!!errs.date || undefined} onChange={(e) => setDate(e.target.value)} />
                {errs.date && <p className="fld__err" role="alert">{errs.date}</p>}
              </div>
              <div className="fld">
                <label className="fld__lab" htmlFor={`cr-a-${awardId}`}>계약금액 (VAT 별도)<span className="req">*</span></label>
                <div className="numin">
                  <input id={`cr-a-${awardId}`} type="text" inputMode="numeric" aria-invalid={!!errs.amount || undefined} value={amount ? Number(amount).toLocaleString("ko-KR") : ""} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 13))} />
                  <span>원</span>
                </div>
                {errs.amount && <p className="fld__err" role="alert">{errs.amount}</p>}
              </div>
            </div>
          )}
          {mode === "signed" && <GapReasonField id={`cr-g-${awardId}`} quoteAmount={quoteAmount} amount={amount} reason={gapReason} onReason={setGapReason} formal />}
          {errs.gap && <p className="fld__err" role="alert">{errs.gap}</p>}
          <div className="fld">
            <label className="fld__lab" htmlFor={`cr-n-${awardId}`}>{mode === "not_signed" ? <>미체결 사유<span className="req">*</span></> : "비고"}</label>
            <input id={`cr-n-${awardId}`} className="inp" value={note} aria-invalid={!!errs.note || undefined} onChange={(e) => setNote(e.target.value.slice(0, 300))} />
            {errs.note ? <p className="fld__err" role="alert">{errs.note}</p> : mode === "not_signed" ? <p className="fld__help">미체결로 기록하면 계약 알림을 더 보내지 않아요.</p> : null}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="b1 bsm">계약 기록</button>
            {reported && <button type="button" className="b2 bsm" onClick={() => setOpen(false)}>닫기</button>}
          </div>
        </form>
      )}
      {done && <p className="note note--ok" role="status" style={{ fontSize: 13 }}>{done}</p>}
    </div>
  );
}
