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
<p className="lead">써 보시고 마음에 들면, 단추와 함께해요.</p>
<div className="act"><div><p className="actk">이것만 있으면 시작할 수 있어요.</p><div className="chk"><label><input type="checkbox" />기관명</label><label><input type="checkbox" />보유 GLP 인증</label><label><input type="checkbox" />수행 가능 분야</label><label><input type="checkbox" />담당자 연락처</label></div></div>
<div className="ctas"><a className="btn solid gate" href="/signup/cro">기관 참여 신청 <span className="ar">→</span></a><a className="btn ghost" href="mailto:hello@danchu.kr">hello@danchu.kr</a></div><p className="gatehint">모두 준비되셨다면 바로 신청해 주세요.</p><a className="later" href="/signup/cro">먼저 가입하고 채워 넣을게요</a></div>
<div className="fee" aria-labelledby="fee-h">
<h3 id="fee-h">이용 요금</h3>
<p className="fee-s">2027년 12월 31일까지 참여한 요청은 무료예요. 2028년 1월 1일부터 아래 요금이 적용돼요.</p>
<table className="fee-t"><thead><tr><th scope="col">금액 구간</th><th scope="col">견적서 송부</th><th scope="col">계약 성사</th></tr></thead><tbody>
<tr><th scope="row">5,000만 원 미만</th><td colSpan={2}>요금제에 포함 (무료 월 5건, Plus·Pro 무제한)</td></tr>
<tr><th scope="row">5,000만~9,999만 원</th><td>3만 원</td><td>이 구간 금액의 2%</td></tr>
<tr><th scope="row">1억~4억 9,999만 원</th><td>5만 원</td><td>이 구간 금액의 5%</td></tr>
<tr><th scope="row">5억 원 이상</th><td>5만 원</td><td>이 구간 금액의 7%</td></tr>
<tr className="none"><th scope="row">참여하지 않은 요청</th><td>없음</td><td>없음</td></tr>
</tbody></table>
<p className="fee-c">계약 성사 수수료는 계약 금액을 구간별로 나눠 계산해요. 계약 금액이 3억 원이면 5,000만 원의 2%와 2억 원의 5%를 더한 1,100만 원이에요. 부가가치세 별도</p>
</div>
<p className="fee-terms"><a href="/pricing">요금제 보기</a> <a href="/terms/cro">기관 이용약관</a></p>
</div>
</div>
</section>
    </Site>
  );
}
