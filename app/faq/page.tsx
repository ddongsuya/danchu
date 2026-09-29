import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FaqList } from "@/components/site/FaqList";
import "../site.css";

export const metadata: Metadata = {
  title: "자주 묻는 질문 · 단추",
  description: "비용, 필요한 시험, 회신 기한, 기밀, 비교표, 계약, 기관 참여에 대한 답.",
};

export default function Faq() {
  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content">
        <section className="ph">
          <div className="wrap ph__grid">
            <span className="ph__k">자주 묻는 질문</span>
            <h1>비용, 기한, 기밀, 비교표, 계약</h1>
            <p className="ph__lead">여기 없는 질문은 <a href="mailto:hello@danchu.kr">hello@danchu.kr</a>로 보내 주세요.</p>
          </div>
        </section>
        <section className="doc doc--tight">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>전체</h2></div>
            <div className="doc__body"><FaqList /></div>
          </div>
        </section>
      </main>
      <SiteFooter current="/faq" />
    </div>
  );
}
