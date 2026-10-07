import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RfqLink } from "@/components/RfqLink";
import { HeroAdvisor } from "@/components/site/HeroAdvisor";
import { FaqList } from "@/components/site/FaqList";
import { FAQ } from "@/lib/faq";
import { CATS } from "@/lib/rfq-schema";
import "./site.css";

/* 비교표 예시. 값과 기관명은 예시 */
type Cell = { v: string; num?: boolean; no?: boolean; exp?: string };
const CMP_HEAD = ["기관 A", "기관 B", "기관 C"];
const CMP_ROWS: { th: string; sub?: string; sec?: boolean; c: Cell[] }[] = [
  { th: "요약", sec: true, c: [] },
  { th: "총액", sub: "VAT 별도 · 예시 값", c: [{ v: "3억 1,200만", num: true }, { v: "2억 9,800만", num: true }, { v: "3억 4,500만", num: true }] },
  { th: "수행 범위", c: [{ v: "전체 가능" }, { v: "전체 가능 · 조건부 1건" }, { v: "일부 불가 · 체내 소핵" }] },
  { th: "착수 가능일 · 총 소요기간", c: [{ v: "3주 후 · 22주", num: true }, { v: "6주 후 · 20주", num: true }, { v: "2주 후 · 24주", num: true }] },
  { th: "기본 포함", sub: "8개 항목 중 빠진 것은 취소선", c: [{ v: "8개 모두 포함" }, { v: "7개 · 영문 보고서 제외", exp: "영문 보고서는 별도 옵션" }, { v: "8개 모두 포함" }] },
  { th: "제출처 대비 GLP", c: [{ v: "식약처 대응" }, { v: "식약처 대응" }, { v: "식약처 대응" }] },
  { th: "결제 조건", c: [{ v: "선급 30 · 중도 40 · 잔금 30", num: true }, { v: "선급 50 · 잔금 50", num: true }, { v: "선급 30 · 중도 30 · 잔금 40", num: true }] },
  { th: "유효기간", c: [{ v: "30일", num: true }, { v: "45일", num: true }, { v: "30일", num: true }] },
  { th: "정본 PDF", c: [{ v: "첨부" }, { v: "첨부" }, { v: "첨부" }] },
  { th: "항목별", sec: true, c: [] },
  { th: "반복투여 4주 · 설치류", sub: "ICH M3(R2) 표 1", c: [{ v: "9,800만 · 14주", num: true }, { v: "9,200만 · 12주", num: true }, { v: "1억 600만 · 16주", num: true }] },
  { th: "반복투여 4주 · 비설치류", c: [{ v: "1억 4,000만 · 16주", num: true }, { v: "1억 3,500만 · 14주", num: true }, { v: "1억 5,200만 · 18주", num: true }] },
  { th: "복귀돌연변이(Ames)", sub: "ICH M3(R2) §9", c: [{ v: "1,100만 · 6주", num: true }, { v: "1,050만 · 5주", num: true }, { v: "1,250만 · 6주", num: true }] },
  { th: "체내 소핵", c: [{ v: "2,600만 · 8주", num: true }, { v: "2,400만 · 8주", num: true }, { v: "불가 · 설비 없음", no: true }] },
  { th: "기관마다 다른 부분", sec: true, c: [] },
  {
    th: "회복 동물 지정 방식",
    sub: "가이드라인이 정하지 않아 기관의 설명을 그대로 보여 줍니다",
    c: [
      { v: "고용량군과 대조군에 성별 5마리 추가, 회복 4주" },
      { v: "전 용량군에 성별 5마리 추가, 회복 2주" },
      { v: "고용량군에만 추가, 회복기간은 의뢰자 선택" },
    ],
  },
];

/* 진행 세 단계. 기한과 공개 범위는 lib/distribute.ts, lib/status.ts 의 규칙 */
const HOW: [string, string][] = [
  ["요청서를 씁니다", "개발 단계와 시험 항목을 적습니다. 12문항, 3분 정도입니다. 어떤 시험이 필요한지 모르면 상황을 답하고 제안을 받습니다."],
  ["기관이 같은 양식으로 회신합니다", "수행 분야가 맞는 기관에 요청서가 전달되고, 기관은 항목별 금액과 기간을 같은 칸에 적습니다. 회신 기한은 기본 7영업일입니다. CDA가 필요하면 체결 전까지 회사명과 첨부를 가립니다."],
  ["나란히 비교하고 고릅니다", "기한 다음 날 비교표가 열립니다. 고른 기관에만 연락처가 공개되고, 계약은 기관과 직접 합니다."],
];

export default function Home() {
  return (
    <div className="site">
      <SiteHeader />
      <main>
        {/* 첫 화면: 주장 대신 제품이 하는 일을 보여 준다 */}
        <section className="hero">
          <div className="wrap hero__grid">
            <div className="hero__copy">
              <h1>비임상 시험 견적을 한 번에 비교하세요</h1>
              <p className="hero__sub">
                요청서 하나를 쓰면 여러 시험기관(CRO)이 같은 양식으로 회신합니다. 어떤 시험이 필요한지 모르면 가이드라인 조항과 함께 제안합니다.
              </p>
              <div className="hero__cta">
                <RfqLink className="b b--fill b--lg">견적 요청하기</RfqLink>
              </div>
              <div className="hero__meta">
                <span>의뢰자 무료</span>
                <span>회신 기한 기본 7영업일</span>
                <span>CDA 마스킹 지원</span>
              </div>
              <p className="hero__alt">시험기관이신가요? <Link href="/for-cro">기관 참여 안내</Link></p>
            </div>
            <HeroAdvisor />
          </div>
        </section>

        {/* 비교표 */}
        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>항목별로 나란히</h2>
              <p>정렬 기준은 의뢰자가 고릅니다. 단추는 기관을 추천하지 않습니다.</p>
            </div>
            <div className="doc__body">
              <p className="doc__lead">총액만 보면 같은 값이 다른 구성을 가리킬 수 있습니다. 비교표는 무엇이 포함됐고 무엇이 다른지를 같은 자리에서 보여 줍니다.</p>
              <figure>
                <div className="cmp__tools">
                  <span>정렬</span>
                  <span className="seg"><span>총액</span><span>기간</span><span>착수일</span></span>
                  <span>회신 3 / 배포 3</span>
                </div>
                <table className="cmp">
                  <thead>
                    <tr><th scope="col">항목</th>{CMP_HEAD.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {CMP_ROWS.map((r) =>
                      r.sec ? (
                        <tr key={r.th} className="sec"><th scope="row">{r.th}</th><td colSpan={3} /></tr>
                      ) : (
                        <tr key={r.th}>
                          <th scope="row">{r.th}{r.sub && <small>{r.sub}</small>}</th>
                          {r.c.map((c, i) => (
                            <td key={i} data-c={CMP_HEAD[i]} className={[c.num ? "num" : "", c.no ? "no" : ""].join(" ").trim() || undefined}>
                              {c.v}
                              {c.exp && <span className="exp">{c.exp}</span>}
                            </td>
                          ))}
                        </tr>
                      ),
                    )}
                  </tbody>
                  <caption>비교표의 행 구성입니다. 기관명과 금액, 기간은 예시이며 실제 회신이 아닙니다. 정본은 각 기관이 첨부한 PDF 견적서입니다.</caption>
                </table>
              </figure>
            </div>
          </div>
        </section>

        {/* 진행 */}
        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>세 단계로 끝납니다</h2>
              <p><Link href="/about">서비스 소개에서 자세히</Link></p>
            </div>
            <div className="doc__body">
              <dl className="dl dl--num">
                {HOW.map(([k, v], i) => <div key={k}><dt data-n={String(i + 1).padStart(2, "0")}>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </div>
          </div>
        </section>

        {/* 증거: 가진 것만 */}
        <section className="doc doc--tight">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>지금 확인할 수 있는 것</h2>
            </div>
            <div className="doc__body">
              <p className="doc__lead">단추는 이제 막 시작한 서비스입니다. 보여 드릴 고객 사례나 이용 실적은 아직 없습니다.</p>
              <p>대신 직접 확인할 수 있는 것을 보여 드립니다. 첫 화면의 시험 제안은 실제 서비스가 쓰는 규칙을 그대로 돌린 결과이고, 항목마다 ICH, 식약처 고시, OECD 시험법의 조항이 붙어 있어 원문과 대조할 수 있습니다. 제안 규칙은 초안이며 실무 검토 전입니다. 견적의 정본은 언제나 기관이 첨부한 PDF 견적서입니다.</p>
            </div>
          </div>
        </section>

        {/* 시험 분야 */}
        <section className="doc doc--tight" id="fields">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>요청할 수 있는 시험 분야</h2>
              <p>대분류 15개. 각 분류 아래에 세부 항목과 조건이 있습니다.</p>
            </div>
            <div className="doc__body">
              <ul className="fields">
                {CATS.map((c, i) => <li key={c}><i>{String(i + 1).padStart(2, "0")}</i>{c}</li>)}
              </ul>
              <p className="small muted">제안 받기는 합성의약품, 바이오의약품, 세포·유전자치료제, 건강기능식품, 화장품, 의료기기, 화학물질·농약을 지원합니다. 제안 규칙은 초안이며 실무 검토 전입니다. 항목을 직접 고르거나 패키지로 시작할 수도 있습니다.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>자주 묻는 질문</h2>
              <p><Link href="/faq">전체 보기</Link></p>
            </div>
            <div className="doc__body">
              <FaqList items={FAQ.slice(0, 5)} />
            </div>
          </div>
        </section>

        {/* 두 문 */}
        <section className="doc doc--tight">
          <div className="wrap">
            <div className="doors">
              <div className="door">
                <span>의뢰자</span>
                <h3>요청서 하나로 여러 기관의 견적을 같은 양식으로 받습니다</h3>
                <p>가입은 업무용 이메일이면 됩니다. 비용은 없습니다.</p>
                <RfqLink className="b b--fill">견적 요청하기</RfqLink>
              </div>
              <div className="door">
                <span>기관</span>
                <h3>수행 분야에 맞는 요청서만 받고, 다른 부분만 채워 회신합니다</h3>
                <p>승인은 보통 영업일 1~2일이 걸립니다. 다른 기관의 회신은 볼 수 없습니다.</p>
                <Link href="/signup/cro" className="b b--line">기관 참여 신청</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
