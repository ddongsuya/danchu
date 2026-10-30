import type { Metadata } from "next";
import { KindStart } from "@/components/site/KindStart";
import "../page.css";

export const metadata: Metadata = {
  title: "효력시험 견적 요청 · 단추",
  description: "질환 영역과 아는 조건만 적으면 기관이 시험 설계와 견적을 함께 회신해요. 로그인 없이 작성하고 보내기 직전에 이메일만 확인합니다.",
};

export default function Page() {
  return <KindStart kind="pd" />;
}
