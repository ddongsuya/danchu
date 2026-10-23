import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RfqLink } from "@/components/RfqLink";
import { FlowFilm } from "@/components/site/FlowFilm";
import { ScatterFilm } from "@/components/site/ScatterFilm";
import { FormFilm } from "@/components/site/FormFilm";
import { Reveal } from "@/components/site/Reveal";
import "@/components/site/flow-film.css";
import "../site.css";

export const metadata: Metadata = {
  title: "서비스 소개 · 단추",
  description: "비임상 시험의 견적과 계약을 한곳에서. 의뢰자가 한 번 요청하면 여러 기관이 같은 양식으로 회신하고, 항목별로 나란히 비교해 기관을 고릅니다.",
};

const PRINCIPLES: [string, string][] = [
  ["근거를 보여 준다", "안내와 제안에는 출처 조항이 따라붙습니다. ICH, 식약처 고시, OECD 시험법."],
  ["중립을 지킨다", "기관마다 다른 것은 나란히 보여 주고, 단추가 기준을 정하거나 특정 기관을 권하지 않습니다."],
  ["의뢰자와 기관을 같은 무게로", "한쪽의 편의를 위해 다른 쪽의 화면을 희생하지 않습니다."],
  ["아는 만큼만 말한다", "확인하지 못한 것은 확인 필요로 표시하고, 없는 사례와 수치를 만들지 않습니다."],
  ["작은 화면에서도 일을 끝낼 수 있게", "요청서 작성부터 비교표까지 휴대전화에서 끝낼 수 있습니다."],
];

export default function About() {
  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content">
        <section className="ph">
          <div className="wrap ph__grid">
            <span className="ph__k">서비스 소개</span>
            <h1>비임상 시험의 견적과 계약을 한곳에서 처리하는 발주 플랫폼</h1>
            <p className="ph__lead">의뢰자가 한 번 요청하면 여러 기관이 같은 양식으로 회신하고, 의뢰자는 항목별로 나란히 비교해 기관을 고릅니다. 어떤 시험이 필요한지부터 막막하면, 상황을 답하고 공개 가이드라인에 근거한 제안을 받습니다.</p>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>요청 한 건이 흐르는 길</h2>
              <p>접수부터 계약 완료까지 7단계. 단계별 공개 범위는 <Link href="/how-it-works">이용 안내</Link>에 있습니다.</p>
            </div>
            <div className="doc__body"><FlowFilm /></div>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>지금의 견적은 왜 어려운가</h2>
              <p>기관마다 따로 묻고, 제각각인 답을 받습니다.</p>
            </div>
            <div className="doc__body"><ScatterFilm /></div>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>같은 양식에 담기는 것</h2>
              <p>기관의 회신은 모두 이 칸에 들어옵니다.</p>
            </div>
            <div className="doc__body">
              <FormFilm />
              <p>정본은 기관이 첨부한 PDF 견적서입니다. 비교표와 PDF가 다르면 PDF가 우선하고, 불일치가 있으면 단추가 확인을 요청합니다. 기관이 PDF만 보낸 경우 단추가 옮겨 정리한 칸에는 &lsquo;단추 정리 · 기관 PDF 기준&rsquo;이 표시됩니다.</p>
            </div>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>하는 일과 하지 않는 일</h2></div>
            <div className="doc__body">
              <Reveal className="pair">
                <div>
                  <h3>하는 일</h3>
                  <ul>
                    <li><b>필요한 시험 제안</b> · 상황을 묻고 가이드라인 근거와 함께 제안합니다</li>
                    <li><b>같은 양식의 요청서 배포</b> · 수행 분야가 맞는 승인 기관에 참여 안내를 보냅니다</li>
                    <li><b>회신 취합과 비교표</b> · 도착한 견적을 같은 양식으로 정리하고, 회신 기한이 지나거나, 참여 결정이 끝난 뒤 참여한 기관이 모두 제출하면 비교표를 엽니다</li>
                    <li><b>기밀 관리</b> · 회사명과 연락처는 선정한 기관에만 공개하고, CDA 등급이면 첨부도 체결 확인 뒤 공개합니다</li>
                    <li><b>기록</b> · 접수부터 선정, 계약 확인까지 시각과 함께 남깁니다</li>
                  </ul>
                </div>
                <div>
                  <h3>하지 않는 일</h3>
                  <ul>
                    <li><b>특정 기관 추천, 최저가 권유</b> · 정렬 기준은 의뢰자가 고릅니다</li>
                    <li><b>기관 간 견적 공개</b> · 비교표는 의뢰자에게만 갑니다</li>
                    <li><b>설계 기준 결정</b> · 가이드라인이 정하지 않은 것은 기관의 방식을 그대로 보여 줍니다</li>
                    <li><b>계약 조건 개입</b> · 계약은 의뢰자와 기관이 직접 합니다</li>
                    <li><b>의뢰자 비용 청구</b></li>
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>원칙</h2></div>
            <div className="doc__body">
              <Reveal>
                <dl className="dl dl--num">
                  {PRINCIPLES.map(([k, v], i) => <div key={k}><dt data-n={String(i + 1).padStart(2, "0")}>{k}</dt><dd>{v}</dd></div>)}
                </dl>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="doc doc--tight">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>지금 할 수 있는 것</h2></div>
            <div className="doc__body">
              <p>제안 받기는 합성의약품, 바이오의약품, 세포·유전자치료제, 건강기능식품, 화장품, 의료기기, 화학물질·농약을 지원합니다. 제안 규칙은 초안이며 실무 검토 전입니다. 효력시험 구조, 질의응답과 재견적, 회사 단위 계정, 계약 이후의 시험 진행 관리는 아직 없습니다.</p>
              <div className="hero__cta">
                <RfqLink className="b b--fill">견적 요청하기</RfqLink>
                <Link href="/for-cro" className="b b--line">기관 참여 안내</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter current="/about" />
    </div>
  );
}
