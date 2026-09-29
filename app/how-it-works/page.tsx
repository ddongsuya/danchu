import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RfqLink } from "@/components/RfqLink";
import { FaqList } from "@/components/site/FaqList";
import { FAQ } from "@/lib/faq";
import { CATS } from "@/lib/rfq-schema";
import { STAGES } from "@/lib/status";
import { INCLUDE_KEYS } from "@/lib/catalog";
import "../site.css";

/* 요청서 · 회신 양식 명세. lib/rfq-schema.ts 와 components/cro/ReplyForm.tsx 의 실제 항목 */
const REQUEST_SPEC: [string, string][] = [
  ["의뢰 목적", "허가자료 제출용이면 GLP 시험이 필요해 견적이 달라집니다"],
  ["개발 분야 · 제출처", "식약처, US FDA, EMA, PMDA, OECD 국가 등 복수 선택"],
  ["시험물질명", "기밀이 필요하면 코드명으로"],
  ["착수 시기 · 회신 희망일 · 예산 구간", "기관에는 예산 구간만 전달됩니다"],
  ["받을 기관 수", "3곳 · 5곳 · 전체"],
  ["기밀 등급", "일반 · CDA 필요(단추 표준 CDA) · 자체 CDA 사용"],
  ["시험 항목", "대분류 15개와 세부 항목. 제안 받기나 패키지로 한 번에 채울 수 있습니다"],
  ["상세 조건", "동물종, 투여경로, GLP, 회복군, TK 등. 비워 두면 기관이 자신의 설계로 견적하고 회신에 설명합니다"],
  ["첨부", "COA, 시험물질 자료. 파일당 20MB"],
];
const REPLY_SPEC: [string, string][] = [
  ["항목별 수행 여부", "가능 · 조건부 가능 · 불가. 조건부는 조건과 기준 금액, 불가는 사유 필수"],
  ["항목별 금액 · 리드타임", "VAT 별도, 동물 입고일부터 최종보고서(안)까지 주 단위"],
  ["설계 요약", "동물종·계통, 대조군·시험군 수, 군당 마릿수, 회복기간, 투여경로·빈도, 시험법"],
  ["기관마다 다른 부분 설명", "회복 동물 지정, TK 채혈 방식, 조직병리 범위처럼 가이드라인이 정하지 않은 것. 비교표에 나란히 표시"],
  ["기본 포함 항목", INCLUDE_KEYS.join(", ")],
  ["제외 항목 · 별도 옵션", "의뢰자에게 전달할 사항"],
  ["착수 가능일 · 유효기간 · 결제 조건", "유효기간을 비우면 제출일 기준 30일"],
  ["정본 PDF", "기관의 정식 견적서. 비교표와 다르면 PDF가 우선합니다"],
];

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

/* 진행 단계별로 의뢰자와 기관이 보는 것. lib/status.ts 와 배포·알림 규칙 */
const FLOW_R: Record<string, string> = {
  received: "요청 번호가 발급되고 접수 메일이 갑니다",
  distributed: "몇 곳에 배포됐는지 확인합니다",
  quoted: "도착한 회신 수만 보이고, 기관명은 기한 전까지 가려집니다",
  compared: "기한 다음 날 비교표가 열립니다. 정렬 기준은 총액·기간·착수일 중 고릅니다",
  selected: "고른 기관에만 회사명과 연락처가 공개됩니다",
  contracting: "기관과 직접 계약합니다. 단추는 조건에 관여하지 않습니다",
  closed: "계약이 보고되면 요청이 종료됩니다",
};
const FLOW_C: Record<string, string> = {
  received: "",
  distributed: "수행 분야가 맞는 기관에 요청서 링크가 갑니다. CDA 요청이면 회사명과 첨부는 가려집니다",
  quoted: "기한 이틀 전과 당일에 알림. 기한 전까지 수정할 수 있고, 다른 기관의 회신은 볼 수 없습니다",
  compared: "",
  selected: "선택된 기관은 의뢰자 연락처를, 그 외 기관은 결과만 받습니다",
  contracting: "체결일과 계약금액을 보고합니다",
  closed: "",
};

const CONFID: [string, string][] = [
  ["일반", "승인된 기관 중 수행 분야가 맞는 곳에 요청서를 그대로 전달합니다."],
  ["CDA 필요", "단추 표준 비밀유지계약을 체결한 기관에만 전달합니다. 체결 전까지 기관에는 회사명 대신 기관 유형만, 첨부 파일은 보이지 않습니다."],
  ["자체 CDA 사용", "의뢰자의 계약서로 진행합니다. 마스킹 범위는 CDA 필요와 같습니다."],
];

const CRO_STEPS: [string, string][] = [
  ["참여 신청", "기관명, GLP 인증, 수행 가능 분야, 담당자를 적어 신청합니다. 단추가 확인한 뒤 승인하며, 승인 후에는 열려 있는 요청도 같은 기한으로 배포됩니다."],
  ["역량 카탈로그", "동물종, 투여경로, 시험법 조합별로 금액과 기간을 등록해 두면 요청서가 올 때 회신 초안이 채워집니다. 수행하지 않는 항목을 꺼 두면 그 요청은 오지 않습니다."],
  ["확인 필요만 보기", "요청 조건이 카탈로그와 다른 항목에만 '확인 필요' 표시가 붙습니다. 그 항목만 보고 제출하면 됩니다. 제출한 금액은 다음 초안에 반영됩니다."],
  ["정본 PDF 첨부", "기관의 정식 견적서를 붙입니다. 비교표와 PDF가 다르면 PDF가 우선하고, 불일치가 있으면 단추가 확인을 요청합니다."],
  ["선정 후", "선정되면 의뢰자 연락처를 받고 직접 계약합니다. 체결일과 계약금액을 보고하면 요청이 종료됩니다."],
];

export default function HowItWorks() {
  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content">
        <section className="ph"><div className="wrap ph__grid"><h1>요청부터 기관 선택까지,<br />단추 이용 안내</h1><p className="ph__lead">요청서와 회신 양식, 견적 비교 항목, 단계별 정보 공개 범위를 확인하세요.</p></div></section>

        {/* 요청서 → 회신 */}
        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>한 요청서, 같은 양식의 회신</h2>
              <p>회신 행은 기관이 정하지 않습니다. 요청서의 항목이 그대로 행이 됩니다.</p>
            </div>
            <div className="doc__body">
              <p className="doc__lead">기관마다 다른 양식으로 오던 견적서를, 요청서의 항목을 기준으로 같은 칸에 받습니다.</p>
              <div className="spec2">
                <div className="spec">
                  <div className="spec__hd"><h3>의뢰자가 쓰는 요청서</h3><span>12문항 · 3분</span></div>
                  <ol>
                    {REQUEST_SPEC.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
                  </ol>
                  <p className="spec__note">작성 중인 내용은 이 기기에 자동 저장되어 언제든 이어서 쓸 수 있습니다.</p>
                </div>
                <div className="spec">
                  <div className="spec__hd"><h3>기관이 채우는 회신</h3><span>항목별 · 정본 PDF</span></div>
                  <ol>
                    {REPLY_SPEC.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
                  </ol>
                  <p className="spec__note">카탈로그를 등록한 기관은 초안이 채워진 채 열리고, 요청 조건과 다른 항목에만 '확인 필요'가 붙습니다.</p>
                </div>
              </div>
              <div className="bridge">
                <b>요청서 · 시험 항목 15개 대분류와 세부 항목</b>
                <i>→</i>
                <b>회신 · 항목마다 수행 여부, 금액, 리드타임, 설계 요약</b>
              </div>
            </div>
          </div>
        </section>

        {/* 비교표 */}
        <section className="doc" id="comparison">
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

        {/* 진행 · 양쪽이 보는 것 */}
        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>의뢰자와 기관이 각 단계에서 보는 것</h2>
              <p>어느 한쪽의 편의를 위해 다른 쪽의 화면을 가리지 않습니다.</p>
            </div>
            <div className="doc__body">
              <div className="flow" role="table" aria-label="진행 단계별 공개 범위">
                <div className="flow__k" role="columnheader">단계</div>
                {STAGES.map((s, i) => (
                  <div key={s.key} className="flow__h" role="columnheader"><small>{String(i + 1).padStart(2, "0")}</small>{s.label}</div>
                ))}
                <div className="flow__k" role="rowheader">의뢰자</div>
                {STAGES.map((s) => (
                  <div key={s.key} className={FLOW_R[s.key] ? "flow__r" : "flow__none"} data-who="화면" role="cell">{FLOW_R[s.key] || "·"}</div>
                ))}
                <div className="flow__k" role="rowheader">기관</div>
                {STAGES.map((s) => (
                  <div key={s.key} className={FLOW_C[s.key] ? "flow__c" : "flow__none"} data-who="기관 화면" role="cell">{FLOW_C[s.key] || "·"}</div>
                ))}
              </div>
              <p className="small muted">회신 기한이 지나기 전에는 의뢰자에게도 기관명이 보이지 않고, 기관은 언제나 다른 기관의 회신을 볼 수 없습니다.</p>
            </div>
          </div>
        </section>

        {/* 기밀 */}
        <section className="doc doc--tight">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>기밀 등급</h2>
              <p>요청서에서 셋 중 하나를 고릅니다.</p>
            </div>
            <div className="doc__body">
              <dl className="dl">
                {CONFID.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <p>시험물질명은 코드명으로 적을 수 있고, 예산은 구간만 전달됩니다. 어떤 등급이든 비교표는 의뢰자에게만 갑니다.</p>
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

        {/* 기관 */}
        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>기관에게는 회신이 짧아집니다</h2>
              <p>요청서는 단추가 모으고, 기관은 다른 부분만 채웁니다.</p>
            </div>
            <div className="doc__body">
              <dl className="dl dl--num">
                {CRO_STEPS.map(([k, v], i) => <div key={k}><dt data-n={String(i + 1).padStart(2, "0")}>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <div className="hero__cta">
                <Link href="/signup/cro" className="b b--line">기관 참여 신청</Link>
                <Link href="/for-cro" className="b b--line">참여 안내 읽기</Link>
              </div>
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
                <RfqLink className="b b--fill">요청서 작성</RfqLink>
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
