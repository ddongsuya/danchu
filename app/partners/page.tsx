import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import "./page.css";

export const metadata: Metadata = {
  title: "협력기관 · 단추",
  description: "바이오 클러스터, 협회, 창업 지원기관과의 제휴를 준비하고 있어요.",
};

export default function Partners() {
  return (
    <Site current="/partners" next={{ href: "/for-cro", label: "기관 참여 안내" }}>
      <section className="ph" aria-labelledby="t">
        <div><h1 id="t">더 많은 연구 현장에<br /><span>단추를 잇고 있어요.</span></h1></div>
        <div><p className="lead">입주 기업과 회원사가 비임상 견적을 더 쉽게 받을 수 있도록 제휴를 준비하고 있어요.</p></div>
      </section>
      <section className="sec" aria-labelledby="h">
        <div className="sh"><h2 id="h">함께 할 수 있는 일</h2><p className="lead">제휴 문의는 <a href="mailto:hello@danchu.kr?subject=%ED%98%91%EB%A0%A5%EA%B8%B0%EA%B4%80%20%EC%A0%9C%ED%9C%B4%20%EB%AC%B8%EC%9D%98">hello@danchu.kr</a>로 보내주세요.</p></div>
        <dl className="rows">
          <div><dt>입주 기업 안내</dt><dd>입주 기업 안내 자료를 함께 만들어요.</dd></div>
          <div><dt>기관 참여 연결</dt><dd>지역 기관의 참여 신청과 카탈로그 등록을 도와요.</dd></div>
          <div><dt>교육</dt><dd>시험 구성과 가이드라인 설명회를 함께 열어요.</dd></div>
        </dl>
      </section>
    </Site>
  );
}
