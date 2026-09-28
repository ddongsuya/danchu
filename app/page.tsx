import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Motion } from "@/components/Motion";
import { FieldsList } from "@/components/FieldsList";
import { Chevron } from "@/components/Chevron";
import { RfqLink } from "@/components/RfqLink";
import { EmailStart } from "@/components/landing/EmailStart";
import { Sequence } from "@/components/landing/Sequence";
import { Finale } from "@/components/landing/Finale";
import "./home.css";
import "./landing.css";

type RV = React.CSSProperties;

/** 히어로 비교표 — 항목행(금액)과 조건행 */
const ITEMS: [string, string, string, string, string][] = [
  ["반복투여 28일 · 4군", "8,400", "9,100", "7,800", "8,900"],
  ["회복군 · 2주", "1,600", "포함", "1,500", "1,700"],
  ["독성동태(TK)", "1,200", "1,400", "별도 견적", "1,100"],
  ["조직병리", "포함", "포함", "800", "포함"],
];
const CROS = ["CRO A", "CRO B", "CRO C", "CRO D"];

const CONDS: [string, string, string, string, string][] = [
  ["기간 (입고 ~ 보고서안)", "16주", "14주", "18주", "15주"],
  ["착수 가능일", "10월 6일", "9월 22일", "10월 20일", "9월 29일"],
  ["GLP 인증", "식약처 · OECD", "식약처", "식약처 · OECD", "식약처 · OECD"],
];

/** 컬러 섹션 카드 — 총액만 보면 뒤집히는 순서 */
const COMPARE: { cro: string; total: string; weeks: string; note: string; low?: boolean; warn?: boolean }[] = [
  { cro: "CRO A", total: "1.12억", weeks: "16주", note: "전 항목 포함" },
  { cro: "CRO B", total: "1.05억", weeks: "14주", note: "전 항목 포함", low: true },
  { cro: "CRO C", total: "1.01억", weeks: "18주", note: "TK 별도", warn: true },
  { cro: "CRO D", total: "1.17억", weeks: "15주", note: "전 항목 포함" },
];

const DISTRIBUTION: [string, string, boolean][] = [
  ["CRO A", "CDA 체결 · 전달됨", true],
  ["CRO B", "CDA 체결 · 회신 완료", true],
  ["CRO C", "CDA 서명 대기 · 회사명 가림", false],
  ["CRO D", "CDA 체결 · 전달됨", true],
];

const SELECT: [string, string, string, string, boolean][] = [
  ["CRO A", "1.12억", "16주", "10월 6일", false],
  ["CRO B", "1.05억", "14주", "9월 22일", true],
  ["CRO C", "1.01억 + TK", "18주", "10월 20일", false],
  ["CRO D", "1.17억", "15주", "9월 29일", false],
];

const PRINCIPLES: [string, string][] = [
  ["블라인드 회신", "기관은 다른 기관의 금액이나 조건을 볼 수 없습니다. 기한이 지나면 제출한 회신은 고칠 수 없습니다."],
  ["같은 요청서, 같은 기한", "수행 가능한 기관 전부에 자동으로 전달됩니다. 어느 기관도 먼저 받거나 빠지지 않습니다."],
  ["모든 과정의 기록", "접수, 배포, 회신 도착, 비교표 공개, 선택이 시각과 함께 남습니다."],
  ["정본은 견적서 PDF", "비교표는 보기 쉽게 정리한 표입니다. 효력은 기관이 첨부한 정식 견적서에 있습니다."],
];

const FAQ: [string, string][] = [
  ["비용이 드나요?", "의뢰자에게는 비용을 청구하지 않습니다. 견적 요청, 기관 배포, 비교표 수령까지 모두 무료입니다."],
  [
    "시험물질 정보는 어떻게 보호되나요?",
    "기밀 등급을 \"CDA 필요\"로 지정하면 비밀유지계약을 체결한 기관에만 요청서를 전달하고, 체결 전까지 회사명은 가려집니다. 물질명은 코드명으로 입력할 수도 있습니다.",
  ],
  ["어떤 기관이 참여하나요?", "GLP 인증을 보유한 국내 비임상 CRO가 참여합니다. 요청하신 시험 분야를 수행할 수 있는 기관에만 배포합니다."],
  ["견적은 언제 받나요?", "접수 후 영업일 1일 내 배포하고, 회신 기한(보통 5영업일)이 지나면 회신 내용을 검수한 뒤 비교표를 공개합니다."],
  [
    "어떤 시험이 필요한지 모르겠어요",
    "시험 항목 대분류만 고르고 상황을 자유롭게 적어 주세요. 기관이 허가 단계와 제출처에 맞는 표준 설계로 견적하고, 필요한 추가 시험을 제안합니다.",
  ],
];

/** 홈 — 히어로 → 비교표 화면 → 참여 기관 → 문제 → 진행 방식 3단 → 원칙 → 시험 분야 → 의뢰자·CRO → FAQ → CTA */
export default function Landing() {
  return (
    <div className="site lp">
      <Motion />
      <SiteHeader />

      <main style={{ flex: 1 }}>
        {/* 히어로 */}
        <section id="top" className="lp-hero">
          <h1 className="lp-hero__title rv" data-rv style={{ "--ry": "20px" } as RV}>
            복잡한 비교견적
            <br />
            단추로 채우세요
          </h1>
          <p className="lp-hero__sub rv" data-rv style={{ "--ry": "16px", "--rd": ".08s" } as RV}>
            비임상 시험 비교견적에 지치셨나요? 단추를 사용해보세요. 한번 요청으로 한번에 견적서를 받아보실 수 있습니다.
          </p>
          <div className="rv" data-rv style={{ "--ry": "16px", "--rd": ".16s" } as RV}>
            <EmailStart id="hero-email" />
            <p className="lp-hero__note">공개 가이드라인 근거로 필요한 시험을 제안합니다 · 비밀유지계약(CDA) 지원 · 접수 후 약 7영업일</p>
          </div>
        </section>

        {/* 제품 화면 */}
        <section className="lp-shotband" aria-labelledby="sample-title">
          <div className="lp-shot">
            <div className="lp-shot__head">
              <h2 id="sample-title">28일 반복투여 독성시험(랫드, 회복군 포함)을 요청하면 이렇게 돌아옵니다</h2>
              <p>기관 4곳이 같은 양식으로 회신한 예시입니다. 회신 기한이 지난 뒤 검수해 공개합니다.</p>
            </div>
            <div className="lp-shot__scroll">
              <div className="lp-tbl">
              <div className="lp-tbl__hd">
                <span>
                  항목 <em>(만원, VAT 별도)</em>
                </span>
                <span>CRO A</span>
                <span>CRO B</span>
                <span>CRO C</span>
                <span>CRO D</span>
              </div>
              {ITEMS.map(([k, ...cells]) => (
                <div key={k} className="lp-tbl__row">
                  <span className="lp-tbl__k">{k}</span>
                  {cells.map((c, i) => (
                    <span key={i} data-label={CROS[i]} className={c === "포함" ? "lp-dim" : c === "별도 견적" ? "lp-warn" : undefined}>
                      {c}
                    </span>
                  ))}
                </div>
              ))}
              <div className="lp-tbl__row lp-tbl__row--total">
                <span className="lp-tbl__k">총액</span>
                <span data-label="CRO A">11,200</span>
                <span data-label="CRO B" className="lp-low">10,500</span>
                <span data-label="CRO C">
                  10,100<em className="lp-warn"> + TK</em>
                </span>
                <span data-label="CRO D">11,700</span>
              </div>
                {CONDS.map(([k, ...cells]) => (
                  <div key={k} className="lp-tbl__row">
                    <span className="lp-tbl__k">{k}</span>
                    {cells.map((c, i) => (
                      <span key={i} data-label={CROS[i]}>
                        {c}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <p className="lp-shot__note">
              최저 총액은 표시만 하며, 단추는 기관에 순위를 매기지 않습니다. 비교표와 정본 견적서가 다르면 기관이 첨부한 견적서가 우선합니다.
            </p>
          </div>
        </section>

        {/* 문제 — 컬러 풀블리드 */}
        <section className="lp-color">
          <div className="lp-color__in">
            <div className="lp-color__text">
              <h2 className="rv" data-rv style={{ "--ry": "18px" } as RV}>
                가격이 같다고
                <br />
                구성도 같지 않습니다.
              </h2>
              <p className="rv" data-rv style={{ "--ry": "16px", "--rd": ".08s" } as RV}>
                조제물 분석, 함량분석, 조직병리, 독성동태 등 가격이 같다고해서 옵션도 똑같은게 아니에요. 단추는 이 모든 부분을 꼼꼼하게
                비교해드립니다.
              </p>
              <a href="#how" className="lp-btn lp-btn--ink rv" data-rv style={{ "--ry": "16px", "--rd": ".16s" } as RV}>
                진행 방식 보기 <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="lp-color__art">
              <div className="lp-tilt">
                <div className="lp-tilt__hd">
                  <span className="lp-shot__id">회신 비교 · 4개 기관</span>
                  <span>단위 억 원</span>
                </div>
                {COMPARE.map((c) => (
                  <div key={c.cro} className="lp-tilt__row">
                    <b>{c.cro}</b>
                    <span className={c.low ? "lp-low" : undefined}>{c.total}</span>
                    <span>{c.weeks}</span>
                    <span className={c.warn ? "lp-warn" : "lp-dim"}>{c.note}</span>
                  </div>
                ))}
              </div>
              <div className="lp-note rv" data-rv style={{ "--ry": "18px", "--rd": ".2s" } as RV}>
                <span>CRO C · 총액은 가장 낮지만</span>
                <b>독성동태(TK)가 별도 견적</b>
                <span>빠진 항목을 더하면 순서가 뒤집힙니다</span>
              </div>
            </div>
          </div>
        </section>

        {/* 진행 방식 */}
        <section id="how" className="lp-how">
          <div className="lp-how__head">
            <h2 className="rv" data-rv style={{ "--ry": "18px" } as RV}>
              한 번 요청으로 간단하게 빠르게
            </h2>
            <p className="rv" data-rv style={{ "--ry": "16px", "--rd": ".08s" } as RV}>
              수행 분야와 인증이 맞는 승인 기관 전부에 같은 요청서가 같은 기한으로 전달됩니다.
            </p>
          </div>
          <Sequence />
        </section>

        {/* STEP 1 */}
        <section className="lp-row">
          <div className="lp-row__text rv" data-rv style={{ "--ry": "16px" } as RV}>
            <h3>
              필요한 건
              <br />
              단추에 입력하세요
            </h3>
            <p>
              여기 저기 설명하고 안내하느라 지치셨죠? 이제 단추에 한번만 입력하세요.
            </p>
          </div>
          <div className="lp-row__art rv" data-rv style={{ "--ry": "20px", "--rd": ".1s" } as RV}>
            <div className="lp-mock">
              <span className="lp-mock__lab">2 / 6 · 의뢰 개요</span>
              <b className="lp-mock__q">의뢰 목적이 무엇인가요?</b>
              <span className="lp-opt lp-opt--on">
                허가자료 제출용 <i aria-hidden="true">✓</i>
              </span>
              <span className="lp-opt">자체 연구용</span>
              <span className="lp-opt">기타</span>
              <div className="lp-progress">
                <span className="lp-progress__bar">
                  <i />
                </span>
                <span className="lp-progress__step">2 / 6</span>
              </div>
            </div>
          </div>
        </section>

        {/* STEP 2 */}
        <section className="lp-row lp-row--flip">
          <div className="lp-row__text rv" data-rv style={{ "--ry": "16px" } as RV}>
            <h3>
              수행 가능한 기관
              <br />
              전부에 전달됩니다
            </h3>
            <p>
              수행 분야와 인증이 맞는 승인 기관에 배포합니다. 기밀 등급을 지정하면 비밀유지계약을 체결한 기관에만 요청서가 전달됩니다.
            </p>
          </div>
          <div className="lp-row__art rv" data-rv style={{ "--ry": "20px", "--rd": ".1s" } as RV}>
            <div className="lp-mock">
              <div className="lp-mock__top">
                <b>배포 현황</b>
                <span className="lp-shot__id">회신 기한 2026-09-11 18:00</span>
              </div>
              {DISTRIBUTION.map(([cro, state, ok]) => (
                <div key={cro} className="lp-dist">
                  <b>{cro}</b>
                  <span className={ok ? "lp-ok" : "lp-warn"}>{state}</span>
                </div>
              ))}
              <p className="lp-mock__cap">CDA 서명 전에는 회사명과 첨부가 가려진 채로 전달됩니다.</p>
            </div>
          </div>
        </section>

        {/* STEP 3 */}
        <section className="lp-row">
          <div className="lp-row__text rv" data-rv style={{ "--ry": "16px" } as RV}>
            <h3>쉽게 비교합니다.</h3>
            <p>
              비교표를 확인하고 선택 한 기관의 연락처만 공개 됩니다.
              <br />
              계약 전 과정에서 단추는 개입하지 않아요.
            </p>
          </div>
          <div className="lp-row__art rv" data-rv style={{ "--ry": "20px", "--rd": ".1s" } as RV}>
            <div className="lp-mock">
              <div className="lp-pick lp-pick--hd">
                <span>기관</span>
                <span>총액</span>
                <span>기간</span>
                <span>착수</span>
              </div>
              {SELECT.map(([cro, total, weeks, start, low]) => (
                <div key={cro} className="lp-pick">
                  <b>{cro}</b>
                  <span className={low ? "lp-low" : undefined}>{total}</span>
                  <span>{weeks}</span>
                  <span>{start}</span>
                </div>
              ))}
              <div className="lp-mock__foot">
                <span>선택한 기관에만 연락처가 공개됩니다</span>
                <span className="lp-btn lp-btn--ink lp-btn--sm">CRO B 선택하기</span>
              </div>
            </div>
          </div>
        </section>

        {/* 원칙 */}
        <section className="lp-dark">
          <div className="lp-dark__head">
            <h2 className="rv" data-rv style={{ "--ry": "18px" } as RV}>
              Blind
              <br />
              &nbsp;&nbsp;&nbsp;Trust
            </h2>
            <p className="rv" data-rv style={{ "--ry": "16px", "--rd": ".08s" } as RV}>
              어느 기관의 견적이든 같은 조건에서 보고 고르실 수 있게 운영합니다. 선택은 의뢰자가 합니다.
            </p>
          </div>
          <dl className="lp-rules">
            {PRINCIPLES.map(([t, p], i) => (
              <div key={t} className="rv" data-rv style={{ "--ry": "12px", "--rd": `${i * 0.06}s` } as RV}>
                <dt>{t}</dt>
                <dd>{p}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 시험 분야 */}
        <section id="fields" className="lp-fields">
          <div className="lp-fields__text rv" data-rv style={{ "--ry": "16px" } as RV}>
            <h2>모든 비임상 시험을</h2>
            <p>각 기관마다 수행하는 비임상시험의 규모가 다릅니다. 한 곳 한 곳 찾지 말고, 원하는 항목을 선택하세요.</p>
            <RfqLink className="lp-link">요청서에서 항목 고르기 →</RfqLink>
          </div>
          <div className="lp-fields__list">
            <FieldsList />
          </div>
        </section>

        {/* 의뢰자 · CRO */}
        <section id="cro" className="lp-split">
          <div className="lp-panel lp-panel--tint rv" data-rv style={{ "--ry": "18px" } as RV}>
            <span className="lp-panel__lab">의뢰자</span>
            <h3>
              요청부터 비교표까지,
              <br />
              비용 없이
            </h3>
            <ul>
              <li>표준 요청서 한 번으로 여러 기관에 요청</li>
              <li>기밀 등급 지정과 CDA 체결 기관에만 전달</li>
              <li>선택한 기관과 직접 계약</li>
            </ul>
            <RfqLink className="lp-btn lp-btn--brand">무료로 견적 요청</RfqLink>
          </div>
          <div className="lp-panel rv" data-rv style={{ "--ry": "18px", "--rd": ".08s" } as RV}>
            <span className="lp-panel__lab">시험기관 (CRO)</span>
            <h3>
              수행 분야에
              <br />
              맞는 요청서만
            </h3>
            <ul>
              <li>요청서에서 만들어진 행에 금액·기간만 입력</li>
              <li>항목 5개 기준 약 5분이면 회신</li>
              <li>가입 신청 후 영업일 1~2일 내 승인</li>
            </ul>
            <Link href="/signup/cro" className="lp-btn lp-btn--line">
              CRO 가입 신청
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="lp-faq">
          <div className="lp-faq__text rv" data-rv style={{ "--ry": "16px" } as RV}>
            <h2>
              자주 묻는
              <br />
              질문
            </h2>
            <p>
              더 궁금한 점은 <a href="mailto:hello@danchu.kr">hello@danchu.kr</a>로 보내주세요.
            </p>
          </div>
          <div className="lp-faq__list">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>
                  <span>{q}</span>
                  <Chevron size={20} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 마지막 CTA — 옛 인트로의 수렴 연출을 여기서 */}
        <section className="lp-final">
          <Finale />
          <h2 className="lp-final__title">
            복잡한 비교견적
            <br />
            단추에서 쉽게
          </h2>
          <EmailStart id="cta-email" tone="onColor" />
          <p className="lp-final__note">의뢰자 무료 · 가입 후 바로 요청서를 작성할 수 있습니다</p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
