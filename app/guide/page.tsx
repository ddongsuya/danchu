import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
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

<section className="film2 bandw player" style={{ "--T": "13.5s", "--F": "-11.5s" }} aria-labelledby="du">
<div className="s2g">
<div className="fst" role="img" aria-label="임상 투여기간에 따라 설치류와 비설치류 반복투여독성 기간이 정해지는 과정">
<div className="shk fe" style={{ "--n": "gd42" }}>
<div className="cam fe" style={{ "--n": "gd0" }}>
<div className="grid fe" style={{ "--n": "gd40" }}></div>
<div className="fe tx k" style={{ "--n": "gd1", left: "7.0cqw", top: "33.0cqw", width: "24.0cqw", height: "8.0cqw" }}>임상 투여</div>
<div className="fe tx k" style={{ "--n": "gd2", left: "7.0cqw", top: "52.0cqw", width: "24.0cqw", height: "8.0cqw" }}>설치류</div>
<div className="fe tx k" style={{ "--n": "gd3", left: "7.0cqw", top: "64.0cqw", width: "24.0cqw", height: "8.0cqw" }}>비설치류</div>
<div className="fe ln f" style={{ "--n": "gd4", left: "7.0cqw", top: "45.0cqw", width: "86.0cqw" }}></div>
<div className="fe grp" style={{ "--n": "gd5" }}><div className="fe tg ink" style={{ "--n": "gd6", left: "29.0cqw", top: "13.8cqw", width: "42.0cqw", height: "6.4cqw", fontSize: "3.2cqw" }}>임상 2주 이내</div><div className="fe gbar ink" style={{ "--n": "gd7", left: "29.0cqw", top: "34.5cqw", width: "4.8cqw", height: "5.0cqw" }}></div><div className="fe tx" style={{ "--n": "gd8", left: "35.8cqw", top: "33.0cqw", width: "30.0cqw", height: "8.0cqw" }}>2주</div><div className="fe gbar" style={{ "--n": "gd9", left: "29.0cqw", top: "53.5cqw", width: "4.8cqw", height: "5.0cqw" }}></div><div className="fe gbar" style={{ "--n": "gd10", left: "29.0cqw", top: "65.5cqw", width: "4.8cqw", height: "5.0cqw" }}></div><div className="fe tx h" style={{ "--n": "gd11", left: "35.8cqw", top: "52.0cqw", width: "30.0cqw", height: "8.0cqw" }}>2주</div><div className="fe tx h" style={{ "--n": "gd12", left: "35.8cqw", top: "64.0cqw", width: "30.0cqw", height: "8.0cqw" }}>2주</div><div className="fe tg" style={{ "--n": "gd13", left: "26.5cqw", top: "81.0cqw", width: "47.0cqw", height: "6.0cqw" }}>요청서 항목 · 반복투여 2주</div></div>
<div className="fe grp" style={{ "--n": "gd14" }}><div className="fe tg ink" style={{ "--n": "gd15", left: "29.0cqw", top: "13.8cqw", width: "42.0cqw", height: "6.4cqw", fontSize: "3.2cqw" }}>임상 2주 초과 ~ 6개월</div><div className="fe gbar ink" style={{ "--n": "gd16", left: "29.0cqw", top: "34.5cqw", width: "16.0cqw", height: "5.0cqw" }}></div><div className="fe tx" style={{ "--n": "gd17", left: "47.0cqw", top: "33.0cqw", width: "30.0cqw", height: "8.0cqw" }}>예: 3개월</div><div className="fe gbar" style={{ "--n": "gd18", left: "29.0cqw", top: "53.5cqw", width: "16.0cqw", height: "5.0cqw" }}></div><div className="fe gbar" style={{ "--n": "gd19", left: "29.0cqw", top: "65.5cqw", width: "16.0cqw", height: "5.0cqw" }}></div><div className="fe tx h" style={{ "--n": "gd20", left: "47.0cqw", top: "52.0cqw", width: "30.0cqw", height: "8.0cqw" }}>3개월</div><div className="fe tx h" style={{ "--n": "gd21", left: "47.0cqw", top: "64.0cqw", width: "30.0cqw", height: "8.0cqw" }}>3개월</div><div className="fe tg ac" style={{ "--n": "gd22", left: "62.0cqw", top: "59.5cqw", width: "20.0cqw", height: "5.0cqw" }}>임상과 같게</div><div className="fe tg" style={{ "--n": "gd23", left: "26.5cqw", top: "81.0cqw", width: "47.0cqw", height: "6.0cqw" }}>요청서 항목 · 반복투여 13주</div></div>
<div className="fe grp" style={{ "--n": "gd24" }}><div className="fe tg ink" style={{ "--n": "gd25", left: "29.0cqw", top: "13.8cqw", width: "42.0cqw", height: "6.4cqw", fontSize: "3.2cqw" }}>임상 6개월 초과</div><div className="fe gbar ink" style={{ "--n": "gd26", left: "29.0cqw", top: "34.5cqw", width: "48.0cqw", height: "5.0cqw" }}></div><div className="fe tx" style={{ "--n": "gd27", left: "79.0cqw", top: "33.0cqw", width: "30.0cqw", height: "8.0cqw" }}>6개월 넘게</div><div className="fe tx k" style={{ "--n": "gd28", left: "73.0cqw", top: "33.0cqw", width: "6.0cqw", height: "8.0cqw", color: "var(--paper)" }}>→</div><div className="fe gbar" style={{ "--n": "gd29", left: "29.0cqw", top: "53.5cqw", width: "32.0cqw", height: "5.0cqw" }}></div><div className="fe gbar" style={{ "--n": "gd30", left: "29.0cqw", top: "65.5cqw", width: "48.0cqw", height: "5.0cqw" }}></div><div className="fe tx h" style={{ "--n": "gd31", left: "63.0cqw", top: "52.0cqw", width: "30.0cqw", height: "8.0cqw" }}>6개월</div><div className="fe tx h" style={{ "--n": "gd32", left: "79.0cqw", top: "64.0cqw", width: "30.0cqw", height: "8.0cqw" }}>9개월</div><div className="fe tg" style={{ "--n": "gd33", left: "26.5cqw", top: "81.0cqw", width: "47.0cqw", height: "6.0cqw" }}>요청서 항목 · 반복투여 26주 · 39주</div></div>
</div>
</div>
</div>

<div><h2 id="du">반복투여독성 시험은<br /><span>몇 주가 필요할까요?</span></h2>
<div className="tabs2" role="group" aria-label="임상 투여기간 고르기" style={{ marginTop: "32px" }}><input className="tbi" type="radio" name="gd-step" id="gd-k0" /><label htmlFor="gd-k0"><span className="tb">2주 이내</span><span className="fe tt" style={{ "--n": "gd34" }}>2주 이내</span><i className="fe" style={{ "--n": "gd35" }}></i></label><input className="tbi" type="radio" name="gd-step" id="gd-k1" /><label htmlFor="gd-k1"><span className="tb">2주 초과 ~ 6개월</span><span className="fe tt" style={{ "--n": "gd36" }}>2주 초과 ~ 6개월</span><i className="fe" style={{ "--n": "gd37" }}></i></label><input className="tbi" type="radio" name="gd-step" id="gd-k2" /><label htmlFor="gd-k2"><span className="tb">6개월 초과</span><span className="fe tt" style={{ "--n": "gd38" }}>6개월 초과</span><i className="fe" style={{ "--n": "gd39" }}></i></label><p className="hint">임상 투여기간을 눌러 확인해보세요. 근거 ICH M3</p></div></div>
</div>
</section>
<section className="film gsec" aria-labelledby="pk" style={{ "--T": "15s", "--F": "-5.5s" }} aria-label="임상 1상 전에 필요한 시험이 합성의약품과 바이오의약품별로 채워지는 과정">
<div className="fside">
<h2 id="pk">IND 제출을 고려중이신가요?</h2><div className="ctas" style={{ marginTop: "28px" }}><a className="btn solid" href="/request/new?preset=ind_small">이 구성 그대로 요청하기 <span className="ar">→</span></a></div>

<div className="fctl"><span className="fbar" aria-hidden="true"><i className="fe" style={{ "--n": "gp28" }}></i></span></div>
</div>
<div className="fst" role="img" aria-label="임상 1상 전에 필요한 시험이 합성의약품과 바이오의약품별로 채워지는 과정">
<div className="shk fe" style={{ "--n": "gp29" }}>
<div className="cam fe" style={{ "--n": "gp1" }}>
<div className="grid fe" style={{ "--n": "gp27" }}></div>
<div className="fe fm" style={{ "--n": "gp0", left: "7.0cqw", top: "16.0cqw", width: "86.0cqw", height: "62.0cqw" }}></div>
<div className="fe grp" style={{ "--n": "gp2" }}><div className="fe tg ink" style={{ "--n": "gp3", left: "28.0cqw", top: "18.5cqw", width: "44.0cqw", height: "6.0cqw" }}>합성의약품 (저분자·경구)</div><div className="fe tx k" style={{ "--n": "gp4", left: "12.0cqw", top: "26.0cqw", width: "30.0cqw", height: "5.0cqw" }}>임상 1상 전</div><div className="fe tile" style={{ "--n": "gp5", left: "11.5cqw", top: "31.0cqw", width: "37.0cqw", height: "10.0cqw" }}><b>반복투여독성</b><small>설치류 + 비설치류 · ICH M3</small></div><div className="fe tile" style={{ "--n": "gp6", left: "51.5cqw", top: "31.0cqw", width: "37.0cqw", height: "10.0cqw" }}><b>용량결정시험(DRF)</b><small>보통 Non-GLP</small></div><div className="fe tile" style={{ "--n": "gp7", left: "11.5cqw", top: "43.0cqw", width: "37.0cqw", height: "10.0cqw" }}><b>단회투여독성</b><small>DRF로 갈음 가능 (규제기관과 확인하세요)</small></div><div className="fe tile" style={{ "--n": "gp8", left: "51.5cqw", top: "43.0cqw", width: "37.0cqw", height: "10.0cqw" }}><b>유전독성</b><small>Ames + 염색체이상 · ICH S2</small></div><div className="fe tile" style={{ "--n": "gp9", left: "11.5cqw", top: "55.0cqw", width: "37.0cqw", height: "10.0cqw" }}><b>안전성약리 · hERG</b><small>ICH S7A·S7B</small></div><div className="fe tile" style={{ "--n": "gp10", left: "51.5cqw", top: "55.0cqw", width: "37.0cqw", height: "10.0cqw" }}><b>TK · 조제물분석</b><small>GLP 시험에 병행</small></div><div className="fe tx k" style={{ "--n": "gp11", left: "12.0cqw", top: "71.0cqw", width: "30.0cqw", height: "5.0cqw" }}>나중 단계에서 검토</div><div className="fe tg" style={{ "--n": "gp12", left: "12.0cqw", top: "77.0cqw", width: "19.6cqw", height: "5.0cqw" }}>생식발생독성</div><div className="fe tg" style={{ "--n": "gp13", left: "33.0cqw", top: "77.0cqw", width: "11.8cqw", height: "5.0cqw" }}>발암성</div><div className="fe tg" style={{ "--n": "gp14", left: "46.2cqw", top: "77.0cqw", width: "14.4cqw", height: "5.0cqw" }}>국소내성</div><div className="fe tg" style={{ "--n": "gp15", left: "62.0cqw", top: "77.0cqw", width: "27.4cqw", height: "5.0cqw" }}>면역독성·광안전성</div></div>
<div className="fe grp" style={{ "--n": "gp16" }}><div className="fe tg ink" style={{ "--n": "gp17", left: "28.0cqw", top: "18.5cqw", width: "44.0cqw", height: "6.0cqw" }}>바이오의약품</div><div className="fe tx k" style={{ "--n": "gp18", left: "12.0cqw", top: "26.0cqw", width: "30.0cqw", height: "5.0cqw" }}>임상 1상 전</div><div className="fe tile" style={{ "--n": "gp19", left: "11.5cqw", top: "31.0cqw", width: "37.0cqw", height: "10.0cqw" }}><b>관련 동물종 선정</b><small>ICH S6</small></div><div className="fe tile" style={{ "--n": "gp20", left: "51.5cqw", top: "31.0cqw", width: "37.0cqw", height: "10.0cqw" }}><b>반복투여독성</b><small>회복군 + TK + ADA · ICH S6</small></div><div className="fe tile" style={{ "--n": "gp21", left: "11.5cqw", top: "43.0cqw", width: "37.0cqw", height: "10.0cqw" }}><b>안전성약리</b><small>독성시험에 통합 가능</small></div><div className="fe tile dim" style={{ "--n": "gp22", left: "51.5cqw", top: "43.0cqw", width: "37.0cqw", height: "10.0cqw" }}><b>유전독성</b><small>통상 불필요</small></div><div className="fe tile" style={{ "--n": "gp23", left: "11.5cqw", top: "55.0cqw", width: "37.0cqw", height: "10.0cqw" }}><b>국소내성 · 조직교차반응성</b><small>주사제 · 항체 의약품</small></div><div className="fe tx k" style={{ "--n": "gp24", left: "12.0cqw", top: "71.0cqw", width: "30.0cqw", height: "5.0cqw" }}>나중 단계에서 검토</div><div className="fe tg" style={{ "--n": "gp25", left: "12.0cqw", top: "77.0cqw", width: "40.4cqw", height: "5.0cqw" }}>생식발생독성 (ePPND)</div><div className="fe tg" style={{ "--n": "gp26", left: "53.8cqw", top: "77.0cqw", width: "19.6cqw", height: "5.0cqw" }}>발암성 평가</div></div>
</div>
</div>
</div>
</section>
<section className="film gsec rev" aria-labelledby="ex" style={{ "--T": "16s" }}>
<div className="fside">
<h2 id="ex">다양한 시험들의&nbsp;<br /><span>정보를 확인하세요.</span></h2>

<div className="fctl"><span className="fbar" aria-hidden="true"><i className="fe" style={{ "--n": "gx148" }}></i></span></div>
</div>
<div className="fst gi" role="img" aria-label="시험마다 동물종, 기간, 동물 수, GLP 같은 정보가 정리된 카드가 차례로 넘어가는 장면: 단회투여독성, 반복투여독성, 유전독성, 안전성약리">
<div className="gi-list" aria-hidden="true"><span className="fe gi-it" style={{ "--n": "giOn", "--cd": "-16.00s" }}>단회투여독성</span><span className="fe gi-it" style={{ "--n": "giOn", "--cd": "-12.00s" }}>반복투여독성</span><span className="fe gi-it" style={{ "--n": "giOn", "--cd": "-8.00s" }}>유전독성</span><span className="fe gi-it" style={{ "--n": "giOn", "--cd": "-4.00s" }}>안전성약리</span><span className="gi-it off">생식독성</span><span className="gi-it off">국소독성</span></div>
<div className="gi-deck" aria-hidden="true">
<div className="fe gi-card" style={{ "--n": "giCard", "--cd": "-16.00s" }}><b className="gi-t">단회투여독성</b><p className="gi-s">한 번 투여했을 때의 독성 양상</p><dl><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-16.00s" }}><dt>동물종</dt><dd>설치류 + 비설치류</dd></div><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-15.88s" }}><dt>관찰</dt><dd><span className="gi-v"><i className="fe gi-mk" style={{ "--n": "giMark", "--cd": "-16.00s" }}></i>투여 후 14일</span></dd></div><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-15.76s" }}><dt>동물 수</dt><dd>설치류 군당 암수 각 5마리 이상</dd></div><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-15.64s" }}><dt>GLP</dt><dd>허가 제출용이면 GLP</dd></div></dl><p className="gi-b">근거 식약처 독성시험기준</p></div>
<div className="fe gi-card" style={{ "--n": "giCard", "--cd": "-12.00s" }}><b className="gi-t">반복투여독성</b><p className="gi-s">3개월까지의 임상을 위한 13주 시험</p><dl><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-12.00s" }}><dt>동물종</dt><dd>설치류 + 비설치류</dd></div><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-11.88s" }}><dt>기간</dt><dd><span className="gi-v"><i className="fe gi-mk" style={{ "--n": "giMark", "--cd": "-12.00s" }}></i>투여 13주 + 회복 4주</span></dd></div><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-11.76s" }}><dt>동물 수</dt><dd>설치류 군당 암수 각 10마리 이상</dd></div><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-11.64s" }}><dt>TK</dt><dd>병행</dd></div></dl><p className="gi-b">근거 ICH M3 · 식약처 독성시험기준</p></div>
<div className="fe gi-card" style={{ "--n": "giCard", "--cd": "-8.00s" }}><b className="gi-t">유전독성</b><p className="gi-s">복귀돌연변이시험 (Ames)</p><dl><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-8.00s" }}><dt>시험계</dt><dd><span className="gi-v"><i className="fe gi-mk" style={{ "--n": "giMark", "--cd": "-8.00s" }}></i>살모넬라 4균주 + 대장균 1균주</span></dd></div><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-7.88s" }}><dt>대사활성화</dt><dd>S9 있을 때와 없을 때 모두</dd></div><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-7.76s" }}><dt>판정</dt><dd>복귀돌연변이 집락 수 증가</dd></div><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-7.64s" }}><dt>GLP</dt><dd>GLP</dd></div></dl><p className="gi-b">근거 OECD TG 471 · ICH S2</p></div>
<div className="fe gi-card" style={{ "--n": "giCard", "--cd": "-4.00s" }}><b className="gi-t">안전성약리</b><p className="gi-s">주요 장기 기능에 미치는 영향</p><dl><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-4.00s" }}><dt>평가</dt><dd><span className="gi-v"><i className="fe gi-mk" style={{ "--n": "giMark", "--cd": "-4.00s" }}></i>중추신경계 · 심혈관계 · 호흡계</span></dd></div><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-3.88s" }}><dt>심장</dt><dd>hERG 시험 (in vitro)</dd></div><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-3.76s" }}><dt>심혈관</dt><dd>비설치류 원격측정</dd></div><div className="fe gi-row" style={{ "--n": "giRow", "--cd": "-3.64s" }}><dt>GLP</dt><dd>GLP</dd></div></dl><p className="gi-b">근거 ICH S7A · ICH S7B</p></div>
</div>
</div>
</section>
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
