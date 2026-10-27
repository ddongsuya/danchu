import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import { GuideWeeksReel, GuideIndReel, GuideTestsReel } from "@/components/site/reel/Reels";
import "./page.css";

export const metadata: Metadata = {
  title: "시험 가이드 · 단추",
  description: "어떤 비임상 시험이 필요한지, 반복투여독성은 몇 주가 필요한지 ICH·식약처 가이드라인으로 확인하세요.",
};

export default function Page() {
  return (
    <Site current="/guide" next={{ href: "/faq", label: "자주 묻는 질문" }}>
<section className="ph big" aria-labelledby="t">
<div><h1 id="t">필요한 시험,<br /><span>가이드라인으로<br />먼저 확인하세요.</span></h1></div>
<div><p className="lead">시험 구성의 첫 단추를 여기서 끼워보세요.</p></div>
</section>

<section className="rsx film-weeks" aria-labelledby="du"><header><h2 id="du">반복투여독성 시험은<br /><span>몇 주가 필요할까요?</span></h2></header><GuideWeeksReel /></section>
<section className="rsx side" aria-labelledby="pk"><header><h2 id="pk">IND 제출을 고려중이신가요?</h2><a className="btn solid" href="/request/new?preset=ind_small">이 구성 그대로 요청하기 <span className="ar">→</span></a></header><GuideIndReel /></section>
<section className="rsx side" aria-labelledby="ex"><header><h2 id="ex">다양한 시험들의&nbsp;<br /><span>정보를 확인하세요.</span></h2></header><GuideTestsReel /></section>
<div className="gmore"><details className="more2"><summary>다른 시험 설계 더 보기</summary>
<div className="ex">

<details><summary><b>반복투여독성 (13주)</b><span>3개월까지의 임상, 1개월 이내 의약품의 허가 신청</span></summary>
<dl><dt>동물종</dt><dd>설치류 1종 + 비설치류 1종</dd><dt>동물 수</dt><dd>설치류 군당 암수 각 10마리 이상, 비설치류 암수 각 3~4마리</dd><dt>회복군</dt><dd>대조군과 고용량군, 회복 4주가 일반적</dd><dt>TK</dt><dd>병행 (투여 첫날과 마지막 주)</dd><dt>GLP</dt><dd>GLP</dd><p className="basis">근거 식약처 독성시험기준 · ICH M3</p></dl></details>
<details><summary><b>만성 반복투여독성 (26주 이상)</b><span>6개월을 넘는 임상과 장기 투여 의약품</span></summary>
<dl><dt>기간</dt><dd>설치류 6개월(26주), 비설치류 9개월(39주). 제출처에 따라 비설치류 6개월이 인정되기도 해요.</dd><dt>동물 수</dt><dd>설치류 군당 암수 각 10마리 이상, 비설치류 암수 각 4마리 수준</dd><dt>TK</dt><dd>병행</dd><dt>GLP</dt><dd>GLP</dd><p className="basis">근거 ICH M3 · ICH S4</p></dl></details>
<details><summary><b>용량결정시험(DRF)</b><span>본시험의 고용량과 용량 간격을 정하는 예비시험</span></summary>
<dl><dt>동물종</dt><dd>본시험과 같은 종·계통</dd><dt>동물 수</dt><dd>설치류 군당 암수 각 3~5마리, 비설치류 암수 각 1~2마리 수준</dd><dt>평가</dt><dd>일반증상·체중·사료섭취·임상병리·부검. 조직병리는 선택</dd><dt>GLP</dt><dd>보통 Non-GLP</dd><p className="basis">근거 ICH M3 · 식약처 독성시험기준</p></dl></details>
<details><summary><b>단회투여독성</b><span>한 번 투여했을 때의 독성 양상과 개략의 치사량</span></summary>
<dl><dt>동물종</dt><dd>설치류 1종 + 비설치류 1종 (통상 랫드, 비글)</dd><dt>동물 수</dt><dd>설치류 군당 암수 각 5마리 이상, 비설치류 암수 각 2마리 이상</dd><dt>관찰</dt><dd>투여 후 14일, 일반증상·체중·부검</dd><dt>GLP</dt><dd>허가 제출용이면 GLP</dd><p className="basis">근거 식약처 독성시험기준 · ICH M3</p></dl></details>
</div>
</details></div>
<section className="lavc" aria-labelledby="go"><div>
<h2 id="go" className="huge">구성이 막막하다면,<br /><span>내 상황에 맞는 시험부터 찾아보세요.</span></h2></div><div className="act"><div><p className="actk">개발 단계</p><div className="pick"><input type="radio" name="gs" id="gs0" /><label htmlFor="gs0">임상시험 진입</label><input type="radio" name="gs" id="gs1" /><label htmlFor="gs1">품목허가 신청</label></div></div><div><p className="actk">제품 유형</p><div className="pick"><input type="radio" name="gt" id="gt0" /><label htmlFor="gt0">합성의약품</label><input type="radio" name="gt" id="gt1" /><label htmlFor="gt1">바이오의약품</label><input type="radio" name="gt" id="gt2" /><label htmlFor="gt2">세포·유전자치료제</label><input type="radio" name="gt" id="gt3" /><label htmlFor="gt3">건강기능식품</label><input type="radio" name="gt" id="gt4" /><label htmlFor="gt4">화장품</label><input type="radio" name="gt" id="gt5" /><label htmlFor="gt5">의료기기</label><input type="radio" name="gt" id="gt6" /><label htmlFor="gt6">화학물질·농약</label></div></div><div className="ctas"><a className="btn solid gate gate2" href="/request/new?start=advisor">필요한 시험 찾기 <span className="ar">→</span></a></div><p className="gatehint">하나를 고르면 바로 시작할 수 있어요.</p></div>
</section>
    </Site>
  );
}
