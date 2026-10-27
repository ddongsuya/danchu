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
<div className="ctas"><a className="btn solid gate" href="/signup/cro">기관 참여 신청 <span className="ar">→</span></a><a className="btn ghost" href="mailto:hello@danchu.kr">hello@danchu.kr</a></div><p className="gatehint">네가지 모두 확인하면 신청할 수 있습니다.</p><a className="later" href="/signup/cro">먼저 가입하고 채워 넣을게요</a></div>
<details className="terms"><summary>이용 조건 전체 보기</summary>
<ol>
<li>참여하기를 누르면 이 조건에 동의한 것으로 보고, 누른 시각, 경로(포털 또는 회신 링크), 누른 담당자 계정(링크로 누르면 링크 지문), 이 조건의 판을 참여 기록으로 남깁니다. 누른 곳의 IP 주소와 브라우저 정보도 함께 남기며, 이 두 가지는 개인정보처리방침의 접속 기록 보유기간(3개월)이 지나면 지웁니다.</li>
<li>의뢰자에게는 비용을 청구하지 않습니다. 기관 이용료의 청구 단위는 귀 기관이 직접 참여한 요청에 제출한 견적 1건입니다. 참여 안내만 받은 요청, 불참한 요청, 제출 전에 참여를 철회한 요청에는 청구하지 않습니다. 단추가 견적서 PDF를 옮겨 정리한 견적도 귀 기관이 직접 참여한 요청이면 같은 기준입니다.</li>
<li>같은 요청에서 견적을 다시 제출하거나 고쳐도 1건으로 셉니다. 청구하는 달은 금액이 있는 견적을 처음 제출한 달이고, 이용료 구간(1,000만 원 미만은 월 구독료에 포함, 1,000만 원 이상은 건당 이용료)은 그 달 명세를 마감할 때의 견적 금액으로 정합니다. 마감한 달의 명세는 고정하며, 그 뒤 금액을 고쳐도 다시 청구하지 않습니다.</li>
<li>시범운영 기간에는 기관에도 비용을 받지 않으며, 시범운영 기간에 참여한 요청은 그 뒤에도 무료입니다.</li>
<li>이후 기관 이용료를 정하게 되면 기관과 서면으로 합의하고, 합의 이후에 참여한 요청에만 적용합니다. 조건이 바뀌면 판 이름을 바꾸고, 바뀐 뒤 처음 참여할 때 다시 확인을 받습니다.</li>
</ol>
</details>
</div>
</div>
</section>
    </Site>
  );
}
