import type { Metadata } from "next";
import { pageMeta } from "@/lib/share-meta";
import { KindStart } from "@/components/site/KindStart";
import "../page.css";

export const metadata: Metadata = pageMeta(
  "개별 분석 견적 요청 · 단추",
  "임상병리, 조직병리, 유전자 분석처럼 필요한 분석만 골라 견적을 요청해요. 로그인 없이 작성하고 보내기 직전에 이메일만 확인해요.",
  "/request/other",
  ["임상병리 분석 견적", "조직병리 견적", "비임상 CRO 견적"],
);

export default function Page() {
  return <KindStart kind="other" />;
}
