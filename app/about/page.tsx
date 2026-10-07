import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RfqLink } from "@/components/RfqLink";
import "../site.css";

export const metadata: Metadata = {
  title: "서비스 소개 · 단추",
  description: "비임상 시험의 견적과 계약을 한곳에서. 의뢰자가 한 번 요청하면 여러 기관이 같은 양식으로 회신하고, 항목별로 나란히 비교해 기관을 고릅니다.",
};

const PAIN: [string, string][] = [
  ["기관마다 따로 설명", "같은 시험을 기관 수만큼 설명하고, 같은 질문을 기관 수만큼 받습니다."],
  ["양식이 달라 나란히 놓을 수 없음", "포함 항목과 단위가 달라 총액만 비교하게 됩니다."],
  ["견적서 자체를 받기 어려움", "담당자를 찾고 답을 기다리는 시간이 시험보다 먼저 듭니다."],
  ["물질 정보가 흩어짐", "메일과 첨부가 기관마다 흩어져 기밀 관리가 어렵습니다."],
];

const SAME: [string, string][] = [
  ["항목별 금액", "요청서의 시험 항목이 그대로 행이 됩니다. VAT 별도."],
  ["리드타임", "동물 입고일부터 최종보고서(안) 발행일까지, 주 단위."],
  ["기본 포함 항목", "임상병리, 조직병리, TK 분석, 조제물분석, 통계분석, QA 점검, 영문 보고서, 시험물질 보관."],
  ["설계 요약", "동물종·계통, 군 구성, 회복기간, 투여경로와 빈도, 시험법."],
  ["기관마다 다른 부분", "가이드라인이 정하지 않은 것은 기관의 설명을 그대로 나란히 보여 줍니다."],
  ["GLP 대응 · 유효기간 · 착수 가능일 · 결제 조건", "제출처와 보유 인증을 짝지어 대응 여부를 표시합니다."],
];

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
      <main>
        <section className="ph">
          <div className="wrap ph__grid">
            <span className="ph__k">서비스 소개</span>
            <h1>비임상 시험의 견적과 계약을 한곳에서 처리하는 발주 플랫폼</h1>
            <p className="ph__lead">의뢰자가 한 번 요청하면 여러 기관이 같은 양식으로 회신하고, 의뢰자는 항목별로 나란히 비교해 기관을 고릅니다. 어떤 시험이 필요한지부터 막막하면, 상황을 답하고 공개 가이드라인에 근거한 제안을 받습니다.</p>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>지금의 견적은 왜 어려운가</h2></div>
            <div className="doc__body">
              <dl className="dl">
                {PAIN.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </div>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>같은 양식에 담기는 것</h2>
              <p>기관의 회신은 모두 이 칸에 들어옵니다.</p>
            </div>
            <div className="doc__body">
              <dl className="dl dl--wide">
                {SAME.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <p>정본은 기관이 첨부한 PDF 견적서입니다. 비교표와 PDF가 다르면 PDF가 우선하고, 불일치가 있으면 단추가 확인을 요청합니다.</p>
            </div>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>하는 일과 하지 않는 일</h2></div>
            <div className="doc__body">
              <div className="pair">
                <div>
                  <h3>하는 일</h3>
                  <ul>
                    <li><b>필요한 시험 제안</b> · 상황을 묻고 가이드라인 근거와 함께 제안합니다</li>
                    <li><b>같은 양식의 요청서 배포</b> · 수행 분야가 맞는 승인 기관에 전달합니다</li>
                    <li><b>회신 검수와 비교표</b> · 기한이 지나면 회신을 검수한 뒤 공개합니다</li>
                    <li><b>기밀 관리</b> · CDA 등급에 따라 회사명과 첨부를 가립니다</li>
                    <li><b>기록</b> · 접수부터 계약 보고까지 시각과 함께 남깁니다</li>
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
              </div>
            </div>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>원칙</h2></div>
            <div className="doc__body">
              <dl className="dl dl--num">
                {PRINCIPLES.map(([k, v], i) => <div key={k}><dt data-n={String(i + 1).padStart(2, "0")}>{k}</dt><dd>{v}</dd></div>)}
              </dl>
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
