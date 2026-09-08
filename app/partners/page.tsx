import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "../home.css";

export const metadata: Metadata = { title: "협력기관 — 단추" };

export default function Partners() {
  return (
    <div className="site">
      <SiteHeader />
      <main style={{ flex: 1 }}>
        <section className="sub">
          <p className="eyebrow">협력기관</p>
          <h1 className="sub__title">클러스터·협회와 함께 준비하고 있습니다</h1>
          <p className="sub__lead">
            바이오 클러스터, 산업 협회, 창업 지원기관과 제휴해 입주 기업과 회원사가 비임상 시험 견적을 더 쉽게 받을 수 있도록 준비 중입니다. 제휴 기관은 확정되는 대로 이곳에 안내합니다.
          </p>
          <div className="partners" style={{ margin: "32px 0 40px" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="partner">준비 중</div>
            ))}
          </div>
          <div className="ctacard">
            <div>
              <h2>제휴를 제안해 주세요</h2>
              <p>기관 소속 기업·회원 대상 안내, 공동 세미나, 요청서 표준화 협력을 논의합니다.</p>
            </div>
            <a href="mailto:hello@danchu.kr?subject=%5B%EB%8B%A8%EC%B6%94%5D%20%EC%A0%9C%ED%9C%B4%20%EC%A0%9C%EC%95%88" className="btn btn--pill btn--lg">제휴 문의</a>
          </div>
          <p style={{ margin: "24px 0 0", fontSize: 14, color: "var(--muted)" }}>
            시험기관(CRO) 참여는 <Link href="/for-cro">CRO 참여 안내</Link>를 봐 주세요.
          </p>
        </section>
      </main>
      <SiteFooter current="/partners" />
    </div>
  );
}
