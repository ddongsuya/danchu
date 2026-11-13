import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { todaySeoul } from "@/lib/format";
import { FEATURE_LABEL, PLANS, canUse, planFor, type PlanFeature } from "@/lib/plans";
import "./plan.css";

/** 요금제에 없는 기능 화면. 시범 운영 중이거나 요금제에 있으면 children 을 그대로 보인다 */
export async function PlanGate({ feature, children }: { feature: PlanFeature; children: React.ReactNode }) {
  const s = await requireSession("cro");
  if (!s.org || s.org.status !== "approved" || canUse(s.org, feature, todaySeoul())) return <>{children}</>;
  const need = PLANS[planFor(feature)];
  return (
    <section className="pln-lock" aria-labelledby="pln-lock-h">
      <h1 id="pln-lock-h">{FEATURE_LABEL[feature]}</h1>
      <p>{need.name}{need.id === "plus" ? "·Pro" : ""} 요금제 기능</p>
      <Link className="btn btn--next" href="/cro/billing">요금제 바꾸기</Link>
    </section>
  );
}
