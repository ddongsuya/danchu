import Link from "next/link";
import { RfqLink } from "@/components/RfqLink";
import { Logo, LogoMark } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Chevron } from "@/components/Chevron";
import { Motion, IntroSplash } from "@/components/Motion";
import { HowTimeline } from "@/components/HowTimeline";

type RV = React.CSSProperties;

/** 시험 분야 타일 — 이름 + 한 줄 설명 */
const FIELDS: [string, string][] = [
  ["일반독성", "단회·용량결정(DRF)·반복투여, 회복군·TK 옵션"],
  ["발암성·종양원성", "장기 2년, 단기 rasH2 Tg, 종양원성"],
  ["유전독성", "Ames, 염색체이상, 소핵, MLA, Comet"],
  ["생식발생독성", "Segment I · II · III, 스크리닝"],
  ["항원성·면역독성", "ASA·PCA, 피부감작, TDAR"],
  ["국소독성", "피부·안점막 자극, 광독성, 광감작"],
  ["국소내성", "투여 부위 내약성 평가"],
  ["안전성약리", "hERG, 중추신경계, 심혈관계, 호흡기계"],
  ["동물대체시험", "OECD TG 439 · 431 · 492 · 442 계열"],
  ["조제물분석", "함량·균질성·안정성 (HPLC, LC-MS/MS)"],
  ["PK/TK/ADME", "약물동태·독성동태, 생체시료 분석법 검증"],
  ["효력시험", "질환 모델 유효성 평가"],
  ["환경유해성", "조류·물벼룩·어류, 분배계수, 생분해성"],
  ["의료기기 생물학적 안전성", "ISO 10993 시리즈"],
  ["기타", "임상병리·조직병리, 다지점시험"],
];

const FAQ = [
  { q: "비용이 드나요?", a: "의뢰자에게는 비용을 청구하지 않습니다. 견적 요청, CRO 배포, 비교표 수령까지 모두 무료입니다." },
  { q: "시험물질 정보는 어떻게 보호되나요?", a: "기밀 등급을 \"CDA 필요\"로 지정하면 비밀유지계약을 체결한 CRO에만 요청서를 전달합니다. 물질명은 코드명으로 대체해 입력할 수도 있습니다." },
  { q: "어떤 CRO가 참여하나요?", a: "GLP 인증을 보유한 국내 비임상 CRO가 참여합니다. 요청하신 시험 분야를 수행할 수 있는 기관에만 배포합니다." },
  { q: "견적을 받은 뒤 계약은 어떻게 하나요?", a: "비교표에서 선택한 CRO와 직접 계약합니다. 단추는 계약 조건에 관여하지 않으며, 필요하면 소개와 일정 조율만 지원합니다." },
];

const PROB_RX = ["-48px", "48px", "-48px"];

const PROBLEMS = [
  { t: "CRO마다 따로 연락", p: "같은 내용을 메일과 전화로 반복 설명하고, 회신 시점도 제각각입니다." },
  { t: "양식이 달라 비교 불가", p: "항목 구성과 단가 기준이 CRO마다 달라서 총액만으로는 판단할 수 없습니다." },
  { t: "어떤 시험이 필요한지 모름", p: "허가 단계와 제출처에 따라 필요한 시험 패키지가 다른데, 처음이면 기준을 잡기 어렵습니다." },
];

const TRUST = [
  { l: "무료", t: "의뢰자 비용 없음", p: "견적 요청과 비교표 수령까지 의뢰자에게 비용을 청구하지 않습니다." },
  { l: "기밀", t: "CDA 체결 후 전달", p: "기밀 등급을 지정하면 비밀유지계약을 체결한 CRO에만 요청서를 전달합니다." },
  { l: "공정", t: "특정 CRO 추천하지 않음", p: "비교표는 사실 기준으로만 정리합니다. 선택은 의뢰자가 합니다." },
];

export default function Landing() {
  return (
    <div className="page">
      <IntroSplash />
      <Motion />
      <header>
        <div className="lhead">
          <Logo href="#top" size={30} nameSize={19} />
          <nav className="nav" aria-label="주요 메뉴">
            <a href="#about">서비스 소개</a>
            <a href="#how">진행 방식</a>
            <a href="#partners">CRO 파트너</a>
            <a href="#contact">문의</a>
          </nav>
          <div className="lhead__right">
            <LangToggle />
            <RfqLink className="btn btn--pill btn--sm">견적 요청하기</RfqLink>
          </div>
        </div>
      </header>

      {/* 히어로 */}
      <section id="top" className="hero">
        <div className="hero__grid">
          <div className="hero__mark rv" data-rv style={{ "--rx": "-40px", "--rd": ".35s" } as RV}>
            <LogoMark plain />
          </div>
          <div className="hero__copy">
            <p className="eyebrow rv" data-rv style={{ "--ry": "16px" } as RV}>비임상 시험 견적 플랫폼</p>
            <h1 className="hero__title">
              <span className="l1 rv" data-rv style={{ "--ry": "28px", "--rd": ".1s" } as RV}>비임상 시험</span>
              <span className="l2 rv" data-rv style={{ "--ry": "28px", "--rd": ".22s" } as RV}>한번 요청으로</span>
              <span className="l3 rv" data-rv style={{ "--ry": "28px", "--rd": ".34s" } as RV}>한눈에 비교하세요</span>
            </h1>
            <p className="hero__sub rv" data-rv style={{ "--ry": "20px", "--rd": ".5s" } as RV}>
              여러 기관에 따로 연락하지 마세요. 한번 입력하면 단추가 배포하고 비교 견적서로 드려요.
            </p>
            <div className="hero__cta rv" data-rv style={{ "--ry": "20px", "--rd": ".62s" } as RV}>
              <RfqLink className="btn btn--pill btn--lg">무료로 견적 요청</RfqLink>
              <span className="hero__note">의뢰자 무료 · 비밀유지계약(CDA) 지원</span>
            </div>
          </div>
        </div>
      </section>

      <main style={{ flex: 1 }}>
        {/* 문제 */}
        <section id="about" className="sec">
          <h2 className="h2 rv" data-rv style={{ marginBottom: 56, maxWidth: 640, textWrap: "balance", "--rx": "-40px" } as RV}>
            혹시 따로 연락하고 계신가요?
          </h2>
          <div className="probs">
            {PROBLEMS.map((c, i) => (
              <div key={c.t} className="prob rv" data-rv style={{ "--rx": PROB_RX[i], "--rd": `${i * 0.12}s` } as RV}>
                <span className="prob__no">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="h3">{c.t}</h3>
                <p>{c.p}</p>
              </div>
            ))}
          </div>
        </section>

        <HowTimeline />

        {/* 신뢰 */}
        <section className="sec--dark">
          <div className="trusts">
            {TRUST.map((t, i) => (
              <div key={t.l} className="trust rv" data-rv style={{ "--ry": "32px", "--rd": `${i * 0.12}s` } as RV}>
                <p className="trust__lab">{t.l}</p>
                <h3>{t.t}</h3>
                <p>{t.p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 시험 분야 */}
        <section className="sec sec--fields">
          <div className="sec__head">
            <div>
              <h2 className="h2 rv" data-rv style={{ marginBottom: 12, "--rx": "-40px" } as RV}>시험 분야</h2>
              <p style={{ margin: 0, color: "var(--muted)", textWrap: "pretty", maxWidth: 560 }}>
                아래 분야의 비임상 시험 견적을 요청할 수 있습니다. 항목이 확실하지 않아도 요청서에 상황을 적어 주시면 됩니다.
              </p>
            </div>
            <RfqLink className="arrowlink">
              견적 요청 시작
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </RfqLink>
          </div>
          <ol className="tiles">
            {FIELDS.map(([name, desc], i) => (
              <li key={name} className="tile rv" data-rv style={{ "--ry": "24px", "--rd": `${((i % 4) * 0.08).toFixed(2)}s` } as RV}>
                <span className="tile__no">{String(i + 1).padStart(2, "0")}</span>
                <span className="tile__name">{name}</span>
                <span className="tile__desc">{desc}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 협력기관 */}
        <section id="partners" className="sec--partners">
          <div className="band__in">
            <h2 className="h2 h2--sm" style={{ marginBottom: 12 }}>협력기관</h2>
            <p style={{ margin: "0 0 32px", color: "var(--muted)" }}>클러스터·협회 등 기관 제휴를 준비하고 있습니다.</p>
            <div className="partners">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="partner">준비 중</div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="faq">
          <h2 className="h2 rv" data-rv style={{ marginBottom: 32, "--rx": "-40px" } as RV}>자주 묻는 질문</h2>
          <div className="faq__list">
            {FAQ.map((q) => (
              <details key={q.q}>
                <summary>
                  <span>{q.q}</span>
                  <Chevron size={20} />
                </summary>
                <p>{q.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 하단 CTA */}
        <section id="contact" className="sec--cta">
          <div className="cta__in rv" data-rv style={{ "--ry": "32px" } as RV}>
            <LogoMark size={56} />
            <h2 className="cta__title">한번 입력하고, 비교표로 받아보세요</h2>
            <p className="cta__sub">의뢰자 무료 · 비밀유지계약(CDA) 지원</p>
            <RfqLink className="btn btn--pill btn--lg">무료로 견적 요청</RfqLink>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer__in">
          <div className="footer__col">
            <span className="footer__brand">단추 Danchu</span>
            <span>사업자 정보 준비 중</span>
            <a href="mailto:hello@danchu.kr">hello@danchu.kr</a>
          </div>
          <div className="footer__links">
            <Link href="/privacy">개인정보처리방침</Link>
            <Link href="/terms">이용약관</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
