import { PlanGate } from "@/components/cro/plan/PlanLock";

/** 요금제 기능 잠금 (0044, lib/plans.ts). 시범 운영 중에는 열려 있다 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PlanGate feature="quote_tool">{children}</PlanGate>;
}
