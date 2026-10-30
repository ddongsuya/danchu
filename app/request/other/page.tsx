import type { Metadata } from "next";
import { KindStart } from "@/components/site/KindStart";
import "../page.css";

export const metadata: Metadata = {
  title: "개별 분석 견적 요청 · 단추",
  description: "임상병리, 조직병리, 유전자 분석처럼 필요한 분석만 골라 맡기세요. 로그인 없이 작성하고 보내기 직전에 이메일만 확인합니다.",
};

export default function Page() {
  return <KindStart kind="other" />;
}
