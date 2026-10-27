import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import { AboutReel } from "@/components/site/reel/Reels";
import "./page.css";

export const metadata: Metadata = {
  title: "서비스 소개 · 단추",
  description: "한번 요청으로 여러 기관에. 비임상 시험 견적을 편하게 비교하세요.",
};

export default function Page() {
  return (
    <Site current="/about" next={{ href: "/how-it-works", label: "이용 안내" }}>
<section className="ph2" aria-labelledby="t">
<h1 id="t">단추는?</h1>
<p className="lead">단추는 다양한 비임상시험 비교 견적을 제공합니다.</p>
</section>
<section className="rsx film-about" aria-label="서비스 소개 영상"><AboutReel /></section>
<section className="say scene" aria-label="단추로 바뀌는 것"><p className="sv" style={{ "--k": "litc", "--r": "entry 40% cover 38%" }}>한번의 요청으로 여러 기관에.</p><p className="sv" style={{ "--k": "litc", "--r": "entry 52% cover 46%" }}>편하게 비교하세요.</p></section>
<section className="lavc" aria-labelledby="go"><div><h2 id="go" className="huge">지금 견적을<br /><span>요청해보세요.</span></h2></div><div className="act"><div><p className="actk">어떤 시험이 필요하세요?</p><div className="pick"><a href="/request/new?start=manual">일반독성</a><a href="/request/new?start=manual">유전독성</a><a href="/request/new?start=manual">안전성약리</a><a href="/request/new?start=manual">생식발생독성</a><a href="/request/new?start=manual">발암성</a><a href="/request/new?start=manual">국소내성</a></div></div><div className="ctas"><a className="btn solid" href="/request">견적 요청하기 <span className="ar">→</span></a><a className="btn ghost" href="/request/new?start=advisor">가이드라인 먼저 보기</a></div></div></section>
    </Site>
  );
}