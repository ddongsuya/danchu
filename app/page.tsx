import { RfqLink } from "@/components/RfqLink";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroGraphic } from "@/components/HeroGraphic";
import { FieldsList } from "@/components/FieldsList";
import { Motion, IntroSplash } from "@/components/Motion";
import "./home.css";

type RV = React.CSSProperties;

const STEPS = [
  { no: 1, t: "표준 양식 입력", p: "시험물질·목적·시험 항목을 한번만 적습니다.", tag: "약 5분" },
  { no: 2, t: "참여 CRO에 배포", p: "CDA가 필요하면 체결한 기관에만 전달합니다.", tag: "즉시" },
  { no: 3, t: "비교표 수령", p: "금액·기간·GLP를 같은 형식으로 받습니다.", tag: "7영업일" },
];

const BOARD = [
  { cro: "CRO A", cost: "1.20억", weeks: "16주", glp: "식약처 · OECD", start: "10/06", low: false },
  { cro: "CRO B", cost: "1.35억", weeks: "14주", glp: "식약처", start: "09/22", low: false },
  { cro: "CRO C", cost: "1.10억", weeks: "18주", glp: "식약처 · OECD", start: "10/20", low: true },
  { cro: "CRO D", cost: "1.28억", weeks: "15주", glp: "식약처 · OECD", start: "09/29", low: false },
];

/** 홈 — 히어로 → 진행 방식 → 비교표 예시 → 시험 분야 → CTA (핸드오프 1c) */
export default function Landing() {
  return (
    <div className="site">
      <IntroSplash />
      <Motion />
      <SiteHeader />

      <main style={{ flex: 1 }}>
        <section id="top" className="wrap hero">
          <p className="eyebrow rv" data-rv style={{ "--ry": "16px" } as RV}>비임상 시험 견적 플랫폼</p>
          <h1 className="hero__title rv" data-rv style={{ "--ry": "24px", "--rd": ".1s" } as RV}>비임상 시험 견적, 한번 요청으로 한눈에 비교하세요</h1>
          <p className="hero__sub rv" data-rv style={{ "--ry": "20px", "--rd": ".25s" } as RV}>한번 입력하면 단추가 참여 CRO에 배포하고, 같은 형식의 비교표로 드립니다.</p>
          <div className="hero__cta rv" data-rv style={{ "--ry": "20px", "--rd": ".4s" } as RV}>
            <RfqLink className="btn btn--pill btn--lg">무료로 견적 요청</RfqLink>
            <span className="hero__note">의뢰자 무료 · CDA 지원</span>
          </div>
        </section>

        <section className="how" aria-label="진행 방식">
          <div className="how__in">
            <HeroGraphic />
            <ol className="how__steps">
              {STEPS.map((s, i) => (
                <li key={s.no} className="how__step rv" data-rv style={{ "--rx": "24px", "--rd": `${i * 0.1}s` } as RV}>
                  <span className="how__no">{s.no}</span>
                  <div>
                    <div className="how__t">
                      <h3>{s.t}</h3>
                      <span className="how__tag">{s.tag}</span>
                    </div>
                    <p className="how__p">{s.p}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="wrap board-sec">
          <h2 className="h2 rv" data-rv style={{ "--rx": "-24px" } as RV}>비교표는 이렇게 도착합니다</h2>
          <div className="board rv" data-rv style={{ "--ry": "20px", "--rd": ".1s" } as RV}>
            <div className="board__in">
              <div className="board__hd">
                <span>기관</span>
                <span>총액</span>
                <span>기간</span>
                <span>GLP</span>
                <span>착수 가능</span>
              </div>
              {BOARD.map((r) => (
                <div key={r.cro} className="board__row">
                  <b>{r.cro}</b>
                  <span className={`tnum${r.low ? " g-low" : ""}`}>{r.cost}</span>
                  <span>{r.weeks}</span>
                  <span>{r.glp}</span>
                  <span>{r.start}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="board__cap">예시 데이터입니다. 최저가는 강조만 하고 추천하지 않습니다.</p>
        </section>

        <section className="wrap fields-sec">
          <FieldsList />
        </section>

        <section className="wrap cta-sec">
          <div className="ctacard rv" data-rv style={{ "--ry": "24px" } as RV}>
            <div>
              <h2>한번 입력하고, 비교표로 받아보세요</h2>
              <p>의뢰자 무료 · 비밀유지계약(CDA) 지원</p>
            </div>
            <RfqLink className="btn btn--pill btn--lg">무료로 견적 요청</RfqLink>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
