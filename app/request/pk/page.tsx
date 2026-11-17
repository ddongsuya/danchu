import type { Metadata } from "next";
import { pageMeta } from "@/lib/share-meta";
import { KindStart } from "@/components/site/KindStart";
import "../page.css";

export const metadata: Metadata = pageMeta(
  "약동학시험 견적 요청 · 단추",
  "PK, ADME, 생체시료 분석 중 필요한 시험을 골라 요청서를 시작하세요. 로그인 없이 작성하고 보내기 직전에 이메일만 확인해요.",
  "/request/pk",
  ["약동학시험 견적", "PK 시험 견적", "비임상 CRO 견적"],
);

export default function Page() {
  return <KindStart kind="pk" />;
}
