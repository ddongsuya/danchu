import type { Metadata } from "next";
import { pageMeta } from "@/lib/share-meta";
import { Site } from "@/components/site/Site";
import { CroHeroReel, CroStepsReel, CroReplyReel, CroRulesReel } from "@/components/site/reel/Reels";
import "./page.css";

export const metadata: Metadata = pageMeta(
  "비임상 CRO 기관 참여 안내 · 단추",
  "비임상 CRO·GLP 비임상시험기관이 수행 분야에 맞는 요청서를 받고 같은 양식으로 견적을 회신해요.",
  "/for-cro",
  ["비임상 CRO 기관", "비임상 시험기관 참여", "CRO 견적 회신", "GLP 비임상시험기관"],
);

export default function Page() {
  return (
    <Site current="/for-cro" next={{ href: "/faq", label: "자주 묻는 질문" }}>
<section className="ph vis" aria-labelledby="t">
<div>
<h1 id="t">분야에 맞는 요청서,<br /><span>같은 양식으로 회신</span></h1>
</div>
<figure className="hfilm"><CroHeroReel /></figure>
</section>

<section className="rsx film-steps" aria-labelledby="st"><header><h2 id="st">참여부터 계약까지<br /><span>이렇게 진행돼요.</span></h2></header><CroStepsReel /></section>

<section className="rsx side" aria-labelledby="fm"><header><h2 id="fm">견적서는<br /><span>기관 양식 그대로.</span><br />정리는 단추가 해요.</h2></header><CroReplyReel /></section>

<section className="rsx side" aria-labelledby="ru"><header><h2 id="ru">모든 기관에<br /><span>같은 규칙이 적용돼요.</span></h2></header><CroRulesReel /></section>

<section className="freeb" aria-labelledby="tm" id="cro-terms">
<div className="fg">
<h2 id="tm" className="huge">기관<br /><span>참여 신청</span></h2>
<div className="fr">
<div className="act"><div><p className="actk">준비할 것</p><div className="chk"><label><input type="checkbox" />기관명</label><label><input type="checkbox" />보유 GLP 인증</label><label><input type="checkbox" />수행 가능 분야</label><label><input type="checkbox" />담당자 연락처</label></div></div>
<div className="ctas"><a className="btn solid gate" href="/signup/cro">기관 참여 신청</a><a className="btn ghost" href="mailto:hello@danchu.kr">hello@danchu.kr</a></div><p className="gatehint">네 가지를 모두 체크하면 신청할 수 있어요.</p><a className="later" href="/signup/cro">먼저 가입하고 채워 넣을게요</a></div>
<p className="fee-terms"><a href="/pricing">요금제 보기</a> <a href="/terms/cro">기관 이용약관</a></p>
</div>
</div>
</section>
    </Site>
  );
}
