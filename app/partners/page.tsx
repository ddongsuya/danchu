import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "../site.css";

export const metadata: Metadata = {
  title: "협력기관 · 단추",
  description: "바이오 클러스터, 협회, 창업 지원기관과의 제휴를 준비하고 있습니다.",
};

export default function Partners() {
  return (
    <div className="site">
      <SiteHeader />
      <main>
        <section className="ph">
          <div className="wrap ph__grid">
            <span className="ph__k">협력기관</span>
            <h1>클러스터, 협회, 창업 지원기관과 함께 준비하고 있습니다</h1>
            <p className="ph__lead">입주 기업과 회원사가 비임상 견적을 같은 양식으로 받을 수 있도록 제휴를 준비합니다. 아직 확정된 협력기관은 없습니다.</p>
          </div>
        </section>
        <section className="doc doc--tight">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>제휴로 할 수 있는 것</h2></div>
            <div className="doc__body">
              <dl className="dl">
                <div><dt>입주 기업 안내</dt><dd>입주 기업과 회원사가 요청서 작성과 제안 받기를 쓸 수 있도록 안내 자료를 함께 만듭니다.</dd></div>
                <div><dt>기관 참여 연결</dt><dd>지역의 비임상 기관이 참여 신청과 카탈로그 등록을 할 수 있도록 연결합니다.</dd></div>
                <div><dt>교육</dt><dd>비임상 시험 구성과 가이드라인 근거에 대한 설명회를 함께 엽니다.</dd></div>
              </dl>
              <p>제휴 문의는 <a href="mailto:hello@danchu.kr?subject=%ED%98%91%EB%A0%A5%EA%B8%B0%EA%B4%80%20%EC%A0%9C%ED%9C%B4%20%EB%AC%B8%EC%9D%98">hello@danchu.kr</a>로 보내 주세요.</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter current="/partners" />
    </div>
  );
}
