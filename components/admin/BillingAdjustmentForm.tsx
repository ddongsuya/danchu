"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseAdjustmentAmount } from "@/lib/billing";

type Field = "orgId" | "amount" | "reason" | "correctsMonth";

/**
 * 청구 조정 항목 넣기 (0024). 열린 달 명세에만 보인다. 마감한 달을 바로잡는 금액은 이 달에 조정 항목으로 넣는다.
 * 금액은 원 단위(돌려줄 금액은 앞에 -), 사유는 필수, 바로잡는 달은 이 달보다 앞선 마감한 달 중에서 고른다 (선택, 기본은 지정하지 않음).
 * 이 달을 마감하면 넣은 항목은 바꾸거나 지울 수 없다
 */
export function BillingAdjustmentForm({ month, orgs, closedMonths }: { month: string; orgs: { id: string; name: string }[]; closedMonths: string[] }) {
  const router = useRouter();
  const [orgId, setOrgId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [corrects, setCorrects] = useState("");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Partial<Record<Field, string>>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (orgs.length === 0) return <p className="empty">조정 항목을 넣을 기관이 없습니다. 승인된 기관이 생기면 여기에 나옵니다.</p>;

  const check = (): Partial<Record<Field, string>> => {
    const e: Partial<Record<Field, string>> = {};
    if (!orgId) e.orgId = "기관을 골라 주세요.";
    if (parseAdjustmentAmount(amount) == null) e.amount = "원 단위 숫자로 적어 주세요. 돌려줄 금액은 앞에 -를 붙이고, 0원은 넣을 수 없습니다.";
    if (!reason.trim()) e.reason = "조정 사유를 적어 주세요.";
    else if (reason.trim().length > 300) e.reason = "300자 안으로 적어 주세요.";
    return e;
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    const e = check();
    setErrs(e);
    setMsg(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/billing/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, orgId, amount: parseAdjustmentAmount(amount), reason: reason.trim(), correctsMonth: corrects || null }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string; field?: Field | "month" };
      if (!r.ok) {
        if (d.field && d.field !== "month") setErrs({ [d.field]: d.error || "확인해 주세요." });
        else setMsg({ ok: false, text: d.error || "조정 항목을 넣지 못했습니다." });
        return;
      }
      setMsg({ ok: true, text: d.message || "조정 항목을 넣었습니다." });
      setAmount("");
      setReason("");
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "연결이 끊겨 넣지 못했습니다. 다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  };

  const err = (f: Field) => (errs[f] ? <span id={`adj-${f}-err`} className="fld__err" role="alert">{errs[f]}</span> : null);
  const desc = (f: Field, help?: string) => [help, errs[f] ? `adj-${f}-err` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <form className="billadj" onSubmit={save} noValidate>
      <div className="billadj__grid">
        <div className="fld">
          <label className="fld__lab" htmlFor="adj-orgId">기관</label>
          <select id="adj-orgId" className="sel" value={orgId} onChange={(e) => setOrgId(e.target.value)} aria-invalid={!!errs.orgId || undefined} aria-describedby={desc("orgId")}>
            <option value="">기관 고르기</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {err("orgId")}
        </div>
        <div className="fld">
          <label className="fld__lab" htmlFor="adj-amount">금액 (원)</label>
          <input id="adj-amount" className="inp tnum" inputMode="text" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: -120000" aria-invalid={!!errs.amount || undefined} aria-describedby={desc("amount", "adj-amount-help")} />
          <span id="adj-amount-help" className="fld__help">더 받을 금액은 그대로, 돌려줄 금액은 앞에 -를 붙입니다.</span>
          {err("amount")}
        </div>
        <div className="fld">
          <label className="fld__lab" htmlFor="adj-corrects">바로잡는 마감 월 (선택)</label>
          <select id="adj-corrects" className="sel tnum" value={corrects} onChange={(e) => setCorrects(e.target.value)} aria-invalid={!!errs.correctsMonth || undefined} aria-describedby={desc("correctsMonth")}>
            <option value="">지정하지 않음</option>
            {closedMonths.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {err("correctsMonth")}
        </div>
        <div className="fld billadj__reason">
          <label className="fld__lab" htmlFor="adj-reason">사유</label>
          <textarea id="adj-reason" className="ta" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 9월 명세에 같은 견적이 두 번 잡혀 1건분을 돌려드립니다" aria-invalid={!!errs.reason || undefined} aria-describedby={desc("reason", "adj-reason-help")} />
          <span id="adj-reason-help" className="fld__help">기관 명세에 그대로 나옵니다. 이 달을 마감하면 바꾸거나 지울 수 없습니다.</span>
          {err("reason")}
        </div>
      </div>
      <div className="billadj__actions">
        <button type="submit" className="b1 bsm" disabled={busy} aria-busy={busy || undefined}>{busy ? "넣는 중" : "조정 항목 추가"}</button>
        {msg && <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "billadj__ok" : "billadj__err"}>{msg.text}</span>}
      </div>
    </form>
  );
}
