import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RfqLink } from "@/components/RfqLink";
import { FigBeforeAfter, FigMapping, FigConfidential } from "@/components/about/Figures";
import "../home.css";

export const metadata: Metadata = {
  title: "서비스 소개 — 단추",
  description: "비임상 시험 견적을 받는 과정이 왜 불편한지, 단추가 무엇을 바꾸는지 설명합니다.",
};

/** 의뢰자가 지금 겪는 불편 */
const PAINS: [string, string][] = [
  ["CRO마다 따로 연락해야 합니다", "같은 시험물질, 같은 목적을 기관마다 메일과 전화로 다시 설명합니다. 회신은 제각각 도착하고, 어디까지 진행됐는지 스스로 관리해야 합니다."],
  ["견적서 양식이 달라 비교가 안 됩니다", "한 곳은 조직병리를 포함하고 한 곳은 별도 옵션입니다. 총액이 낮아 보여도 빠진 항목을 더하면 결과가 뒤집힙니다. 항목·기간·단가 기준이 달라 표 하나로 정리되지 않습니다."],
  ["무슨 시험이 필요한지부터 막힙니다", "허가 단계와 제출처에 따라 필요한 시험 패키지가 다른데, 처음이면 기준을 잡기 어렵습니다. 결국 먼저 연락한 CRO의 설명에 의존하게 됩니다."],
  ["기밀이 걱정됩니다", "견적을 받으려면 물질 정보를 여러 곳에 보내야 합니다. 어느 기관과 비밀유지계약을 맺었는지, 무엇을 보냈는지 관리가 흩어집니다."],
];

/** 시험기관(CRO)이 겪는 불편 */
const CRO_PAINS: [string, string][] = [
  ["요청서마다 형식이 다릅니다", "메일로 온 요청을 매번 다시 해석해 항목을 정리하고 견적서를 새로 짭니다. 정작 필요한 정보가 빠져 있어 되묻는 일이 반복됩니다."],
  ["영업으로 찾아야 합니다", "어느 기업이 지금 비임상을 준비하는지 알 길이 없어 발로 뛰어야 하고, 견적을 내고도 결과를 듣지 못하는 경우가 많습니다."],
];

/** 단추가 바꾸는 것 */
const SOLVES: [string, string][] = [
  ["표준 양식 하나로 요청", "국내 주요 CRO 여섯 곳의 문의 양식을 합쳐 만든 표준 요청서에 한번만 입력합니다. 대분류만 고르고 상황을 적어도 되고, 아는 조건은 더 쓸 수 있습니다."],
  ["수행 가능한 기관에만 배포", "등록된 CRO의 수행 분야와 GLP 인증을 보고 맞는 기관에만 전달합니다. 기밀 등급을 지정하면 비밀유지계약을 체결한 기관에만 보내고, 그 전까지 회사명은 가려집니다."],
  ["같은 형식의 비교표", "CRO는 요청서에서 자동으로 만들어진 항목 행에 가능 여부·금액·기간만 채웁니다. 의뢰자는 총액, 항목별 금액, 기본 포함 항목, 제출처에 맞는 GLP 인증 여부를 한 표에서 봅니다. 정본은 CRO가 첨부한 PDF 견적서입니다."],
  ["선택까지 한곳에서", "비교표에서 고르면 그 기관에만 연락처가 열리고 계약은 직접 진행합니다. 접수부터 계약까지의 진행 상황을 한 화면에서 확인합니다."],
];

const TRUST = [
  { l: "무료", t: "의뢰자 비용 없음", p: "견적 요청과 비교표 수령까지 의뢰자에게 비용을 청구하지 않습니다." },
  { l: "기밀", t: "CDA 체결 후 전달", p: "기밀 등급을 지정하면 비밀유지계약을 체결한 CRO에만 요청서를 전달합니다." },
  { l: "공정", t: "특정 CRO 추천하지 않음", p: "비교표는 사실 기준으로만 정리합니다. 선택은 의뢰자가 합니다." },
];

export default function About() {
  return (
    <div className="site">
      <SiteHeader />
      <main style={{ flex: 1 }}>
        <section className="sub">
          <p className="eyebrow">서비스 소개</p>
          <h1 className="sub__title">
            여러 조각을 하나로.
            <br />
            비임상 시험 견적을 한 자리에서 비교합니다.
          </h1>
          <p className="sub__lead">
            단추는 비임상 시험을 의뢰하는 연구자와 GLP 인증 CRO를 연결하는 견적 플랫폼입니다. 의뢰자는 표준 양식으로 요청서를 한번만 작성하고, 단추는 이를 수행 가능한 CRO에 배포한 뒤 회신을 같은 형식의 비교표로 정리해 드립니다.
          </p>
        </section>

        <section className="band--soft">
          <div className="sub" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <p className="eyebrow">왜 만들었나</p>
            <h2 className="h2">견적 한 번 받는 데 몇 주가 걸렸습니다</h2>
            <p className="sub__lead">
              비임상 시험은 신약이든 화장품이든 의료기기든 허가로 가는 길목에서 반드시 거쳐야 하고, 한 건에 수천만 원에서 수억 원이 듭니다. 그런데 이 큰 결정을 내리는 과정이 아직도 메일과 전화, 그리고 담당자의 기억에 기대고 있습니다.
            </p>
            <p className="sub__lead">
              CRO 안팎에서 견적을 주고받아 보면 양쪽 모두가 같은 일을 반복하고 있었습니다. 의뢰자는 같은 내용을 기관마다 다시 설명하고, 기관은 형식이 다른 요청을 매번 다시 해석합니다. 그렇게 받은 견적서는 항목 구성이 달라 나란히 놓고 볼 수 없습니다. 총액만 보고 고르거나, 먼저 연락한 곳으로 정해집니다.
            </p>
            <FigBeforeAfter />
            <p className="sub__lead" style={{ margin: "28px 0 0" }}>
              단추는 이 반복을 없애려고 만들었습니다. 요청서와 견적 회신의 양식을 하나로 맞추면, 의뢰자는 한번 쓰고 여러 곳에서 받을 수 있고, 기관은 검증된 요청을 정리된 형태로 받을 수 있습니다. 단추라는 이름은 흩어진 조각을 한 자리에 모아 채운다는 뜻입니다.
            </p>
          </div>
        </section>

        <section className="sub">
          <p className="eyebrow">지금 이런 점이 불편하시죠</p>
          <h2 className="h2">의뢰자가 겪는 일</h2>
          <ol className="pains">
            {PAINS.map(([t, p], i) => (
              <li key={t}>
                <span className="pains__no">0{i + 1}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{p}</p>
                </div>
              </li>
            ))}
          </ol>
          <h2 className="h2" style={{ marginTop: 48 }}>시험기관이 겪는 일</h2>
          <ol className="pains">
            {CRO_PAINS.map(([t, p], i) => (
              <li key={t}>
                <span className="pains__no">0{i + 1}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{p}</p>
                </div>
              </li>
            ))}
          </ol>
          <p style={{ margin: "24px 0 0", fontSize: 15, color: "var(--muted)" }}>
            비임상 경험이 적은 의뢰자일수록 "무슨 시험이 필요한지"에서 막혀 기관의 영업에 의존하게 되고, 이 정보 격차가 양쪽 모두의 비효율을 만듭니다.
          </p>
        </section>

        <section className="band--soft">
          <div className="sub" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <p className="eyebrow">단추가 긁어 드리는 곳</p>
            <h2 className="h2">한번 입력하면 이렇게 바뀝니다</h2>
            <div className="solves">
              {SOLVES.map(([t, p], i) => (
                <div key={t} className="solve">
                  <span className="solve__no">{i + 1}</span>
                  <h3>{t}</h3>
                  <p>{p}</p>
                </div>
              ))}
            </div>
            <FigMapping />
            <FigConfidential />
            <p style={{ margin: "20px 0 0", fontSize: 15, color: "var(--muted)" }}>
              시험기관에는 영업 없이 수행 분야에 맞는 요청서가 정리되어 도착하고, 회신은 항목당 세 칸만 채우면 됩니다.{" "}
              <Link href="/for-cro">CRO 참여 안내 →</Link>
            </p>
          </div>
        </section>

        <section className="band--dark">
          <div className="wrap">
            {TRUST.map((t) => (
              <div key={t.l} className="trust">
                <p className="trust__lab">{t.l}</p>
                <h3>{t.t}</h3>
                <p>{t.p}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sub">
          <h2 className="h2" style={{ marginBottom: 32 }}>단추가 하는 일과 하지 않는 일</h2>
          <div className="two">
            <div>
              <h3>하는 일</h3>
              <ul>
                <li>표준 요청서 수집과 수행 가능 CRO 배포</li>
                <li>CDA 체결 상태에 따른 전달 범위 관리</li>
                <li>회신을 같은 형식의 비교표로 정리하고 검수</li>
                <li>제출처 대비 GLP 인증 대응 여부 표시</li>
                <li>필요 시 소개와 일정 조율</li>
              </ul>
            </div>
            <div className="two--off">
              <h3>하지 않는 일</h3>
              <ul>
                <li>특정 CRO 추천, 순위 매기기</li>
                <li>계약 조건 개입</li>
                <li>의뢰자 비용 청구</li>
                <li>타사 견적을 CRO에 공개</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="band--surface">
          <div className="cta__in">
            <h2>한번 입력하고, 비교표로 받아보세요</h2>
            <RfqLink className="btn btn--pill btn--lg">무료로 견적 요청</RfqLink>
            <a href="mailto:hello@danchu.kr" style={{ fontSize: 14, color: "var(--muted)" }}>문의 · hello@danchu.kr</a>
          </div>
        </section>
      </main>
      <SiteFooter current="/about" />
    </div>
  );
}
