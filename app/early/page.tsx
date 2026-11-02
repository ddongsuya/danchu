import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import { AboutReel, HowReel, CroHeroReel, CroRulesReel } from "@/components/site/reel/Reels";
import { EarlyForm } from "@/components/site/EarlyForm";
import "@/app/for-cro/page.css";
import "./early.css";

export const metadata: Metadata = {
  title: "사전예약 · 단추",
  description: "2027년 1월 1일 정식 오픈 전에 단추를 미리 예약하세요. 의뢰자는 무료로 여러 기관의 견적을 비교하고, 기관은 분야에 맞는 요청서를 받아요.",
  robots: { index: false },
};

/** 시안 비교용: ?v=b 는 한 화면 전환안, 그 밖은 두 갈래 스크롤안. 갈래는 ?for=cro */
type SP = Promise<{ v?: string; for?: string }>;

const REQ_POINTS = ["한번의 요청으로 여러 기관에.", "금액만 말고 구성도 함께 비교하세요.", "선정 전까지 회사명은 가려드려요."];
const CRO_POINTS = ["분야에 맞는 요청서만 받아보세요.", "회신은 의뢰자만 봐요. 다른 기관은 볼 수 없어요.", "필요한 요청에만 참여하세요. 참여하지 않은 요청은 비용이 없어요.", "참여한 요청의 이용료는 오픈 전에 먼저 알려드려요."];

export default async function Page({ searchParams }: { searchParams: SP }) {
  const { v = "a", for: who = "req" } = await searchParams;
  return v === "b" ? <OneScreen role={who === "cro" ? "cro" : "req"} /> : <TwoDoors />;
}

/* A안: 두 문. 첫 화면에서 갈래를 고르고, 아래로 의뢰자 두 장면 → 기관 두 장면 */
function TwoDoors() {
  return (
    <Site current="/early">
      <section className="ph vis ea-hero" aria-labelledby="ea-t">
        <div>
          <h1 id="ea-t">비임상 시험 견적,<br /><span>단추에서 먼저 만나보세요.</span></h1>
          <p className="lead">2027년 1월 1일에 문을 열어요. 미리 예약하세요.</p>
          <nav className="ea-doors" aria-label="예약 갈래">
            <a href="#req"><small>의뢰자</small><b>견적을 받을게요</b></a>
            <a href="#cro"><small>시험 기관</small><b>견적을 보낼게요</b></a>
          </nav>
        </div>
        <figure className="hfilm"><AboutReel /></figure>
      </section>

      <section className="rsx side" id="req" aria-labelledby="ea-r1"><header><h2 id="ea-r1">한번의 요청으로 여러 기관에.<br /><span>편하게 비교하세요.</span></h2></header><HowReel /></section>

      <section className="ea-book" aria-labelledby="ea-r2">
        <div className="ea-copy">
          <h2 id="ea-r2">오픈 날, 첫 요청을<br /><span>먼저 보내보세요.</span></h2>
          <ul className="ea-pts">{REQ_POINTS.slice(1).map((p) => <li key={p}>{p}</li>)}<li>의뢰자 이용은 무료예요.</li></ul>
        </div>
        <EarlyForm role="req" id="ea-req" />
      </section>

      <section className="rsx side" id="cro" aria-labelledby="ea-c1"><header><h2 id="ea-c1">더 다양한 고객,<br /><span>단추에서 만나보세요.</span></h2></header><CroHeroReel /></section>

      <section className="ea-book" aria-labelledby="ea-c2">
        <div className="ea-copy">
          <h2 id="ea-c2">오픈 날부터<br /><span>요청서를 받아보세요.</span></h2>
          <ul className="ea-pts">{CRO_POINTS.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <EarlyForm role="cro" id="ea-cro" />
      </section>
    </Site>
  );
}

/* B안: 한 화면. 갈래 전환(링크) + 세 줄 + 양식이 한 장면에, 아래 한 장면은 그 갈래의 영상 */
function OneScreen({ role }: { role: "req" | "cro" }) {
  const req = role === "req";
  return (
    <Site current="/early" cue={false}>
      <section className="eb" aria-labelledby="eb-t">
        <div className="eb-copy">
          <p className="eb-date mono lab">2027.01.01 정식 오픈</p>
          <h1 id="eb-t">{req ? <>비임상 시험 견적,<br /><span>단추에서 먼저 받아보세요.</span></> : <>더 다양한 고객,<br /><span>단추에서 먼저 만나보세요.</span></>}</h1>
          <nav className="eb-seg" aria-label="예약 갈래">
            <a href="/early?v=b" aria-current={req ? "page" : undefined}><small>의뢰자</small>견적을 받을게요</a>
            <a href="/early?v=b&for=cro" aria-current={req ? undefined : "page"}><small>시험 기관</small>견적을 보낼게요</a>
          </nav>
          <ul className="ea-pts">{(req ? [...REQ_POINTS, "의뢰자 이용은 무료예요."] : CRO_POINTS).map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div className="eb-form">
          <EarlyForm key={role} role={role} id={`eb-${role}`} />
        </div>
      </section>
      <section className="rsx side" aria-labelledby="eb-f"><header><h2 id="eb-f">{req ? <>회신 받은 내용을<br /><span>비교표로.</span></> : <>모든 기관에<br /><span>같은 규칙이 적용됩니다.</span></>}</h2></header>{req ? <HowReel /> : <CroRulesReel />}</section>
    </Site>
  );
}
