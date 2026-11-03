import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import { CroHeroReel, CroStepsReel, CroReplyReel, CroRulesReel } from "@/components/site/reel/Reels";
import "./page.css";

export const metadata: Metadata = {
  title: "기관 참여 안내 · 단추",
  description: "수행 분야에 맞는 요청서를 받고 같은 양식으로 견적을 회신하세요. 시범운영 기간에는 기관도 무료입니다.",
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

<section className="rsx film-steps" aria-labelledby="st"><header><h2 id="st">참여부터 계약까지<br /><span>이렇게 진행됩니다.</span></h2></header><CroStepsReel /></section>

<section className="rsx side" aria-labelledby="fm"><header><h2 id="fm">단추에 견적서를<br /><span>보내주세요.</span><br />정리는 단추가 합니다.</h2></header><CroReplyReel /></section>

<section className="rsx side" aria-labelledby="ru"><header><h2 id="ru">모든 기관에<br /><span>같은 규칙이 적용됩니다.</span></h2></header><CroRulesReel /></section>

<section className="freeb" aria-labelledby="tm" id="cro-terms">
<div className="fg">
<h2 id="tm" className="huge">무료로<br /><span>참여해보세요.</span></h2>
<div className="fr">
<p className="lead">그리고 단추가 마음에 든다면 협업을 결정해주세요.</p>
<div className="act"><div><p className="actk">이것만 있으면 시작할 수 있어요.</p><div className="chk"><label><input type="checkbox" />기관명</label><label><input type="checkbox" />보유 GLP 인증</label><label><input type="checkbox" />수행 가능 분야</label><label><input type="checkbox" />담당자 연락처</label></div></div>
<div className="ctas"><a className="btn solid gate" href="/signup/cro">기관 참여 신청 <span className="ar">→</span></a><a className="btn ghost" href="mailto:limjm900202@gmail.com">limjm900202@gmail.com</a></div><p className="gatehint">네가지 모두 확인하면 신청할 수 있습니다.</p><a className="later" href="/signup/cro">먼저 가입하고 채워 넣을게요</a></div>
<details className="terms"><summary>이용 조건 전체 보기</summary>
<div className="tm">
<section><h3>이용 조건 동의 및 참여 기록</h3>
<p>귀 기관이 요청에 &lsquo;참여하기&rsquo;를 누르면 본 이용 조건에 동의하는 것입니다. 단추는 누른 시각, 경로(포털 또는 회신 링크), 누른 담당자 계정(회신 링크로 참여한 경우 링크 식별값), 적용된 조건의 판을 참여 기록으로 보관합니다. 접속 IP 주소와 브라우저 정보도 함께 기록하며, 이 두 가지는 개인정보처리방침에 따라 3개월이 지나면 삭제합니다.</p></section>
<section><h3>이용요금</h3>
<p>의뢰자는 단추를 무료로 이용합니다. 기관 이용료는 귀 기관이 직접 참여한 요청에 견적을 제출한 경우에만 발생하며, 제출한 견적 1건을 기준으로 합니다. 참여 안내만 받은 요청, 참여하지 않은 요청, 견적 제출 전에 참여를 철회한 요청에는 이용료가 발생하지 않습니다. 귀 기관의 견적서를 단추가 옮겨 정리한 경우에도 같은 기준을 적용합니다.</p></section>
<section><h3>견적의 재제출 및 수정</h3>
<p>같은 요청에 견적을 다시 제출하거나 수정하더라도 1건으로 봅니다. 이용료는 금액이 기재된 견적을 처음 제출한 달에 청구합니다. 견적 금액이 1,000만 원 미만이면 월 구독료에 포함되고, 1,000만 원 이상이면 건별로 청구하며, 이 구분은 해당 월 명세를 마감하는 시점의 견적 금액을 기준으로 합니다. 마감된 명세는 변경하지 않으며, 마감 후 견적 금액을 수정하더라도 추가로 청구하지 않습니다.</p></section>
<section><h3>시범운영 기간</h3>
<p>시범운영 기간에는 기관에도 이용료를 받지 않습니다. 이 기간에 참여한 요청은 시범운영이 끝난 뒤에도 무료입니다.</p></section>
<section><h3>이용료 결정 및 조건 변경</h3>
<p>단추가 기관 이용료를 정하는 경우 귀 기관과 서면으로 합의하며, 합의 이후 참여한 요청에만 적용합니다. 이용 조건이 변경되면 조건의 판 이름을 변경하고, 변경 후 귀 기관이 처음 참여할 때 다시 동의를 받습니다.</p></section>
</div>
</details>
</div>
</div>
</section>
    </Site>
  );
}
