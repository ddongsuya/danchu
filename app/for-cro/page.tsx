import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import { CroHeroReel, CroStepsReel, CroReplyReel, CroRulesReel } from "@/components/site/reel/Reels";
import "./page.css";

export const metadata: Metadata = {
  title: "기관 참여 안내 · 단추",
  description: "수행 분야에 맞는 요청서를 받고 같은 양식으로 견적을 회신하세요. 2027년 말까지는 기관도 무료예요.",
};

export default function Page() {
  return (
    <Site current="/for-cro" next={{ href: "/faq", label: "자주 묻는 질문" }}>
<section className="ph vis" aria-labelledby="t">
<div>
<h1 id="t">더 다양한 고객,<br /><span>단추에서 만나보세요.</span></h1>
<p className="lead" style={{ marginTop: "24px" }}>참여하고 견적서를 회신해보세요.</p>
</div>
<figure className="hfilm"><CroHeroReel /></figure>
</section>

<section className="rsx film-steps" aria-labelledby="st"><header><h2 id="st">참여부터 계약까지<br /><span>이렇게 진행돼요.</span></h2></header><CroStepsReel /></section>

<section className="rsx side" aria-labelledby="fm"><header><h2 id="fm">단추에 견적서를<br /><span>보내주세요.</span><br />정리는 단추가 해요.</h2></header><CroReplyReel /></section>

<section className="rsx side" aria-labelledby="ru"><header><h2 id="ru">모든 기관에<br /><span>같은 규칙이 적용돼요.</span></h2></header><CroRulesReel /></section>

<section className="freeb" aria-labelledby="tm" id="cro-terms">
<div className="fg">
<h2 id="tm" className="huge">무료로<br /><span>참여해보세요.</span></h2>
<div className="fr">
<p className="lead">그리고 단추가 마음에 든다면 협업을 결정해주세요.</p>
<div className="act"><div><p className="actk">이것만 있으면 시작할 수 있어요.</p><div className="chk"><label><input type="checkbox" />기관명</label><label><input type="checkbox" />보유 GLP 인증</label><label><input type="checkbox" />수행 가능 분야</label><label><input type="checkbox" />담당자 연락처</label></div></div>
<div className="ctas"><a className="btn solid gate" href="/signup/cro">기관 참여 신청 <span className="ar">→</span></a><a className="btn ghost" href="mailto:limjm900202@gmail.com">limjm900202@gmail.com</a></div><p className="gatehint">네가지 모두 확인하면 신청할 수 있어요.</p><a className="later" href="/signup/cro">먼저 가입하고 채워 넣을게요</a></div>
<details className="terms"><summary>이용 조건과 요금표 보기</summary>
<div className="tm">
<section><h3>이용 조건 동의 및 참여 기록</h3>
<p>단추를 운영하는 회사(이하 &ldquo;회사&rdquo;)의 견적 요청에 기관이 &lsquo;참여하기&rsquo;를 누르면 본 이용 조건에 동의하는 것입니다. 회사는 누른 시각, 경로(포털 또는 회신 링크), 누른 담당자 계정(회신 링크로 참여한 경우 링크 식별값), 적용된 조건의 판을 참여 기록으로 보관합니다. 접속 IP 주소와 브라우저 정보도 함께 기록하며, 이 두 가지는 개인정보처리방침에 따라 3개월이 지나면 삭제합니다.</p></section>
<section><h3>무료 이용 기간</h3>
<p><strong>2027년 12월 31일까지 기관이 참여한 요청에는 이용료를 청구하지 않습니다.</strong> 이 기간에는 2027년 6월 1일부터 12월 31일까지의 시범 운영 기간이 포함됩니다. 이 기간에 참여한 요청은 견적 제출, 계약 체결이 2028년 1월 1일 이후에 이루어지더라도 청구하지 않습니다. 의뢰자는 기간과 관계없이 단추를 무료로 이용합니다.</p></section>
<section><h3>이용요금 (2028년 1월 1일부터)</h3>
<p>2028년 1월 1일 이후 기관이 직접 참여한 요청부터 아래 요금표를 적용합니다. 금액은 모두 부가가치세 별도이며, 구간은 기관이 제출한 견적의 총액으로 정합니다.</p>
<table className="tm-fee"><thead><tr><th scope="col">견적 총액</th><th scope="col">견적서 송부 비용</th><th scope="col">계약 성사 수수료</th></tr></thead><tbody>
<tr><th scope="row">5,000만 원 미만</th><td colSpan={2}>월 구독료 1,000,000원에 포함</td></tr>
<tr><th scope="row">5,000만 원 ~ 9,999만 원</th><td>30,000원</td><td>2%</td></tr>
<tr><th scope="row">1억 원 ~ 4억 9,999만 원</th><td>50,000원</td><td>5%</td></tr>
<tr><th scope="row">5억 원 이상</th><td>50,000원</td><td>7%</td></tr>
</tbody></table>
<p>월 구독료에는 견적서 생성 도구, 견적서 디자인 리뉴얼권, 5,000만 원 미만 견적서의 무제한 송부가 포함됩니다. 구독 신청과 결제 방법은 청구를 시작하기 전에 따로 안내합니다.</p></section>
<section><h3>견적서 송부 비용</h3>
<p>견적서 송부 비용은 기관이 직접 참여한 요청에 금액이 적힌 견적을 제출한 경우에만 발생합니다. 참여 안내만 받은 요청, 참여하지 않은 요청, 견적 제출 전에 참여를 철회한 요청에는 발생하지 않습니다. 같은 요청에 견적을 다시 제출하거나 수정하더라도 1건으로 보며, 처음 제출한 달에 청구합니다. 구간은 그 달의 명세를 마감하는 시점의 견적 금액으로 정하고, 마감한 명세는 변경하지 않습니다. 기관의 견적서를 회사가 옮겨 정리한 경우에도 같은 기준을 적용합니다.</p></section>
<section><h3>계약 성사 수수료</h3>
<p>의뢰자가 단추에서 기관을 선정하고 그 요청의 계약이 확정되면 계약 성사 수수료가 발생합니다. 수수료율은 선정된 견적의 금액 구간으로 정하고, 확정된 계약 금액에 곱합니다. 계약은 기관이 체결일과 계약 금액을 보고한 뒤 의뢰자가 확인하거나, 보고 후 7일 안에 의뢰자의 이의가 없으면 확정됩니다. 수수료는 계약이 확정된 달에 청구합니다.</p></section>
<section><h3>요금과 조건의 변경</h3>
<p><strong>회사는 2028년 1월 1일 청구를 시작하기 30일 전까지 적용할 요금과 조건을 기관에 알리고, 이용약관도 같은 내용으로 개정합니다.</strong> 이후 요금표나 이용 조건을 바꾸는 경우에도 적용일 30일 전까지 알립니다. 조건이 바뀌면 조건의 판 이름을 바꾸고, 바뀐 뒤 기관이 처음 참여할 때 다시 동의를 받습니다. 바뀐 조건은 그 동의 이후 참여한 요청에만 적용합니다.</p></section>
</div>
</details>
</div>
</div>
</section>
    </Site>
  );
}
