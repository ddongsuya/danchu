import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Chevron } from "@/components/Chevron";

const FIELDS = [
  "일반독성", "유전독성", "생식발생독성", "안전성약리", "PK/TK", "국소독성", "면역독성", "발암성",
  "의료기기 생물학적 안전성", "동물대체시험", "효력시험", "분석법 개발·검증",
];

const FAQ = [
  { q: "비용이 드나요?", a: "의뢰자에게는 비용을 청구하지 않습니다. 견적 요청, CRO 배포, 비교표 수령까지 모두 무료입니다." },
  { q: "시험물질 정보는 어떻게 보호되나요?", a: "기밀 등급을 \"CDA 필요\"로 지정하면 비밀유지계약을 체결한 CRO에만 요청서를 전달합니다. 물질명은 코드명으로 대체해 입력할 수도 있습니다." },
  { q: "어떤 CRO가 참여하나요?", a: "GLP 인증을 보유한 국내 비임상 CRO가 참여합니다. 요청하신 시험 분야를 수행할 수 있는 기관에만 배포합니다." },
  { q: "견적을 받은 뒤 계약은 어떻게 하나요?", a: "비교표에서 선택한 CRO와 직접 계약합니다. 단추는 계약 조건에 관여하지 않으며, 필요하면 소개와 일정 조율만 지원합니다." },
];

const PROBLEMS = [
  {
    icon: (
      <>
        <path d="M4 4h16v12H7l-3 3z" />
        <path d="M8 9h8M8 12h5" />
      </>
    ),
    t: "CRO마다 따로 연락",
    p: "같은 내용을 메일과 전화로 반복 설명하고, 회신 시점도 제각각입니다.",
  },
  {
    icon: (
      <>
        <rect x="3" y="4" width="8" height="16" rx="1.5" />
        <rect x="14" y="7" width="7" height="13" rx="1.5" />
        <path d="M6 8h2M6 11h2M17 11h1M17 14h1" />
      </>
    ),
    t: "양식이 달라 비교 불가",
    p: "항목 구성과 단가 기준이 CRO마다 달라서 총액만으로는 판단할 수 없습니다.",
  },
  {
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7" />
        <circle cx="12" cy="17" r=".6" fill="var(--brand)" />
      </>
    ),
    t: "어떤 시험이 필요한지 모름",
    p: "허가 단계와 제출처에 따라 필요한 시험 패키지가 다른데, 처음이면 기준을 잡기 어렵습니다.",
  },
];

const STEPS = [
  { n: 1, badge: "약 5분", t: "표준 양식 입력", p: "시험물질, 목적, 필요한 시험 항목을 표준 양식에 한번만 입력합니다. 세부 조건은 선택 입력입니다." },
  { n: 2, badge: "즉시", t: "참여 CRO에 배포", p: "CDA가 필요한 경우 체결 후 전달합니다. 참여 CRO는 동일한 요청서를 받아 같은 양식으로 회신합니다." },
  { n: 3, badge: "7영업일", t: "비교표 수령", p: "항목별 금액, 기간, GLP 적용 여부를 같은 형식으로 정리한 비교표를 받습니다." },
];

const TRUST = [
  { l: "무료", t: "의뢰자 비용 없음", p: "견적 요청과 비교표 수령까지 의뢰자에게 비용을 청구하지 않습니다." },
  { l: "기밀", t: "CDA 체결 후 전달", p: "기밀 등급을 지정하면 비밀유지계약을 체결한 CRO에만 요청서를 전달합니다." },
  { l: "공정", t: "특정 CRO 추천하지 않음", p: "비교표는 사실 기준으로만 정리합니다. 선택은 의뢰자가 합니다." },
];

export default function Landing() {
  return (
    <div className="page">
      <header className="header header--sticky">
        <div className="container header__inner">
          <Logo href="#top" />
          <nav className="nav" aria-label="주요 메뉴">
            <a href="#about">서비스 소개</a>
            <a href="#how">진행 방식</a>
            <a href="#partners">CRO 파트너</a>
            <a href="#contact">문의</a>
          </nav>
          <div className="header__right">
            <LangToggle />
            <Link href="/rfq" className="btn btn--primary btn--sm">견적 요청하기</Link>
          </div>
        </div>
      </header>

      <main id="top" style={{ flex: 1 }}>
        {/* 히어로 */}
        <section id="about" className="hero">
          <div className="hero__grid">
            <div className="hero__copy">
              <p className="eyebrow">비임상 시험 견적 플랫폼</p>
              <h1 className="hero__title">
                비임상 시험 한번 요청으로
                <br />
                한눈에 비교하세요.
              </h1>
              <p className="hero__sub">
                여러 기관에 따로 연락하지 마세요. 한번 입력하면 단추가 배포하고 비교 견적서로 드려요.
              </p>
              <div className="hero__cta">
                <Link href="/rfq" className="btn btn--primary btn--lg">무료로 견적 요청</Link>
                <span className="hero__note">의뢰자 무료 · 비밀유지계약(CDA) 지원</span>
              </div>
            </div>
            <div className="mock" aria-label="견적 비교표 예시">
              <div className="mock__bar">
                <b>견적 비교표 · DC-2026-0001</b>
                <span>예시</span>
              </div>
              <div className="mock__grid">
                <div className="mock__label mock__head" />
                <div className="mock__head">CRO A</div>
                <div className="mock__head">CRO B</div>
                <div className="mock__head">CRO C</div>
                <div className="mock__label">반복투여독성 4주</div>
                <div>1.2억</div>
                <div>1.35억</div>
                <div>1.1억</div>
                <div className="mock__label">소요 기간</div>
                <div>16주</div>
                <div>14주</div>
                <div>18주</div>
                <div className="mock__label mock__last">GLP</div>
                <div className="mock__last">KGLP</div>
                <div className="mock__last">KGLP · OECD</div>
                <div className="mock__last">KGLP</div>
              </div>
            </div>
          </div>
        </section>

        {/* 문제 */}
        <section className="section section--surface">
          <div className="container">
            <h2 className="h2" style={{ marginBottom: 40 }}>혹시 따로 연락하고 계신가요?</h2>
            <div className="grid3">
              {PROBLEMS.map((c) => (
                <div key={c.t} className="card">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {c.icon}
                  </svg>
                  <h3 className="h3">{c.t}</h3>
                  <p>{c.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 진행 방식 */}
        <section id="how" className="section section--how">
          <div className="container">
            <h2 className="h2" style={{ marginBottom: 12 }}>진행 방식</h2>
            <p className="section__lead">한번 입력하면 나머지는 단추가 진행합니다.</p>
            <div className="grid3">
              {STEPS.map((s) => (
                <div key={s.n} className="card card--step">
                  <div className="card__top">
                    <span className="num">{s.n}</span>
                    <span className="badge">{s.badge}</span>
                  </div>
                  <h3 className="h3">{s.t}</h3>
                  <p>{s.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 신뢰 */}
        <section className="section section--dark">
          <div className="container trust">
            {TRUST.map((t) => (
              <div key={t.l}>
                <p className="label">{t.l}</p>
                <h3 className="h3">{t.t}</h3>
                <p className="body">{t.p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 협력기관 */}
        <section id="partners" className="section">
          <div className="container">
            <h2 className="h2 h2--sm" style={{ marginBottom: 12 }}>협력기관</h2>
            <p style={{ margin: "0 0 24px", color: "var(--muted)" }}>
              클러스터·협회 등 기관 제휴를 준비하고 있습니다.
            </p>
            <div className="partners">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="partner">준비 중</div>
              ))}
            </div>
          </div>
        </section>

        {/* 시험 분야 */}
        <section className="section section--fields">
          <div className="container">
            <h2 className="h2 h2--sm" style={{ marginBottom: 12 }}>시험 분야</h2>
            <p style={{ margin: "0 0 24px", color: "var(--muted)" }}>아래 분야의 비임상 시험 견적을 요청할 수 있습니다.</p>
            <div className="chips">
              {FIELDS.map((f) => (
                <span key={f} className="chip-static">{f}</span>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section section--surface">
          <div className="faq">
            <h2 className="h2 h2--sm" style={{ marginBottom: 28 }}>자주 묻는 질문</h2>
            <div className="faq__list">
              {FAQ.map((q) => (
                <details key={q.q}>
                  <summary>
                    <span>{q.q}</span>
                    <Chevron />
                  </summary>
                  <p>{q.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 하단 CTA */}
        <section id="contact" className="section section--cta">
          <div className="cta__inner">
            <h2 className="cta__title">한번 입력하고, 비교표로 받아보세요</h2>
            <p className="cta__sub">의뢰자 무료 · 비밀유지계약(CDA) 지원</p>
            <Link href="/rfq" className="btn btn--primary btn--cta">무료로 견적 요청</Link>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer__inner">
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
