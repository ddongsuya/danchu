import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequestStory, type StoryProps } from "@/components/app/RequestStory";
import { OutcomeForm } from "@/components/app/OutcomeForm";
import { ContractConfirm } from "@/components/app/RequestActions";
import { previewEnabled } from "../../cro-crm/fixtures";
import { ReqFrame } from "../frame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "요청 진행 검토 · 단추", robots: { index: false, follow: false } };

const day = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const at = (n: number) => new Date(Date.now() + n * 864e5).toISOString();

const card = (rows: [string, string][]) => (
  <section className="card rq-card">
    <h2 className="rq-card__h">요청 내용</h2>
    <div className="card--rows rq-card__rows">{rows.map(([k, v]) => <div key={k} className="kv"><span className="kv__k">{k}</span><span className="kv__v">{v}</span></div>)}</div>
    <details className="rq-card__full"><summary>전체 보기 <span className="tnum">12개 항목</span></summary></details>
  </section>
);

/**
 * 요청 진행 검토 (로그인 없이, DANCHU_DESIGN_PREVIEW=1, 예시 데이터). 날짜는 오늘 기준.
 * ?s=new 참여 안내 · arrived 견적 도착 · stuck 기한 지남 · contract 계약 확인 · closed 계약 완료 · outcome 선정 없이 마무리
 */
export default async function StoryPreview({ searchParams }: { searchParams: Promise<{ s?: string; end?: string }> }) {
  if (!previewEnabled()) notFound();
  const { s = "new", end } = await searchParams;
  const base: StoryProps = {
    no: "DEMO-0021", substance: "예시 물질", categories: ["안전성약리"], status: "distributed", outcome: null, started: true,
    createdAt: day(-1), replyBy: day(13), distributedAt: at(-1), comparedAt: null, award: null,
    f: { sent: 3, opened: 2, joined: 1, submitted: 0, rest: 2 }, canCompare: false, facets: ["비글견", "GLP"], conditions: ["CDA 필요"],
    joinBy: day(1), joinedAt: at(0), qna: { total: 0, pending: 0 },
  };
  const manage = (compared: boolean) => <OutcomeForm no="DEMO" compared={compared} initialOpen={end === "1"} className={s === "stuck" ? "b2" : "b2 bsm"} />;
  const props: Record<string, StoryProps> = {
    new: { ...base, manage: manage(false), main: card([["시험물질", "예시 물질"], ["시험", "hERG(in vitro), 심혈관계(Telemetry)"], ["동물종", "비글견"], ["GLP", "GLP"], ["공개 범위", "단추 표준 CDA"], ["회신 기한", "7월 27일"]]) },
    arrived: { ...base, no: "DEMO-0019", status: "quoted", createdAt: day(-9), distributedAt: at(-9), joinBy: day(-7), replyBy: day(2), f: { sent: 3, opened: 3, joined: 3, submitted: 1, rest: 0 }, arrivals: [at(-1)], joinedAt: at(-7), facets: ["유전독성", "GLP"], conditions: [], qna: { total: 1, pending: 1 }, manage: manage(false), main: card([["시험물질", "예시 물질"], ["GLP", "GLP"], ["공개 범위", "CDA 없이"]]) },
    stuck: { ...base, no: "DEMO-0007", status: "distributed", createdAt: day(-30), distributedAt: at(-30), joinBy: day(-28), replyBy: day(-19), f: { sent: 3, opened: 1, joined: 0, submitted: 0, rest: 3 }, stuck: true, joinedAt: null, qna: null, facets: ["BALB/c", "4군"], conditions: [], manage: manage(false), main: card([["시험", "종양 효력 CT26"], ["첨부", "1건"]]) },
    contract: { ...base, no: "DEMO-0003", status: "contracting", createdAt: day(-37), distributedAt: at(-37), comparedAt: at(-27), replyBy: day(-28), f: { sent: 3, opened: 3, joined: 2, submitted: 2, rest: 1 }, canCompare: true, award: { name: "예시 기관 B", at: at(-16), reportedAt: at(-5) }, confirm: true, autoAt: at(2), facets: ["랫드", "Non-GLP"], conditions: [], top: <ContractConfirm no="DEMO" cro="예시 기관 B" date="7월 8일" amount="24,000,000" amountWon="24,000,000원" />, side: <section className="card rq-card"><h2 className="rq-card__h">계약</h2><div className="card--rows rq-card__rows"><div className="kv"><span className="kv__k">기관</span><span className="kv__v">예시 기관 B</span></div><div className="kv"><span className="kv__k">계약금액 (VAT 별도)</span><span className="kv__v tnum">24,000,000</span></div><div className="kv"><span className="kv__k">확인</span><span className="kv__v">의뢰자 확인 대기</span></div></div></section> },
    closed: { ...base, no: "DEMO-0003", status: "closed", createdAt: day(-37), distributedAt: at(-37), comparedAt: at(-27), f: { sent: 3, opened: 3, joined: 2, submitted: 2, rest: 1 }, canCompare: true, award: { name: "예시 기관 B", at: at(-16), reportedAt: at(-5) }, contractDone: true, confirmedAt: at(0), facets: ["랫드", "2주"], conditions: [] },
    outcome: { ...base, no: "DEMO-0007", status: "closed", outcome: "보류", outcomeAt: at(0), createdAt: day(-30), distributedAt: at(-30), replyBy: day(-19), f: { sent: 3, opened: 1, joined: 0, submitted: 0, rest: 3 }, qna: null, conditions: [] },
  };
  const p = props[s] ?? props.new;
  return (
    <ReqFrame path={`/app/r/${p.no}`}>
      <RequestStory {...p} />
    </ReqFrame>
  );
}
