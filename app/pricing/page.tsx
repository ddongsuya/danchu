import type { Metadata } from "next";
import { pageMeta } from "@/lib/share-meta";
import { Check, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Site } from "@/components/site/Site";
import { PLANS, PLAN_IDS, PRICE_OPEN, type PlanId } from "@/lib/plans";
import { PricingMobile } from "./PricingMobile";
import { FAQ, FEE_ROWS, FEE_NOTE, PLAN_META, priceOf } from "./data";
import "./page.css";

export const metadata: Metadata = pageMeta(
  "요금제 · 단추",
  PRICE_OPEN
    ? "의뢰자는 무료로 이용해요. 기관은 무료, Plus, Pro 가운데 고르고, 2027년 12월 31일까지는 전 요금제를 무료로 이용해요."
    : "의뢰자는 무료로 이용해요. 기관도 2027년 12월 31일까지 모든 기능을 무료로 이용해요.",
  "/pricing",
);

/** 시범 운영 중 쓰는 기능 (금액 공개 전 화면) */
const PILOT_ITEMS = ["견적 요청 수신·회신", "견적 송부", "시험 관리", "견적서 작성 툴", "고객 관리", "담당자 계정"];

/** 금액 공개 전 (PRICE_OPEN false): 요금제·수수료 금액 없이 시범 운영 안내만 */
function PilotOnly() {
  return (
    <Site current="/pricing" cue={false}>
      <section className="pr pr-c" aria-labelledby="pr-h">
        <div className="pr-c__in">
          <h1 id="pr-h">시범 운영 기간에는<br />모든 기능이 무료예요</h1>
          <p className="lead tnum">2027년 12월 31일까지 참여한 요청에는 요금이 없어요. 이 기간에 참여한 요청은 그 뒤에 계약해도 수수료가 없어요.</p>
          <p className="pr-c__next">정식 서비스 요금은 시작 30일 전에 이 페이지와 메일로 알려요. 의뢰자는 계속 무료로 이용해요.</p>
          <ul className="pr-feat pr-c__feat">
            {PILOT_ITEMS.map((it) => <li key={it}><Check size={16} weight="bold" aria-hidden="true" />{it}</li>)}
          </ul>
          <a className="btn solid pr-c__cta" href="/signup/cro">참여 신청</a>
          <p className="pr-links"><a href="/terms/cro">기관 이용약관</a><a href="/for-cro">기관 참여 안내</a></p>
        </div>
      </section>
    </Site>
  );
}

const CMP: { group: string; rows: { k: string; v: Record<PlanId, React.ReactNode> }[] }[] = [
  { group: "견적", rows: [
    { k: "견적 요청 수신·회신", v: { free: true, plus: true, pro: true } },
    { k: "5,000만 원 미만 견적 송부", v: { free: "월 5건", plus: "무제한", pro: "무제한" } },
    { k: "5,000만 원 이상 견적 송부", v: { free: "건당 송부료", plus: "건당 송부료", pro: "건당 송부료" } },
    { k: "요청 수신 범위·비교표 노출", v: { free: "동일", plus: "동일", pro: "동일" } },
  ] },
  { group: "업무 도구", rows: [
    { k: "시험 관리", v: { free: false, plus: true, pro: true } },
    { k: "견적서 작성 툴 (엑셀·PDF)", v: { free: false, plus: false, pro: true } },
    { k: "견적서 디자인 브랜딩", v: { free: false, plus: false, pro: "연 1회" } },
    { k: "고객 관리 (견적서 작성 툴 연동)", v: { free: false, plus: false, pro: true } },
  ] },
  { group: "계정·결제", rows: [
    { k: "담당자 계정", v: { free: "1명", plus: "3명", pro: "무제한" } },
    { k: "결제", v: { free: "없음", plus: "매월 카드 자동결제", pro: "매월 카드 자동결제" } },
  ] },
];

function Cell({ v }: { v: React.ReactNode }) {
  if (v === true) return <><Check size={18} weight="bold" aria-hidden="true" /><span className="sr">제공</span></>;
  if (v === false) return <span className="sr">미제공</span>;
  return <>{v}</>;
}

/** 공개 요금제 (2026-11-13 확정, 시안 v2). 넓은 화면은 요금제·비교·수수료·질문을 차례로, 휴대폰은 한 화면 안에서 탭으로 */
export default function Page() {
  if (!PRICE_OPEN) return <PilotOnly />;
  return (
    <Site current="/pricing" cue={false}>
      <section className="pr pr-d" aria-labelledby="pr-h">
        <div className="pr-hero">
          <h1 id="pr-h">무료로 시작하고,<br />필요할 때 바꾸세요.</h1>
          <p className="lead">의뢰자는 무료로 이용해요. 기관 요금제는 2028년 1월 1일부터 적용돼요.</p>
          <p className="pr-note tnum"><b>시범 운영</b>2027년 12월 31일까지 전 요금제 무료</p>
        </div>
        <div className="pr-plans" role="list" aria-label="요금제">
          {PLAN_IDS.map((id) => {
            const p = PLANS[id];
            const m = PLAN_META[id];
            return (
              <article key={id} role="listitem" className={id === "pro" ? "pr-plan pr-plan--lift" : "pr-plan"} aria-labelledby={`pr-${id}`}>
                <h3 id={`pr-${id}`}>{p.name}</h3>
                <p className="pr-who">{m.who}</p>
                <p className="pr-price tnum"><b>{priceOf(id)}</b>{p.price ? <span>/월</span> : null}</p>
                <p className="pr-terms">{m.terms}</p>
                <a className={id === "pro" ? "btn solid pr-cta" : "btn ghost pr-cta"} href="/signup/cro">참여 신청</a>
                <ul className="pr-feat">
                  {p.items.map((it) => <li key={it}><Check size={16} weight="bold" aria-hidden="true" />{it}</li>)}
                </ul>
              </article>
            );
          })}
        </div>
        <p className="pr-foot">5,000만 원 이상 견적은 전 요금제 같은 송부료·성사 수수료 <a href="#fees">수수료 보기</a></p>
      </section>

      <section className="pr pr-d pr-sec" aria-labelledby="pr-cmp">
        <h2 id="pr-cmp">요금제 비교</h2>
        <table className="pr-cmp tnum">
          <colgroup><col className="k" /><col /><col /><col /></colgroup>
          <thead>
            <tr>
              <th scope="col"><span className="sr">항목</span></th>
              {PLAN_IDS.map((id) => <th key={id} scope="col"><span className="n">{PLANS[id].name}</span><span className="v">{priceOf(id)}{PLANS[id].price ? "/월" : ""}</span></th>)}
            </tr>
          </thead>
          {CMP.map((g) => (
            <tbody key={g.group}>
              <tr className="g"><th colSpan={4} scope="colgroup">{g.group}</th></tr>
              {g.rows.map((r) => (
                <tr key={r.k}><th scope="row">{r.k}</th>{PLAN_IDS.map((id) => <td key={id}><Cell v={r.v[id]} /></td>)}</tr>
              ))}
            </tbody>
          ))}
        </table>
      </section>

      <section className="pr pr-d pr-sec pr-fees" id="fees" aria-labelledby="pr-fee">
        <div>
          <h2 id="pr-fee">송부료·성사 수수료</h2>
          <p className="lead">5,000만 원 이상 견적에만 붙어요. 요금제와 관계없이 같아요.</p>
        </div>
        <table className="pr-fee tnum">
          <thead><tr><th scope="col">금액 구간</th><th scope="col">견적서 송부</th><th scope="col">계약 성사</th></tr></thead>
          <tbody>{FEE_ROWS.map((r) => <tr key={r[0]}><th scope="row">{r[0]}</th><td>{r[1]}</td><td>이 구간 금액의 {r[2]}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={3}>{FEE_NOTE}</td></tr></tfoot>
        </table>
      </section>

      <section className="pr pr-d pr-sec" aria-labelledby="pr-faq">
        <div className="pr-faqw">
          <h2 id="pr-faq">자주 묻는 질문</h2>
          <div className="pr-faq">
            {FAQ.map((f, i) => (
              <details key={f.q} open={i === 0}><summary>{f.q}<CaretDown size={18} aria-hidden="true" /></summary><p>{f.a}</p></details>
            ))}
          </div>
          <p className="pr-links"><a href="/terms/cro">기관 이용약관</a><a href="/for-cro">기관 참여 안내</a></p>
        </div>
      </section>

      <section className="pr pr-m" aria-labelledby="pr-mh">
        <PricingMobile />
      </section>
    </Site>
  );
}
