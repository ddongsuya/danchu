import type { Metadata } from "next";
import { pageMeta } from "@/lib/share-meta";
import { KindStart } from "@/components/site/KindStart";
import "../page.css";

export const metadata: Metadata = pageMeta(
  "독성시험 견적 요청 · 단추",
  "필요한 독성시험을 찾거나 시험 항목을 직접 골라 요청서를 시작하세요. 비임상 CRO·비임상 시험기관이 같은 양식으로 회신해요. 로그인 없이 작성하고 보내기 직전에 이메일만 확인해요.",
  "/request/tox",
  ["독성시험 견적", "비임상 독성시험", "GLP 독성시험 견적"],
);

export default function Page() {
  return <KindStart kind="tox" />;
}
