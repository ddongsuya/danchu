import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import { StudyFork } from "@/components/site/StudyFork";
import "./page.css";

export const metadata: Metadata = {
  title: "견적 요청 시작 · 단추",
  description: "독성, 효력, 약동학, 개별 분석 중 받을 견적을 고르고 요청서를 시작하세요. 로그인 없이 작성하고 보내기 직전에 이메일만 확인합니다.",
};

/** 견적 요청 첫 화면: Tox / PD / PK / Other 네 갈래. 고른 종류에 맞는 요청서로 이어진다 */
export default function Page() {
  return (
    <Site cue={false}>
      <section className="rqf" aria-labelledby="t">
        <h1 id="t">어떤 시험의 견적을 받을까요?</h1>
        <StudyFork />
      </section>
    </Site>
  );
}
