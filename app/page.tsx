import { Site } from "@/components/site/Site";
import { Orbit } from "@/components/site/Orbit";
import { HomeMotion } from "@/components/site/HomeMotion";
import "./home.css";

/** 랜딩. 첫 화면은 궤도(순수 CSS), 아래 세 장면은 GSAP(HomeMotion)이 화면에 들어올 때 재생한다. 고정 장면이 있어 스크롤 스냅은 쓰지 않는다. */
export default function Home() {
  return (
    <Site onescreen={false}>
<div className="first">
<div className="hero">
<div>
<h1><span className="h1l" style={{ color: "inherit" }}>비임상 시험 견적<br />단추에 요청하세요.</span></h1>
<p className="sub">요청서 한 장이면, 여러 기관의 견적이 모여요.</p>
<div className="ctas"><a className="btn solid" href="/request">견적 요청하기 <span className="ar">→</span></a><a className="btn ghost" href="/#fields">어떤 시험을 비교할 수 있나요?</a></div>
</div>

<div className="fd fo" aria-hidden="true"><Orbit /></div>
</div>

<div className="strip">
<div><span className="mono">비용</span>무료로 이용해보세요!</div>
<div><span className="mono">회신</span>비교표로 나란히</div>
<div><span className="mono">기밀</span>CDA 체결로 안전하게</div>
<div><span className="mono">참고</span>가이드라인 기반</div>
</div>
<div className="mq">
<span className="lbl mono">이런 시험의 견적을 받아보세요</span>
<div className="vp">
<div className="track">
<span>일반독성</span><span>발암성·종양원성</span><span>유전독성</span><span>생식발생독성</span><span>항원성·면역독성</span><span>국소독성</span><span>국소내성</span><span>안전성약리</span><span>동물대체시험</span><span>조제물분석</span><span>PK/TK/ADME·생체시료분석</span><span>효력시험(약효)</span><span>환경유해성</span><span>의료기기 생물학적 안전성</span><span>임상병리·조직병리</span>
<span aria-hidden="true">일반독성</span><span aria-hidden="true">발암성·종양원성</span><span aria-hidden="true">유전독성</span><span aria-hidden="true">생식발생독성</span><span aria-hidden="true">항원성·면역독성</span><span aria-hidden="true">국소독성</span><span aria-hidden="true">국소내성</span><span aria-hidden="true">안전성약리</span><span aria-hidden="true">동물대체시험</span><span aria-hidden="true">조제물분석</span><span aria-hidden="true">PK/TK/ADME·생체시료분석</span><span aria-hidden="true">효력시험(약효)</span><span aria-hidden="true">환경유해성</span><span aria-hidden="true">의료기기 생물학적 안전성</span><span aria-hidden="true">임상병리·조직병리</span>
</div>
</div>
</div>

</div>

<section id="cmp" className="gm gm-cmp" data-gm="cmp" aria-labelledby="cmp-h">
<div className="gm-cmp-grid">
<div className="gm-copy">
<h2 id="cmp-h">같지만 다릅니다.<br /><span>다양한 항목들을 비교하세요.</span></h2>
<ol className="gm-ph">
<li><span className="mono">금액으로만 확인 하면</span><p>B가 더 저렴해 보여요</p></li>
<li><span className="mono">자세하게 비교하면</span><p>B 기관의 견적서에는 <b>TK 분석</b>이 빠져 있어요. 여기서 발생한 차이에요.</p></li>
<li><span className="mono">같은 항목으로 보면</span><p>실제 차이는 <b>100만원</b>이에요.</p></li>
</ol>
</div>
<figure className="gm-sheet" aria-label="예시 기관 A와 B의 견적 비교">
<header><b>반복투여독성 4주 · 설치류</b></header>
<div className="gm-plot">
<div className="gm-r gm-scale mono" aria-hidden="true"><span></span><div className="gm-tr"><span style={{ left: "0" }}>0</span><span style={{ left: "25%" }}>300</span><span style={{ left: "50%" }}>600</span><span style={{ left: "75%" }}>900</span><span style={{ left: "100%" }}>1,200</span></div><span></span></div>
<div className="gm-guides" aria-hidden="true"><div className="gm-tr"><i style={{ left: "75%" }}></i><i style={{ left: "83.333%" }}></i></div></div>
<div className="gm-r gm-bar" data-r="a"><span className="g-who">기관 A</span>
<div className="gm-tr"><span className="g-seg g-main" style={{ left: "0", width: "83.333%" }}><em>반복투여 4주</em></span><span className="g-seg g-tk" style={{ left: "83.333%", width: "16.667%" }}><em>TK</em></span></div>
<span className="g-sum"><b data-to="1200">1,200</b>만 원</span></div>
<div className="gm-r gm-bar" data-r="b"><span className="g-who">기관 B</span>
<div className="gm-tr"><span className="g-seg g-main" style={{ left: "0", width: "75%" }}><em>반복투여 4주</em></span>
<span className="g-seg g-ghost" style={{ left: "83.333%", width: "16.667%" }}><svg preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width="100%" height="100%" pathLength="100"></rect></svg><em>TK 없음</em></span></div>
<span className="g-sum"><b data-to="900">900</b>만 원</span></div>
<div className="gm-r gm-brks" aria-hidden="true"><span></span>
<div className="gm-tr">
<div className="g-brk g-tot" style={{ left: "75%", width: "25%" }}><i></i><span>총액 차이 300만 원</span></div>
<div className="g-brk g-tkb" style={{ left: "83.333%", width: "16.667%" }}><i></i><span>TK 200만 원</span></div>
<div className="g-brk g-same" style={{ left: "75%", width: "8.333%" }}><i></i><span>같은 시험 100만 원</span></div>
</div><span></span></div>
</div>
<table className="gm-items">
<thead><tr><th scope="col">항목</th><th scope="col">기관 A</th><th scope="col">기관 B</th></tr></thead>
<tbody>
<tr className="g-r1"><th scope="row">반복투여독성 4주</th><td><span className="g-v"><i className="g-mk"></i>1,000만 원</span></td><td><span className="g-v"><i className="g-mk"></i>900만 원</span></td></tr>
<tr className="g-r2"><th scope="row">TK 분석</th><td>200만 원</td><td><span className="g-v g-flag"><i className="g-mk"></i>미포함 · 기관 확인</span></td></tr>
<tr className="g-r3"><th scope="row">영문 보고서</th><td>별도 견적</td><td><span className="g-v g-flag"><i className="g-mk"></i>미포함</span></td></tr>
<tr className="g-r4 g-total"><th scope="row">합계</th><td>1,200만 원</td><td>900만 원</td></tr>
</tbody>
</table>
<figcaption className="mono">최종 견적서는 각 기관의 견적서로 확인합니다.</figcaption>
</figure>
</div>
</section>

<section className="gm gm-fl" data-gm="fl" aria-labelledby="fl-h">
<h2 id="fl-h">한 장의 요청서가<br /><span>여러 기관을 찾아가요.</span></h2>
<div className="gm-dia">
<svg className="gm-wires" aria-hidden="true"><path className="w o"></path><path className="w o"></path><path className="w o"></path><path className="w i"></path><path className="w i"></path></svg>
<div className="gm-doc">
<span className="mono">요청서</span>
<b>반복투여독성 4주</b>
<dl><div><dt>동물</dt><dd>설치류</dd></div><div><dt>기밀 등급</dt><dd>CDA 필요</dd></div><div><dt>보낸 곳</dt><dd>수행 분야가 맞는 기관</dd></div></dl>
</div>
<div className="gm-orgs">
<div className="g-org"><div><b>예시 기관 A</b><small>1,000만 원 · 8주</small></div><span className="g-st g-ok">회신 완료</span></div>
<div className="g-org"><div><b>예시 기관 B</b><small>900만 원 · 7주</small></div><span className="g-st g-pre">예비 견적</span></div>
<div className="g-org"><div><b>예시 기관 C</b><small>회신 기한 전</small></div><span className="g-st g-wip"><span className="g-dots"><b></b><b></b><b></b></span>작성 중</span></div>
</div>
<div className="gm-card">
<span className="mono">비교표</span>
<div className="g-mrow"><span>기관 A</span><span className="g-bt"><i style={{ "--w": "1" }}></i></span><em data-to="1000">1,000</em></div>
<div className="g-mrow"><span>기관 B</span><span className="g-bt"><i style={{ "--w": ".9" }}></i></span><em data-to="900">900</em></div>
<div className="g-mrow g-wait"><span>기관 C</span><span className="g-bt"><i style={{ "--w": "0" }}></i></span><em>대기</em></div>
<small>회신 2/3 · 비교표가 완성되면 기관을 선택할 수 있어요.</small>
</div>
<span className="g-cp" aria-hidden="true"><i></i><i></i><i></i></span><span className="g-cp" aria-hidden="true"><i></i><i></i><i></i></span><span className="g-cp" aria-hidden="true"><i></i><i></i><i></i></span>
<span className="g-rp" aria-hidden="true">1,000</span><span className="g-rp" aria-hidden="true">900</span>
</div>
<ol className="gm-steps"><li>요청하기</li><li>회신 받기</li><li>비교하고 고르기</li><i className="prog" aria-hidden="true"></i></ol>
</section>

<section className="gm gm-ev" data-gm="ev">
<div className="gm-ev-grid">
<div>
<h2>비교 견적 요청 전에<br /><span>가이드라인 부터 살펴보세요.</span></h2>
<p className="lead">시험 구성에 참고할 공개 가이드라인을 정리해 두었어요.</p>
<div className="ctas" style={{ marginTop: "32px" }}><a className="btn g-ghost" href="/request/new?start=advisor">가이드라인 찾아보기</a></div>
</div>
<div className="gm-adv" aria-label="가이드라인 찾아보기 예시">
<div className="gm-ans"><span className="mono">답변</span><span className="g-chip">합성의약품</span><span className="g-chip">임상 1상</span><span className="g-chip">2주 투여</span></div>
<ul className="gm-sg">
<li className="g-sr"><div className="g-t"><b>반복투여독성 2주</b><small>설치류 1종, 비설치류 1종</small></div><span className="g-src"><i className="g-mk"></i>ICH M3</span><span className="g-pg" aria-hidden="true"><span>ICH M3</span><i style={{ "--w": ".8" }}></i><i className="g-hl" style={{ "--w": ".64" }}></i><i style={{ "--w": ".72" }}></i><i style={{ "--w": ".5" }}></i></span></li>
<li className="g-sr"><div className="g-t"><b>복귀돌연변이시험</b><small>임상 단회 투여 전</small></div><span className="g-src"><i className="g-mk"></i>OECD TG 471</span><span className="g-pg" aria-hidden="true"><span>OECD TG 471</span><i style={{ "--w": ".7" }}></i><i style={{ "--w": ".84" }}></i><i className="g-hl" style={{ "--w": ".58" }}></i><i style={{ "--w": ".66" }}></i></span></li>
<li className="g-sr"><div className="g-t"><b>안전성약리 핵심 시험</b><small>심혈관, 호흡, 중추신경</small></div><span className="g-src"><i className="g-mk"></i>ICH S7A</span><span className="g-pg" aria-hidden="true"><span>ICH S7A</span><i className="g-hl" style={{ "--w": ".74" }}></i><i style={{ "--w": ".62" }}></i><i style={{ "--w": ".8" }}></i><i style={{ "--w": ".54" }}></i></span></li>
</ul>
<p className="g-foot">참고 자료에요. 최종 설계는 규제기관, 담당 기관과 함께 논의하세요.</p>
</div>
</div>
</section>

<section className="fin" aria-labelledby="fin-h">
<div className="fin-pin">
<div className="fin-grid">
<div className="copyin">
<h2 id="fin-h">비임상 시험의 시작은<br /><span>단추</span></h2>
<p className="lead">조건에 맞는 기관, 단추에서 먼저 만나보세요.</p>
<div className="ctas"><a className="btn solid" href="/request">견적 요청하기 <span className="ar">→</span></a></div>
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
<div className="cro"><p>시험 기관에서 근무중이신가요? 분야에 맞는 요청서를 단추에서 받아보세요.</p><a className="btn ghost" href="/for-cro">기관으로 참여하기 <span className="ar">→</span></a></div>
</div>
</section>
      <HomeMotion />
    </Site>
  );
}
