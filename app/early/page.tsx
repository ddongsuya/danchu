import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import { HowReel, CroRulesReel } from "@/components/site/reel/Reels";
import { EarlyForm } from "@/components/site/EarlyForm";
import "@/app/for-cro/page.css";
import "./early.css";

export const metadata: Metadata = {
  title: "사전예약 · 단추",
  description: "2027년 1월 1일 정식 오픈 전에 단추를 미리 예약하세요. 의뢰자는 무료로 여러 기관의 견적을 비교하고, 기관은 분야에 맞는 요청서를 받아요.",
  robots: { index: false },
};

/** 갈래는 ?for=cro (기본은 의뢰자) */
type SP = Promise<{ for?: string }>;

const REQ_POINTS = ["한번의 요청으로 여러 기관에.", "금액만 말고 구성도 함께 비교하세요.", "선정 전까지 회사명은 가려요."];
const CRO_POINTS = ["분야에 맞는 요청서만 받아보세요.", "회신은 의뢰자만 봐요. 다른 기관은 볼 수 없어요.", "필요한 요청에만 참여하세요. 참여하지 않은 요청은 비용이 없어요."];

export default async function Page({ searchParams }: { searchParams: SP }) {
  const { for: who } = await searchParams;
  return <OneScreen role={who === "cro" ? "cro" : "req"} />;
}

/* 한 화면: 갈래 전환(링크) + 세 줄 + 양식이 한 장면에, 아래 한 장면은 그 갈래의 영상 */
function OneScreen({ role }: { role: "req" | "cro" }) {
  const req = role === "req";
  return (
    <Site current="/early" cue={false}>
      <section className="eb" aria-labelledby="eb-t">
        <div className="eb-copy">
          <p className="eb-date mono lab">2027.01.01 정식 오픈</p>
          <h1 id="eb-t">{req ? <>비임상 시험 견적,<br /><span>단추에서 먼저 받아보세요.</span></> : <>더 다양한 고객,<br /><span>단추에서 먼저 만나보세요.</span></>}</h1>
          <nav className="eb-seg" aria-label="예약 갈래">
            <a href="/early" aria-current={req ? "page" : undefined}><small>의뢰자</small>견적을 받을게요</a>
            <a href="/early?for=cro" aria-current={req ? undefined : "page"}><small>시험 기관</small>견적을 보낼게요</a>
          </nav>
          <ul className="ea-pts">{(req ? [...REQ_POINTS, "의뢰자 이용은 무료예요."] : CRO_POINTS).map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div className="eb-form">
          <EarlyForm key={role} role={role} id={`eb-${role}`} />
        </div>
      </section>
      <section className="rsx side" aria-labelledby="eb-f"><header><h2 id="eb-f">{req ? <>회신 받은 내용을<br /><span>비교표로.</span></> : <>모든 기관에<br /><span>같은 규칙이 적용돼요.</span></>}</h2></header>{req ? <HowReel /> : <CroRulesReel />}</section>
    </Site>
  );
}
