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
<p className="fee-s">2027년 12월 31일까지 참여한 요청에는 요금이 없어요. 이 기간에 참여한 요청은 그 뒤에 계약해도 무료예요.</p>
<p className="fee-s">정식 서비스 요금은 시작 30일 전에 요금제 페이지와 메일로 알려요.</p>
</div>
<p className="fee-terms"><a href="/pricing">요금제 보기</a> <a href="/terms/cro">기관 이용약관</a></p>
</div>
</div>
</section>
    </Site>
  );
}
