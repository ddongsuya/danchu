"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GapReasonField, gapReady } from "@/components/GapReasonField";
import type { GapReason } from "@/lib/contract-gap";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { md } from "@/lib/format";
import "./layout-request.css";

export function ContractReport({ awardId, quoteAmount = null }: { awardId: string; quoteAmount?: number | null }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [gapReason, setGapReason] = useState<GapReason | "">("");
  const confirm = useConfirm();
  const ok = !!date && /^\d{1,13}$/.test(amount) && gapReady(quoteAmount, amount, gapReason, note);

  return (
    <form
      className="card card--pad stack"
      style={{ gap: 12, background: "var(--sf)" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        // 체결 보고는 의뢰자에게 확인 요청이 가는 바깥 동작이라 확인 창에서 처리한다 (시안 검토판 c-req-won~rep)
        const done = await confirm({
          title: "계약 체결을 보고할까요?",
          body: (
            <div className="stack" style={{ gap: 10 }}>
              <p>보고하면 의뢰자에게 계약 내용 확인 요청이 가고, 의뢰자가 확인하지 않으면 7일 뒤 자동 확정됩니다.</p>
              <dl className="lr-dl">
                <div><dt>체결일</dt><dd className="tnum">{md(date)}</dd></div>
                <div><dt>계약금액</dt><dd className="tnum">{Number(amount).toLocaleString("ko-KR")} (VAT 별도)</dd></div>
              </dl>
            </div>
          ),
          confirmLabel: "체결 보고",
          pendingLabel: "보고하는 중",
          action: async () => {
            const res = await fetch(`/api/awards/${awardId}/contract`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, amount, note, gapReason: gapReason || undefined }) }).catch(() => null);
            if (!res?.ok) throw new Error("저장하지 못했어요. 다시 눌러 주세요. 입력한 내용은 그대로 있어요.");
          },
        });
        if (done) router.refresh();
      }}
    >
      <b style={{ fontSize: 14, fontWeight: 700 }}>계약 체결 보고</b>
      <div className="grid2">
        <div className="fld">
          <label className="fld__lab" htmlFor={`d-${awardId}`}>체결일<span className="req">*</span></label>
          <input id={`d-${awardId}`} className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="fld">
          <label className="fld__lab" htmlFor={`a-${awardId}`}>계약금액 (VAT 별도)<span className="req">*</span></label>
          <div className="numin">
            <input id={`a-${awardId}`} type="text" inputMode="numeric" value={amount ? Number(amount).toLocaleString("ko-KR") : ""} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 13))} placeholder="금액" />
            <span>원</span>
          </div>
        </div>
      </div>
      <GapReasonField id={`g-${awardId}`} quoteAmount={quoteAmount} amount={amount} reason={gapReason} onReason={setGapReason} />
      <div className="fld">
        <label className="fld__lab" htmlFor={`n-${awardId}`}>비고{gapReason === "other" && <span className="req">*</span>}</label>
        <input id={`n-${awardId}`} className="inp" style={{ height: 44 }} value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="예: 항목 일부 조정, 착수 예정일" />
      </div>
      <button type="submit" className="b1" disabled={!ok}>체결 보고</button>
    </form>
  );
}
