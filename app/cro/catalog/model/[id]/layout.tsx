import { PlanGate } from "@/components/cro/plan/PlanLock";

/** 모델 표준 설계는 단가표로 표준가를 계산한다. 단가표와 같은 요금제 기능 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PlanGate feature="quote_tool">{children}</PlanGate>;
}
