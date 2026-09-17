import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RfqLink } from "@/components/RfqLink";
import { Motion } from "@/components/Motion";
import { FigBeforeAfter, FigMapping, FigConfidential } from "@/components/about/Figures";
import "../home.css";

export const metadata: Metadata = {
  title: "서비스 소개 — 단추",
  description: "비임상 시험 견적을 왜 비교할 수 없었는지, 단추가 어떻게 같은 양식으로 받아 공정하게 비교하게 하는지 설명합니다.",
};

type RV = React.CSSProperties;

/** 왜 비교가 안 되었나 */
const PAINS: [string, string][] = [
  ["기관마다 따로 설명해야 합니다", "같은 시험물질, 같은 목적을 기관마다 메일과 전화로 다시 설명합니다. 회신은 제각각 도착하고, 어디까지 진행됐는지 스스로 관리해야 합니다."],
  ["견적서 양식이 달라 나란히 놓을 수 없습니다", "한 곳은 조직병리를 포함하고 한 곳은 별도 옵션입니다. 총액이 낮아 보여도 빠진 항목을 더하면 결과가 뒤집힙니다. 항목·기간·단가 기준이 달라 표 하나로 정리되지 않습니다."],
  ["견적서 자체를 받기 어렵습니다", "기관은 법인 확인 없이는 견적을 내지 않는 경우가 많습니다. 처음 비임상을 준비하는 의뢰자는 무슨 시험이 필요한지부터 막히고, 먼저 연락한 기관의 설명에 기대게 됩니다."],
  ["물질 정보가 흩어집니다", "견적을 받으려면 물질 정보를 여러 곳에 보내야 합니다. 어느 기관과 비밀유지계약을 맺었는지, 무엇을 보냈는지 관리가 흩어집니다."],
];

/** 단추의 방식 */
const HOW: [string, string][] = [
  ["표준 양식에 한 번 입력", "시험물질, 목적, 제출처, 시험 항목을 한 번만 적습니다. 대분류만 골라도 접수되고, 아는 조건은 더 쓸 수 있습니다. 개발 분야별 패키지를 고르면 항목이 한 번에 채워집니다."],
  ["수행 가능한 기관에 즉시 배포", "접수되는 순간 수행 분야와 인증이 맞는 승인 기관 전부에 전달합니다. 사람이 고르지 않으므로 어느 기관도 먼저 받거나 빠지지 않습니다."],
  ["모든 기관이 같은 양식으로 회신", "기관은 요청서에서 만들어진 같은 행에 가능 여부, 금액, 기간을 채우고 정식 견적서 PDF를 첨부합니다. 회신 기한은 모든 기관에 같습니다."],
  ["비교표로 받고 직접 선택", "기한이 지나면 회신이 비교표 한 장으로 정리되어 도착합니다. 고른 기관에만 연락처가 열리고 계약은 직접 진행합니다."],
];

/** 같은 양식에 담기는 것 */
const SAME: [string, string][] = [
  ["항목별 금액", "요청한 시험 항목마다 금액이 같은 자리에"],
  ["리드타임", "동물 입고부터 최종보고서(안)까지, 같은 기준"],
  ["기본 포함 항목", "임상병리·조직병리·TK가 총액에 든 것인지"],
  ["설계 요약", "동물종·군 구성·마릿수·시험법"],
  ["GLP 대응", "제출처에 맞는 인증을 보유했는지"],
  ["유효기간·착수 가능일", "언제까지 유효하고 언제 시작할 수 있는지"],
];

/** 공정성·신뢰 원칙 */
const PRINCIPLES: [string, string, string][] = [
  ["추천 없음", "특정 기관을 밀지 않습니다", "단추는 어떤 기관도 추천하거나 순위를 매기지 않습니다. 비교표는 금액·기간·포함 항목 같은 사실만 담고, 최저가는 표시만 할 뿐 권하지 않습니다. 선택은 의뢰자가 합니다."],
  ["같은 출발선", "모든 기관이 같은 요청서를 같은 시각에 받습니다", "배포는 사람이 고르지 않고 자동으로 이뤄집니다. 수행 분야가 맞는 승인 기관 전부에 같은 내용이 같은 시각에 전달되고, 회신 기한도 같습니다. 특정 기관에 먼저 알려 주거나 조건을 귀띔하는 일이 구조적으로 없습니다."],
  ["가림", "기관은 서로의 견적을 보지 못합니다", "회신은 의뢰자에게만 전달됩니다. 어느 기관도 다른 기관의 금액이나 조건을 볼 수 없고, 기한이 지나면 제출한 회신을 고칠 수 없습니다. 선택 전까지 의뢰자의 연락처도 열리지 않습니다."],
  ["기록", "모든 과정이 시각과 함께 남습니다", "접수, 배포, 회신 도착, 비교표 공개, 선택이 요청서마다 시각과 함께 기록되고 의뢰자 화면에 그대로 보입니다. 누가 언제 무엇을 했는지 의뢰자가 직접 확인할 수 있습니다."],
  ["정본 우선", "비교표와 견적서가 다르면 견적서가 우선합니다", "비교표는 보기 쉽게 정리한 표이고, 법적 효력은 기관이 첨부한 정식 견적서 PDF에 있습니다. 둘이 어긋나면 단추가 기관에 확인을 요청하고 결과를 의뢰자에게 알립니다."],
  ["의뢰자 무료", "견적 요청과 비교표 수령에 비용이 없습니다", "의뢰자에게는 어떤 비용도 청구하지 않습니다. 계약 조건에도 개입하지 않으며, 계약은 의뢰자와 기관이 직접 체결합니다."],
];

export default function About() {
  return (
    <div className="site">
      <Motion />
      <SiteHeader />
      <main style={{ flex: 1 }}>
        <section className="sub">
          <p className="eyebrow">서비스 소개</p>
          <h1 className="sub__title">
            모든 기관의 견적을
            <br />
            같은 양식으로, 공정하게 비교합니다.
          </h1>
          <p className="sub__lead">
            단추는 비임상 시험을 의뢰하는 연구자와 GLP 인증 시험기관을 연결하는 견적 플랫폼입니다. 의뢰자는 표준 양식으로 한 번만 요청하고, 수행 가능한 기관 전부가 같은 양식으로 회신하며, 단추는 그 회신을 사실 그대로 비교표에 담습니다.
          </p>
        </section>

        <section className="band--soft">
          <div className="sub" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <p className="eyebrow">왜 만들었나</p>
            <h2 className="h2">견적은 받았는데, 비교가 되지 않았습니다</h2>
            <p className="sub__lead">
              비임상 시험은 신약이든 건강기능식품이든 의료기기든 허가로 가는 길목에서 반드시 거쳐야 하고, 한 건에 수천만 원에서 수억 원이 듭니다. 그런데 이 큰 결정을 내리는 과정이 아직도 메일과 전화, 담당자의 기억에 기대고 있습니다.
            </p>
            <FigBeforeAfter />
            <ol className="pains" style={{ marginTop: 32 }}>
              {PAINS.map(([t, p], i) => (
                <li key={t} className="rv" data-rv style={{ "--ry": "14px", "--rd": `${i * 0.08}s` } as RV}>
                  <span className="pains__no">0{i + 1}</span>
                  <div>
                    <h3>{t}</h3>
                    <p>{p}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="sub">
          <p className="eyebrow">단추의 방식</p>
          <h2 className="h2">한 번 요청하면, 같은 양식으로 돌아옵니다</h2>
          <div className="solves">
            {HOW.map(([t, p], i) => (
              <div key={t} className="solve rv" data-rv style={{ "--ry": "16px", "--rd": `${i * 0.1}s` } as RV}>
                <span className="solve__no">{i + 1}</span>
                <h3>{t}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="band--soft">
          <div className="sub" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <p className="eyebrow">같은 양식</p>
            <h2 className="h2">어느 기관의 견적이든 같은 자리에 같은 정보가 있습니다</h2>
            <p className="sub__lead">
              기관마다 다른 견적서를 읽고 항목을 맞춰 보는 일이 사라집니다. 요청서에 적은 시험 항목이 그대로 모든 기관 회신 표의 행이 되고, 기관은 그 행에 답합니다. 의뢰자는 아래 정보를 기관 수만큼 나란히 봅니다.
            </p>
            <div className="same">
              {SAME.map(([t, p], i) => (
                <div key={t} className="rv" data-rv style={{ "--ry": "12px", "--rd": `${i * 0.06}s` } as RV}>
                  <b>{t}</b>
                  <span>{p}</span>
                </div>
              ))}
            </div>
            <FigMapping />
          </div>
        </section>

        <section className="sub">
          <p className="eyebrow">기밀</p>
          <h2 className="h2">물질 정보는 필요한 기관에, 필요한 범위까지만</h2>
          <p className="sub__lead">
            기밀 등급을 지정하면 비밀유지계약을 체결한 기관에만 요청서 전문이 전달되고, 그 전까지 회사명은 가려집니다. 수행 분야가 다른 기관에는 아예 전달하지 않습니다.
          </p>
          <FigConfidential />
        </section>

        <section className="band--soft">
          <div className="sub" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <p className="eyebrow">공정성과 신뢰</p>
            <h2 className="h2">어느 기관에도 치우치지 않도록 만들었습니다</h2>
            <p className="sub__lead">
              견적 비교 서비스는 한쪽으로 기울면 의미가 없습니다. 단추는 운영자의 선의가 아니라 구조로 공정성을 지킵니다. 사람이 개입할 수 있는 자리를 줄이고, 개입한 흔적은 모두 남깁니다.
            </p>
            <ul className="principles">
              {PRINCIPLES.map(([lab, t, p], i) => (
                <li key={t} className="principle rv" data-rv style={{ "--ry": "16px", "--rd": `${i * 0.08}s` } as RV}>
                  <span className="principle__lab">{lab}</span>
                  <h3>{t}</h3>
                  <p>{p}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="sub">
          <h2 className="h2" style={{ marginBottom: 32 }}>단추가 하는 일과 하지 않는 일</h2>
          <div className="two">
            <div>
              <h3>하는 일</h3>
              <ul>
                <li>표준 요청서 접수와 수행 가능 기관 전부에 자동 배포</li>
                <li>기밀 등급에 따른 전달 범위 관리</li>
                <li>회신을 같은 양식의 비교표로 정리하고 정본과 대조</li>
                <li>제출처 대비 GLP 인증 대응 여부 표시</li>
                <li>접수부터 선택까지의 기록 제공</li>
              </ul>
            </div>
            <div className="two--off">
              <h3>하지 않는 일</h3>
              <ul>
                <li>특정 기관 추천, 순위 매기기, 최저가 권유</li>
                <li>특정 기관에 먼저 알리거나 조건 귀띔</li>
                <li>기관 간 견적 공개</li>
                <li>계약 조건 개입, 의뢰자 비용 청구</li>
              </ul>
            </div>
          </div>
          <p style={{ margin: "24px 0 0", fontSize: 15, color: "var(--muted)" }}>
            시험기관에는 영업 없이 수행 분야에 맞는 요청서가 정리되어 도착합니다.{" "}
            <Link href="/for-cro">CRO 참여 안내 →</Link>
          </p>
        </section>

        <section className="band--surface">
          <div className="cta__in">
            <h2>한 번 입력하고, 같은 양식의 비교표로 받아보세요</h2>
            <RfqLink className="btn btn--pill btn--lg">무료로 견적 요청</RfqLink>
            <a href="mailto:hello@danchu.kr" style={{ fontSize: 14, color: "var(--muted)" }}>문의 · hello@danchu.kr</a>
          </div>
        </section>
      </main>
      <SiteFooter current="/about" />
    </div>
  );
}
