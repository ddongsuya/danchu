import Link from "next/link";
import { PlanPicker } from "./PlanPicker";
import { PAID_FROM } from "@/lib/billing";
import { PLANS, inPilotPeriod, monthlyQuoteLimit, pendingPlan, planOn, seatLimit, type PlanId } from "@/lib/plans";

export type OrgPlanState = { plan: PlanId; plan_next: PlanId | null; plan_next_from: string | null };
const day = (d: string) => `${Number(d.slice(0, 4))}.${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

/** 요금제 탭: 지금 요금제·사용량과 요금제 고르기 (app/cro/billing, design-preview/cro-plan 공통) */
export function PlanView({ org, today, seats, sent, owner }: { org: OrgPlanState; today: string; seats: number; sent: number; owner: boolean }) {
  const pilot = inPilotPeriod(today);
  const cur = planOn(org, today);
  const pend = pendingPlan(org, today);
  const seatCap = seatLimit(org, today);
  const quoteCap = monthlyQuoteLimit(org, today);
  const [py, pm] = PAID_FROM.split("-").map(Number);
  const full = quoteCap != null && sent >= quoteCap;

  return (
    <>
      {full && <p className="pln-alert tnum" role="status">이번 달 5,000만 원 미만 견적 {quoteCap}건 모두 송부, 다음 달 1일 초기화</p>}
      <section className="pln-cur" aria-labelledby="pln-cur-h">
        <p className="pln-cur__k">현재 요금제</p>
        <h2 id="pln-cur-h">{pilot ? "시범 운영" : PLANS[cur].name}<small className="tnum">{pilot ? "무료" : PLANS[cur].price ? `${PLANS[cur].price / 10_000}만 원/월` : "0원"}</small></h2>
        <dl className="pln-cur__kv tnum">
          {pilot ? (
            <div>
              <dt>{py}년 {pm}월부터</dt>
              <dd>{org.plan_next ? PLANS[org.plan_next].name : "미선택"}{!org.plan_next && <span className="pill pill--warn">선택 필요</span>}</dd>
            </div>
          ) : pend ? (
            <div><dt>{day(pend.from)}부터</dt><dd>{PLANS[pend.plan].name}</dd></div>
          ) : null}
          <div><dt>이번 달 5,000만 원 미만 견적</dt><dd>{quoteCap == null ? `${sent}건` : `${sent} / ${quoteCap}건`}</dd></div>
          <div><dt>담당자 계정</dt><dd>{seatCap == null ? `${seats}명` : `${seats} / ${seatCap}명`}</dd></div>
          <div><dt>결제 수단</dt><dd>등록 전</dd></div>
        </dl>
      </section>
      <section className="pln-pick" aria-labelledby="pln-pick-h">
        <h2 id="pln-pick-h">{pilot ? `${py}년 ${pm}월부터 쓸 요금제` : "요금제"}</h2>
        <PlanPicker org={org} today={today} canEdit={owner} />
        <p className="pln-fine"><Link href="/pricing">요금제 비교</Link></p>
      </section>
    </>
  );
}
