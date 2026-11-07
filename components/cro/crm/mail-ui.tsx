"use client";

/**
 * 메일 기록 주소로 들어왔지만 안건·담당자를 찾지 못한 메일 (0038). 안건에 붙이거나, 보낸 사람을 담당자로 추가하거나, 지운다.
 */
import { useState } from "react";
import { Err, useSend, type Opt } from "./forms";

export function MailReview({ id, from, deals, companies }: { id: string; from: string; deals: (Opt & { companyId: string | null })[]; companies: Opt[] }) {
  const { busy, err, send } = useSend();
  const [mode, setMode] = useState<"deal" | "contact" | null>(null);
  const [pick, setPick] = useState("");
  const name = from.split("@")[0] ?? "";
  if (!mode) {
    return (
      <div className="cx-mail__acts">
        <button type="button" className="b1 bsm" onClick={() => { setMode("deal"); setPick(deals[0]?.id ?? ""); }} disabled={!deals.length}>안건에 붙이기</button>
        <button type="button" className="b2 bsm" onClick={() => { setMode("contact"); setPick(companies[0]?.id ?? ""); }} disabled={!companies.length}>담당자로 추가</button>
        <button type="button" className="crm-lk" disabled={busy} onClick={() => send("mail-review", "POST", { id, drop: true })}>지우기</button>
        <Err msg={err} />
      </div>
    );
  }
  return (
    <div className="cx-mail__acts">
      <label className="sr-only" htmlFor={`mr-${id}`}>{mode === "deal" ? "안건" : "고객사"}</label>
      <select id={`mr-${id}`} className="sel sel--sm" value={pick} onChange={(e) => setPick(e.target.value)}>
        {(mode === "deal" ? deals : companies).map((o) => <option key={o.id} value={o.id}>{o.name}{o.sub ? ` · ${o.sub}` : ""}</option>)}
      </select>
      <button type="button" className="b1 bsm" disabled={busy || !pick} onClick={() => send("mail-review", "POST", mode === "deal" ? { id, deal_id: pick } : { id, company_id: pick, name })}>{busy ? "저장 중" : mode === "deal" ? "붙이기" : "추가"}</button>
      <button type="button" className="crm-lk" onClick={() => setMode(null)}>취소</button>
      <Err msg={err} />
    </div>
  );
}
