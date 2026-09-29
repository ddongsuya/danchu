import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, FileText, ListChecks, Handshake, LockKey, Buildings } from "@phosphor-icons/react/dist/ssr";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RfqLink } from "@/components/RfqLink";
import { HeroAdvisor } from "@/components/site/HeroAdvisor";
import { StudyExplorer } from "@/components/site/StudyExplorer";
import { FaqList } from "@/components/site/FaqList";
import { FAQ } from "@/lib/faq";
import "./site.css";
import "./home.css";

const COMPARISON = [
  ["수행 범위", "가능 여부와 조건부 수행 사항"],
  ["금액과 일정", "항목별 금액, 착수 가능일, 예상 소요기간"],
  ["설계와 포함 항목", "군 구성, 분석 범위, 별도 옵션"],
  ["기관별 조건", "결제 조건, 유효기간, 정식 견적서"],
];

export default function Home() {
  return (
    <div className="site home">
      <SiteHeader />
      <main id="main-content">
        <section className="home-hero">
          <div className="wrap home-hero__grid">
            <div className="home-hero__copy">
              <h1>비임상 시험의 시작,<br /><strong>단추를 채우다.</strong></h1>
              <p>필요한 시험부터 기관별 견적 비교까지.<br />한 번의 요청으로, 연구의 다음 단계를 준비하세요.</p>
              <div className="home-hero__actions">
                <RfqLink className="b b--fill b--lg">견적 요청하기 <ArrowUpRight size={19} aria-hidden="true" /></RfqLink>
                <a href="#fields" className="b b--line b--lg">시험 분야 살펴보기</a>
              </div>
            </div>
            <figure className="home-hero__visual">
              <Image src="/images/lab-glassware.webp" alt="" width={1200} height={800} sizes="(max-width: 899px) 100vw, 48vw" preload />
              <figcaption><span>연구에 집중할 수 있도록.</span><span>견적의 시작부터, 단추</span></figcaption>
            </figure>
          </div>
          <div className="wrap"><div className="home-assurances"><span><Check size={16} aria-hidden="true" /> 의뢰자 이용 무료</span><span><Check size={16} aria-hidden="true" /> 항목별 견적 비교</span><span><LockKey size={16} aria-hidden="true" /> 기밀 등급에 따른 정보 보호</span><Link href="/for-cro">CRO 기관이신가요? <ArrowUpRight size={16} aria-hidden="true" /></Link></div></div>
        </section>

        <section className="home-section" id="fields">
          <div className="wrap">
            <div className="section-heading"><div><h2>어떤 시험을 준비하고 계신가요?</h2><p>시험 분야를 살펴보고, 필요한 항목부터 시작하세요.</p></div><span className="section-count">15개 시험 분야</span></div>
            <StudyExplorer />
          </div>
        </section>

        <section className="home-section home-section--surface" id="process">
          <div className="wrap process-layout">
            <div className="section-intro"><h2>흩어져 있던 견적을,<br />하나의 흐름으로.</h2><p>기관마다 같은 내용을 설명하는 수고를 줄이고, 중요한 조건을 함께 살펴보세요.</p><Link href="/how-it-works" className="text-link">이용 절차 자세히 <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
            <ol className="process-list">
              <li><span className="process-icon"><FileText size={24} aria-hidden="true" /></span><div><h3>요청서는 한 번만</h3><p>시험 항목과 희망 일정을 입력하면, 수행 분야가 맞는 기관에 전달합니다.</p></div></li>
              <li><span className="process-icon"><ListChecks size={24} aria-hidden="true" /></span><div><h3>견적은 같은 자리에서</h3><p>금액, 기간, 설계와 포함 항목을 나란히 살펴보고 직접 비교합니다.</p></div></li>
              <li><span className="process-icon"><Handshake size={24} aria-hidden="true" /></span><div><h3>선택한 기관과 직접 계약</h3><p>기관을 선택하면 담당자 연락처를 확인하고 계약을 진행합니다.</p></div></li>
            </ol>
          </div>
        </section>

        <section className="home-section">
          <div className="wrap comparison-layout">
            <div className="comparison-content"><h2>같은 금액도,<br />같은 견적은 아니니까.</h2><p>총액 뒤에 있는 시험 설계와 포함 범위까지.<br />기관의 회신을 같은 항목으로 정리합니다.</p><div className="comparison-note"><LockKey size={19} aria-hidden="true" /><p>비교표는 의뢰자에게만 공개됩니다.<br />기관은 다른 기관의 견적을 볼 수 없습니다.</p></div><Link href="/how-it-works#comparison" className="text-link">비교 항목 자세히 <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
            <div className="comparison-index"><div className="comparison-index__head"><span>비교표에서 확인하는 것</span><ListChecks size={22} aria-hidden="true" /></div><dl>{COMPARISON.map(([title, description]) => <div key={title}><dt>{title}</dt><dd>{description}</dd><Check size={18} aria-hidden="true" /></div>)}</dl><p>최종 조건은 각 기관의 정식 PDF 견적서를 확인하세요.</p></div>
          </div>
        </section>

        <section className="home-section home-advisor" id="advisor">
          <div className="wrap">
            <details className="advisor-disclosure">
              <summary><div><h2>필요한 시험이 아직 막막하다면.</h2><p>개발 상황을 선택하고, 근거가 붙은 시험 제안을 살펴보세요.</p></div><span className="advisor-disclosure__action">시험 제안 열기 <ArrowRight size={20} aria-hidden="true" /></span></summary>
              <div className="advisor-disclosure__body"><div><h3>상황에 맞는 시작점을 찾으세요.</h3><p>제안은 공개 가이드라인을 바탕으로 한 참고 자료입니다. 규칙은 초안이며, 실제 시험 계획은 기관과 확인해야 합니다.</p><Link href="/guide" className="text-link">시험 가이드 읽기 <ArrowUpRight size={18} aria-hidden="true" /></Link></div><HeroAdvisor /></div>
            </details>
          </div>
        </section>

        <section className="home-section">
          <div className="wrap cro-invitation"><div className="cro-invitation__symbol"><Buildings size={48} weight="light" aria-hidden="true" /></div><div><h2>기관의 전문성이,<br />필요한 연구와 만날 수 있도록.</h2><p>수행 분야에 맞는 요청을 받고, 역량 카탈로그로 회신을 준비하세요.</p></div><Link href="/for-cro" className="b b--line b--lg">기관 참여 안내 <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
        </section>

        <section className="home-section home-faq"><div className="wrap faq-layout"><div className="section-intro"><h2>궁금한 점을<br />먼저 확인하세요.</h2><Link href="/faq" className="text-link">자주 묻는 질문 전체 <ArrowUpRight size={18} aria-hidden="true" /></Link></div><FaqList items={FAQ.slice(0, 4)} /></div></section>
        <section className="home-closing"><div className="wrap"><div><h2>연구의 다음 단계를 열어보세요.</h2><p>첫 견적 요청부터, 단추와 함께.</p></div><RfqLink className="b b--fill b--lg">견적 요청하기 <ArrowUpRight size={19} aria-hidden="true" /></RfqLink></div></section>
      </main>
      <SiteFooter />
    </div>
  );
}
