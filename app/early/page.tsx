import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import { EarlyFlow } from "@/components/site/EarlyFlow";
import { EarlySpec } from "@/components/site/EarlySpec";
import { daysToPilot, preregActive } from "@/lib/prereg";
import "./early.css";

export const metadata: Metadata = {
  title: "사전예약 · 단추",
  description: "2027년 6월 1일 시범 운영 전에 단추를 사전예약하세요. 예약 완료와 시범 운영 시작을 문자로 알려요.",
  robots: { index: false },
};

/** 갈래는 ?for=cro (기본은 의뢰자) */
type SP = Promise<{ for?: string }>;

const POINTS = {
  req: ["한번의 요청으로 여러 기관에.", "금액만 비교 마시고 구성도 함께 비교하세요.", "선정 전까지 회사명은 비공개로.", "의뢰자는 무료로 이용해보세요!"],
  cro: ["분야에 맞는 요청서만 받아보세요.", "회신한 견적은 의뢰자만 봐요.", "필요한 요청에만 참여하세요.", "2027년 말까지 무료로 이용해보세요."],
};

/**
 * 사전예약 (2026-11-06 시안 판 15). 흰 바탕, 가로 줄 없음.
 * 넓은 화면: 위 줄은 제목과 안내 네 줄, 아래 줄은 갈래·세 줄과 설문 카드.
 * 휴대폰: 한 화면에 제목·안내·갈래·"사전예약하기"만 두고, 누르면 설문이 화면 전체로 열린다.
 */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const { for: who } = await searchParams;
  const role = who === "cro" ? "cro" : "req";
  const open = preregActive();
  const d = daysToPilot();
  return (
    <Site current="/early" onescreen={false} cue={false}>
      <section className="ea2" aria-labelledby="ea2-t">
        <div className="ea2-hero">
          <div className="ea2-copy">
            <p className="ea2-live mono">{open ? <>사전예약 진행 중 · D-{d}</> : "시범 운영 중"}</p>
            <h1 id="ea2-t"><span>단추를</span><br /><span>가장 먼저 만나보세요.</span></h1>
            <p className="ea2-sub">사전예약하고 시범 운영 소식을 문자로 받아보세요.</p>
          </div>
          <EarlySpec className="ea2-spec" />
        </div>
        <div className="ea2-low">
          <div className="ea2-side">
            <nav className="ea2-seg" aria-label="예약 갈래">
              <a href="/early" aria-current={role === "req" ? "page" : undefined}>의뢰자</a>
              <a href="/early?for=cro" aria-current={role === "cro" ? "page" : undefined}>시험 기관</a>
            </nav>
            <ul className="ea2-pts">{POINTS[role].map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
          <EarlyFlow key={role} role={role} id={`ef2-${role}`} />
        </div>
      </section>
    </Site>
  );
}
