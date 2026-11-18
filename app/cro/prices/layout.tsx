import { PlanGate } from "@/components/cro/plan/PlanLock";

/** 요금제 기능 잠금 (0044, lib/plans.ts). 단가표는 견적서 작성 툴과 같이 쓴다 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PlanGate feature="quote_tool">{children}</PlanGate>;
}
