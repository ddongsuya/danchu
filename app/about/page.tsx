import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RfqLink } from "@/components/RfqLink";
import "../home.css";

export const metadata: Metadata = { title: "서비스 소개 — 단추", description: "단추는 비임상 시험 의뢰자와 GLP 인증 CRO를 연결하는 견적 플랫폼입니다." };

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
          <p className="sub__lead" style={{ margin: 0 }}>
            CRO마다 다른 양식과 단가 기준 때문에 총액만으로 판단하기 어려웠던 문제를, 항목·기간·GLP 대응을 같은 축에서 볼 수 있게 하는 것으로 풉니다.
          </p>
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
                <li>표준 요청서 수집과 CRO 배포</li>
                <li>CDA 체결 상태에 따른 전달 범위 관리</li>
                <li>회신을 같은 형식의 비교표로 정리</li>
                <li>필요 시 소개와 일정 조율</li>
              </ul>
            </div>
            <div className="two--off">
              <h3>하지 않는 일</h3>
              <ul>
                <li>특정 CRO 추천</li>
                <li>계약 조건 개입</li>
                <li>의뢰자 비용 청구</li>
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
