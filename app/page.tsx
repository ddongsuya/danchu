import { Site } from "@/components/site/Site";
import { MarkDrift } from "@/components/site/MarkDrift";
import { HomeMotion } from "@/components/site/HomeMotion";
import { KindStrip } from "@/components/site/KindStrip";
import { EarlyPopup } from "@/components/site/EarlyPopup";
import { daysToPilot, preregActive } from "@/lib/prereg";
import "./home.css";

/** 사전예약 팝업·D-day 가 날짜를 따라가도록 한 시간마다 다시 만든다 */
export const revalidate = 3600;

/** 랜딩. 첫 화면은 떠도는 네 점이 마크로 맺히는 그림(MarkDrift, 캔버스), 아래 세 장면은 GSAP(HomeMotion)이 화면에 들어올 때 재생한다. 고정 장면이 있어 스크롤 스냅은 쓰지 않는다. */
const FL_CYCLE = [{"tag": "Tox", "t": "반복투여독성 4주", "k": "동물", "v": "설치류", "a": [1000, 8], "b": [900, 7]}, {"tag": "PD", "t": "효력시험 · 대장염 모델", "k": "동물", "v": "마우스", "a": [1500, 10], "b": [1350, 9]}, {"tag": "PK", "t": "약동학 · 단회 투여", "k": "검체", "v": "랫드 혈장", "a": [600, 5], "b": [540, 4]}, {"tag": "Other", "t": "혈액생화학 분석", "k": "시료", "v": "보유한 랫드 혈청", "a": [300, 3], "b": [270, 2]}];

export default function Home() {
  const prereg = preregActive();
  // 사전예약 기간에는 새 방문자의 첫 행동이 견적 요청이 아니라 사전예약이다 (lib/prereg.ts)
  const cta = prereg ? <a className="btn solid" href="/early">사전예약하기 <span className="ar">→</span></a> : <a className="btn solid" href="/request">견적 요청하기 <span className="ar">→</span></a>;
  return (
    <Site onescreen={false} headerCta={false}>
{prereg && <EarlyPopup days={daysToPilot()} />}
<div className="first">
<div className="hero">
<div>
<h1><span className="h1l" style={{ color: "inherit" }}>비임상 시험 견적,<br />단추에서 비교하세요.</span></h1>
<p className="sub">클릭 한 번으로 여러 기관의 견적을 받아보세요.</p>
<div className="ctas">{cta}<a className="btn ghost" href="/#fields">시험 종류 보기</a></div>
<p className="micro">의뢰자는 무료로 이용해요.</p>
</div>

<div className="fd fo" aria-hidden="true"><MarkDrift /></div>
</div>
</div>

{/* 네 갈래 소개 줄: 첫 화면(히어로) 아래, 다음 장면 앞 */}
<KindStrip />

<section id="cmp" className="gm gm-cmp" data-gm="cmp" aria-labelledby="cmp-h">
<div className="gm-cmp-grid">
<div className="gm-copy">
<h2 id="cmp-h">같은 시험, 다른 견적<br /><span>무엇이 다른지 비교하세요.</span></h2>
<p className="gm-lead">총액만 보면 B가 싸 보여요. 같은 항목끼리 보면 달라요.</p>
</div>
<figure className="gm-sheet" aria-label="예시 기관 A와 B의 견적 비교">
<header><b>B 기관 견적에는 TK 분석이 빠져 있어요.</b><small>반복투여독성 4주 · 설치류</small></header>
<table className="gm-items">
<thead><tr><th scope="col">항목</th><th scope="col">기관 A</th><th scope="col">기관 B</th></tr></thead>
<tbody>
<tr className="g-r1"><th scope="row">반복투여독성 4주</th><td>1,000만 원</td><td>900만 원</td></tr>
<tr className="g-r2"><th scope="row">TK 분석</th><td>200만 원</td><td><span className="g-v"><i className="g-mk"></i>빠짐</span></td></tr>
<tr className="g-r3"><th scope="row">영문 보고서</th><td>별도 견적</td><td>미포함</td></tr>
<tr className="g-total"><th scope="row">합계</th><td><b data-to="1200">1,200</b>만 원</td><td><b data-to="900">900</b>만 원</td></tr>
</tbody>
</table>
<p className="gm-gap">차이 <s className="g-old">300만 원</s> <span className="g-chip">같은 항목 기준 100만 원</span></p>
<figcaption>최종 금액은 각 기관의 정식 견적서로 확인하세요.</figcaption>
</figure>
</div>
</section>

{/* 요청서 예시가 Tox → PD → PK → Other 로 바뀌며 반복 재생된다 (HomeMotion). 금액은 그림용 예시 */}
<section className="gm gm-fl" data-gm="fl" aria-labelledby="fl-h" data-cycle={JSON.stringify(FL_CYCLE)}>
<h2 id="fl-h">한 장의 요청서가<br /><span>여러 기관을 찾아가요.</span></h2>
<div className="gm-dia">
<svg className="gm-wires" aria-hidden="true"><path className="w o"></path><path className="w o"></path><path className="w o"></path><path className="w i"></path><path className="w i"></path></svg>
<div className="gm-doc">
<span className="mono lab">요청서 · Tox</span>
<b>반복투여독성 4주</b>
<dl><div><dt>동물</dt><dd>설치류</dd></div><div><dt>기밀 등급</dt><dd>CDA 필요</dd></div><div><dt>보낸 곳</dt><dd>수행 분야가 맞는 기관</dd></div></dl>
</div>
<div className="gm-orgs">
<div className="g-org"><div><b>예시 기관 A</b><small>1,000만 원 · 8주</small></div><span className="g-st g-ok">회신 완료</span></div>
<div className="g-org"><div><b>예시 기관 B</b><small>900만 원 · 7주</small></div><span className="g-st g-pre">예비 견적</span></div>
<div className="g-org"><div><b>예시 기관 C</b><small>회신 기한 전</small></div><span className="g-st g-wip"><span className="g-dots"><b></b><b></b><b></b></span>작성 중</span></div>
</div>
<div className="gm-card">
<span className="mono lab">비교표</span>
<div className="g-mrow"><span>기관 A</span><span className="g-bt"><i style={{ "--w": "1" }}></i></span><em data-to="1000">1,000</em></div>
<div className="g-mrow"><span>기관 B</span><span className="g-bt"><i style={{ "--w": ".9" }}></i></span><em data-to="900">900</em></div>
<div className="g-mrow g-wait"><span>기관 C</span><span className="g-bt"><i style={{ "--w": "0" }}></i></span><em>대기</em></div>
<small>요청한 견적서가 모이면 비교 견적서가 도착해요. 직접 확인하고 기관을 선택할 수 있어요.</small>
</div>
<span className="g-cp" aria-hidden="true"><i></i><i></i><i></i></span><span className="g-cp" aria-hidden="true"><i></i><i></i><i></i></span><span className="g-cp" aria-hidden="true"><i></i><i></i><i></i></span>
<span className="g-rp" aria-hidden="true">1,000</span><span className="g-rp" aria-hidden="true">900</span>
</div>
<ol className="gm-steps"><li>요청하기</li><li>비교하기</li><li>고르기</li><i className="prog" aria-hidden="true"></i></ol>
</section>

<section className="gm gm-ev" data-gm="ev">
<div className="gm-ev-grid">
<div>
<h2>어떤 시험이 필요할지<br /><span>가이드라인에서 먼저 확인하세요.</span></h2>
<p className="lead">시험을 구성할 때 참고할 공개 가이드라인을 모아 두었어요.</p>
<div className="ctas" style={{ marginTop: "32px" }}><a className="btn g-ghost" href="/request/new?start=advisor">가이드라인 찾아보기</a></div>
</div>
<div className="gm-adv" aria-label="가이드라인 찾아보기 예시">
<div className="gm-ans"><span className="mono lab">답변</span><span className="g-chip">합성의약품</span><span className="g-chip">임상 1상</span><span className="g-chip">2주 투여</span></div>
<ul className="gm-sg">
<li className="g-sr"><div className="g-t"><b>반복투여독성 2주</b><small>설치류 1종, 비설치류 1종</small></div><span className="g-src"><i className="g-mk"></i>ICH M3</span><span className="g-pg" aria-hidden="true"><span>ICH M3</span><i style={{ "--w": ".8" }}></i><i className="g-hl" style={{ "--w": ".64" }}></i><i style={{ "--w": ".72" }}></i><i style={{ "--w": ".5" }}></i></span></li>
<li className="g-sr"><div className="g-t"><b>복귀돌연변이시험</b><small>임상 단회 투여 전</small></div><span className="g-src"><i className="g-mk"></i>OECD TG 471</span><span className="g-pg" aria-hidden="true"><span>OECD TG 471</span><i style={{ "--w": ".7" }}></i><i style={{ "--w": ".84" }}></i><i className="g-hl" style={{ "--w": ".58" }}></i><i style={{ "--w": ".66" }}></i></span></li>
<li className="g-sr"><div className="g-t"><b>안전성약리 핵심 시험</b><small>심혈관, 호흡, 중추신경</small></div><span className="g-src"><i className="g-mk"></i>ICH S7A</span><span className="g-pg" aria-hidden="true"><span>ICH S7A</span><i className="g-hl" style={{ "--w": ".74" }}></i><i style={{ "--w": ".62" }}></i><i style={{ "--w": ".8" }}></i><i style={{ "--w": ".54" }}></i></span></li>
</ul>
<p className="g-foot">참고 자료예요. 최종 설계는 규제기관, 담당 기관과 함께 정하세요.</p>
</div>
</div>
</section>

<section className="fin" aria-labelledby="fin-h">
<div className="fin-pin">
<div className="fin-grid">
<div className="copyin">
<h2 id="fin-h">비임상 시험의 시작은<br /><span>단추</span></h2>
<p className="lead">원하는 조건이 있으신가요? 단추에 요청하세요.</p>
<div className="ctas">{cta}</div>
</div>
<div className="bm" aria-hidden="true">
<div className="qs h" style={{ left: "28.9%", top: "28.9%", "--dx": "-300px", "--dy": "-190px", "--r": "-16deg", "--s": "1" }}></div>
<div className="qs h" style={{ left: "71.1%", top: "28.9%", "--dx": "280px", "--dy": "-220px", "--r": "13deg", "--s": "1" }}></div>
<div className="qs h" style={{ left: "28.9%", top: "71.1%", "--dx": "-320px", "--dy": "170px", "--r": "10deg", "--s": "1" }}></div>
<div className="qs h" style={{ left: "71.1%", top: "71.1%", "--dx": "300px", "--dy": "200px", "--r": "-11deg", "--s": "1" }}></div>
<div className="qs b" style={{ left: "50%", top: "50%", "--dx": "-20px", "--dy": "-300px", "--r": "5deg", "--s": ".7" }}></div>
<div className="qs b" style={{ left: "50%", top: "50%", "--dx": "-360px", "--dy": "-10px", "--r": "-7deg", "--s": ".7" }}></div>
<div className="qs b" style={{ left: "50%", top: "50%", "--dx": "360px", "--dy": "-30px", "--r": "8deg", "--s": ".7" }}></div>
<div className="qs b" style={{ left: "50%", top: "50%", "--dx": "30px", "--dy": "300px", "--r": "-4deg", "--s": ".7" }}></div>
<svg viewBox="0 0 400 400">
<g className="body">
<path transform="translate(20 20) scale(3.6)" d="M21.5 6.5H31.5A15 15 0 0 1 46.5 21.5V31.5A15 15 0 0 1 31.5 46.5H21.5A15 15 0 0 1 6.5 31.5V21.5A15 15 0 0 1 21.5 6.5ZM68.5 6.5H78.5A15 15 0 0 1 93.5 21.5V31.5A15 15 0 0 1 78.5 46.5H68.5A15 15 0 0 1 53.5 31.5V21.5A15 15 0 0 1 68.5 6.5ZM21.5 53.5H31.5A15 15 0 0 1 46.5 68.5V78.5A15 15 0 0 1 31.5 93.5H21.5A15 15 0 0 1 6.5 78.5V68.5A15 15 0 0 1 21.5 53.5ZM68.5 53.5H78.5A15 15 0 0 1 93.5 68.5V78.5A15 15 0 0 1 78.5 93.5H68.5A15 15 0 0 1 53.5 78.5V68.5A15 15 0 0 1 68.5 53.5Z" fill="#1B1B19"></path>
</g>
</svg>
</div>
</div>
<div className="cro"><p>시험 기관 담당자이신가요? 더 다양한 고객을 단추에서 만나보세요.</p><a className="btn ghost" href="/for-cro">기관으로 참여하기 <span className="ar">→</span></a></div>
</div>
</section>
      <HomeMotion />
    </Site>
  );
}
