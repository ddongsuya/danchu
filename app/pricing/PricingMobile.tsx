"use client";

import { useState } from "react";
import { Check, CaretDown } from "@phosphor-icons/react";
import { PLANS, PLAN_IDS, type PlanId } from "@/lib/plans";
import { FAQ, FEE_NOTE, FEE_ROWS, PLAN_META, priceOf } from "./data";

type Tab = "plans" | "fees" | "faq";
const TABS: [Tab, string][] = [["plans", "요금제"], ["fees", "수수료"], ["faq", "자주 묻는 질문"]];

/** 휴대폰 요금제: 한 화면 안에서 탭(요금제·수수료·질문)과 요금제 고르기 */
export function PricingMobile() {
  const [tab, setTab] = useState<Tab>("plans");
  const [plan, setPlan] = useState<PlanId>("pro");
  const p = PLANS[plan];
  return (
    <div className="prm">
      <div className="prm-h">
        <h1 id="pr-mh">무료로 시작하고,<br />필요할 때 바꾸세요.</h1>
        <p className="tnum">의뢰자는 무료로 이용해요. 2027년 12월 31일까지 전 요금제를 무료로 이용해요.</p>
      </div>
      <div className="prm-tabs" role="tablist" aria-label="요금 안내">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`prm-t-${id}`} aria-controls={`prm-p-${id}`} aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === "plans" && (
        <div className="prm-body" role="tabpanel" id="prm-p-plans" aria-labelledby="prm-t-plans">
          <div className="prm-seg" role="radiogroup" aria-label="요금제">
            {PLAN_IDS.map((id) => <button key={id} type="button" role="radio" aria-checked={plan === id} onClick={() => setPlan(id)}>{PLANS[id].name}</button>)}
          </div>
          <div className="prm-plan">
            <p className="pr-price tnum"><b>{priceOf(plan)}</b>{p.price ? <span>/월</span> : null}</p>
            <p className="pr-terms">{PLAN_META[plan].terms}</p>
            <ul className="pr-feat">{p.items.map((it) => <li key={it}><Check size={16} weight="bold" aria-hidden="true" />{it}</li>)}</ul>
            <a className={plan === "pro" ? "btn solid prm-cta" : "btn ghost prm-cta"} href="/signup/cro">참여 신청</a>
          </div>
        </div>
      )}
      {tab === "fees" && (
        <div className="prm-body" role="tabpanel" id="prm-p-fees" aria-labelledby="prm-t-fees">
          <p className="prm-lead">5,000만 원 이상 견적에만 붙어요. 요금제와 관계없이 같아요.</p>
          <table className="prm-fee tnum">
            <thead><tr><th scope="col">금액 구간</th><th scope="col">송부</th><th scope="col">성사</th></tr></thead>
            <tbody>{FEE_ROWS.map((r) => <tr key={r[0]}><th scope="row">{r[0]}</th><td>{r[1]}</td><td>구간의 {r[2]}</td></tr>)}</tbody>
          </table>
          <p className="prm-fine tnum">{FEE_NOTE}</p>
        </div>
      )}
      {tab === "faq" && (
        <div className="prm-body" role="tabpanel" id="prm-p-faq" aria-labelledby="prm-t-faq">
          <div className="pr-faq">
            {FAQ.map((f, i) => <details key={f.q} open={i === 0}><summary>{f.q}<CaretDown size={18} aria-hidden="true" /></summary><p>{f.a}</p></details>)}
          </div>
        </div>
      )}
    </div>
  );
}
