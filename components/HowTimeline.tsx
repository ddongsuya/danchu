import Link from "next/link";

/** RFQ 카드 (스테이지 중앙 → 4개로 복제되어 퍼져 나감) */
function RfqCard() {
  return (
    <div className="tl-card">
      <div className="tl-card__top">
        <span className="tl-card__no">RFQ · DC-2026-0001</span>
        <span className="tl-card__dot" />
      </div>
      <div className="tl-card__bar" style={{ width: "70%" }} />
      <div className="tl-card__bar" style={{ width: "88%" }} />
      <div className="tl-card__bar" style={{ width: "55%" }} />
      <div className="tl-card__tags">
        <span>반복투여독성</span>
        <span>유전독성</span>
      </div>
    </div>
  );
}

function CroMark() {
  return (
    <div className="tl-cro">
      <svg width="72" height="64" viewBox="0 0 72 64" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
        <path d="M6 60h60M10 60V24l14-10v46M24 60V14l16 8v38M40 60V30h22v30" />
        <path d="M14 30h4M14 38h4M14 46h4M30 30h4M30 38h4M30 46h4M48 38h6M48 46h6" />
        <circle cx="58" cy="20" r="5" stroke="var(--brand)" />
        <path d="M58 15v-5" stroke="var(--brand)" />
      </svg>
      <span>CRO</span>
    </div>
  );
}

/** 카드가 흩어지는 네 방향 · 회전각 */
const SPREAD: [string, string, string][] = [
  ["calc(-1 * var(--sx))", "calc(-1 * var(--sy))", "-8deg"],
  ["var(--sx)", "calc(-1 * var(--sy))", "8deg"],
  ["calc(-1 * var(--sx))", "var(--sy)", "-5deg"],
  ["var(--sx)", "var(--sy)", "5deg"],
];

/** 견적 회신 행: [기관, 금액, 기간, 출발 x, 출발 y, 중간 x, 중간 y, 최종 y, 회전] */
const ROWS: [string, string, string, string, string, string, string, string, string][] = [
  ["CRO A", "1.2억", "16주", "calc(-1 * var(--sx))", "calc(-1 * var(--sy))", "-150px", "-110px", "-52px", "0.4deg"],
  ["CRO B", "1.35억", "14주", "var(--sx)", "calc(-1 * var(--sy))", "170px", "-70px", "-4px", "4.8deg"],
  ["CRO C", "1.1억", "18주", "calc(-1 * var(--sx))", "var(--sy)", "-130px", "120px", "44px", "5.6deg"],
  ["CRO D", "1.28억", "15주", "var(--sx)", "var(--sy)", "150px", "90px", "92px", "3.8deg"],
];

const CAPS: [string, string, string, string][] = [
  ["1", "표준 양식 입력", "시험물질·목적·시험 항목을 한번만", "약 5분"],
  ["2", "참여 CRO에 배포", "CDA 필요 시 체결 후 전달", "즉시"],
  ["3", "비교표 수령", "금액·기간·GLP를 같은 형식으로", "7영업일"],
];

/** 캡션이 보이는 구간 (씬 진행값 조합) */
const CAP_VIS = [
  "calc(var(--s1) * (1 - var(--s2)))",
  "calc(var(--s2) * (1 - var(--s3)))",
  "calc(var(--s3) * (1 - var(--s5)))",
];

export function HowTimeline() {
  return (
    <section id="how" style={{ background: "var(--surface)" }}>
      <div className="tl-head">
        <h2 className="h2 rv" data-rv style={{ "--rx": "-40px" } as React.CSSProperties}>
          진행 방식
        </h2>
        <p className="rv" data-rv style={{ "--rx": "40px", "--rd": ".15s" } as React.CSSProperties}>
          스크롤하면 한번의 요청이 비교표가 되는 과정을 볼 수 있습니다.
        </p>
      </div>

      <div className="tl" data-timeline>
        <div className="tl-stage">
          <div className="tl-in">
            <div className="tl-art">
            {/* 씬 1 — 요청서 한 장 */}
            <div
              className="tl-mid"
              style={{
                transform: "translate(-50%,-50%) scale(calc(0.85 + 0.15 * var(--s1)))",
                opacity: "calc(var(--s1) * (1 - var(--s2)))",
              }}
            >
              <RfqCard />
            </div>

            {/* 씬 2 — 네 기관으로 배포 */}
            {SPREAD.map(([dx, dy, rot]) => (
              <div
                key={`c${dx}${dy}`}
                className="tl-mid"
                style={{
                  transform: `translate(calc(-50% + var(--s2) * ${dx}),calc(-50% + var(--s2) * ${dy})) scale(calc(1 - 0.45 * var(--s2))) rotate(calc(var(--s2) * ${rot}))`,
                  opacity: "calc(var(--s2) * (1 - var(--s3)))",
                }}
              >
                <RfqCard />
              </div>
            ))}
            {SPREAD.map(([dx, dy]) => (
              <div
                key={`m${dx}${dy}`}
                className="tl-mid"
                style={{
                  transform: `translate(calc(-50% + ${dx}),calc(-50% + ${dy}))`,
                  opacity: "calc(var(--s2) * (1 - var(--s4)))",
                }}
              >
                <CroMark />
              </div>
            ))}

            {/* 씬 3~4 — 회신이 모여 비교표가 된다 */}
            <div
              className="tl-mid"
              style={{
                transform: "translate(-50%,-50%) scale(calc(1 - 0.92 * var(--s5)))",
                opacity: "calc(1 - var(--s5))",
              }}
            >
              <div
                className="tl-mid tl-frame"
                style={{
                  transform: "translate(-50%,-50%) scale(calc(0.9 + 0.1 * var(--s4)))",
                  opacity: "var(--s4)",
                }}
              >
                <div className="tl-frame__ttl">견적 비교표 · DC-2026-0001</div>
                <div className="tl-frame__hd">
                  <span>기관</span>
                  <span>반복투여 4주</span>
                  <span>기간</span>
                </div>
              </div>
              {ROWS.map(([cro, cost, weeks, dx, dy, mx, my, fy, rot]) => (
                <div
                  key={cro}
                  className="tl-mid tl-row"
                  style={{
                    transform: `translate(calc(-50% + (${dx}) * (1 - var(--s3)) + (${mx}) * var(--s3) * (1 - var(--s4))),calc(-50% + (${dy}) * (1 - var(--s3)) + (${my}) * var(--s3) * (1 - var(--s4)) + (${fy}) * var(--s4))) rotate(calc(var(--s3) * (1 - var(--s4)) * ${rot}))`,
                    opacity: "var(--s3)",
                  }}
                >
                  <b>{cro}</b>
                  <span>{cost}</span>
                  <span>{weeks}</span>
                </div>
              ))}
            </div>

            {/* 씬 5 — 단추 마크로 수렴 */}
            <svg
              viewBox="0 0 28 28"
              aria-hidden="true"
              className="tl-logo"
              style={{
                transform:
                  "translate(-50%,-50%) scale(calc(0.4 + 0.6 * var(--s3) + 1.6 * var(--s5))) rotate(calc(var(--s3) * 90deg + var(--s4) * 90deg))",
                opacity: "var(--s3)",
              }}
            >
              <circle cx="14" cy="14" r="13" fill="var(--white)" />
              <circle cx="10" cy="10" r="1.9" fill="var(--brand)" />
              <circle cx="18" cy="10" r="1.9" fill="var(--brand)" />
              <circle cx="10" cy="18" r="1.9" fill="var(--brand)" />
              <circle cx="18" cy="18" r="1.9" fill="var(--brand)" />
            </svg>

            </div>

            {/* 하단 캡션 — 씬마다 교체 */}
            <div className="tl-caps">
              {CAPS.map(([no, t, desc, tag], i) => (
                <div
                  key={no}
                  className="tl-cap"
                  style={{
                    opacity: CAP_VIS[i],
                    transform: `translateY(calc((1 - ${CAP_VIS[i]}) * 10px))`,
                  }}
                >
                  <div className="tl-cap__in">
                    <span className="tl-cap__no">{no}</span>
                    <span className="tl-cap__t">{t}</span>
                    <span className="tl-desc">{desc}</span>
                    <span className="tl-cap__tag">{tag}</span>
                  </div>
                </div>
              ))}
              <div
                className="tl-cap"
                style={{ opacity: "var(--s5)", transform: "translateY(calc((1 - var(--s5)) * 10px))" }}
              >
                <Link href="/rfq" className="btn btn--pill tl-cta">
                  한번 입력하고, 비교표로 받기
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
