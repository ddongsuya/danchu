import type { Metadata } from "next";
import { KindStart } from "@/components/site/KindStart";
import "../page.css";

export const metadata: Metadata = {
  title: "독성시험 견적 요청 · 단추",
  description: "필요한 독성시험을 찾거나 시험 항목을 직접 골라 요청서를 시작하세요. 로그인 없이 작성하고 보내기 직전에 이메일만 확인합니다.",
};

export default function Page() {
  return <KindStart kind="tox" />;
}
