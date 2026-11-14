import type { Metadata } from "next";
import { pageMeta } from "@/lib/share-meta";
import { Site } from "@/components/site/Site";
import { HowReel } from "@/components/site/reel/Reels";
import "./page.css";

export const metadata: Metadata = pageMeta(
  "이용 안내 · 단추",
  "요청서 접수부터 기관 회신, 비교 견적 전달까지 한 흐름으로 확인하세요.",
  "/how-it-works",
);

export default function Page() {
  return (
    <Site current="/how-it-works" next={{ href: "/guide", label: "시험 가이드" }}>
<section className="ph2" aria-labelledby="t">
<h1 id="t" style={{ fontSize: "clamp(36px,4.4vw,64px)" }}>요청부터 비교 견적까지,<br /><span>한 흐름으로 확인하세요.</span></h1>
<p className="lead">요청서 한 장이 비교 견적이 되기까지</p>
</section>
<section className="rsx film-how" aria-label="이용 흐름 영상"><HowReel /></section>
<section className="qsec" aria-labelledby="qq">
<h2 id="qq">처음이라면,<br /><span>이것부터 확인하세요.</span></h2>
<div className="qs"><details className="q c-time"><summary>견적은 언제 받나요?</summary><div className="ans"><p className="al">회신 기한 다음 날 오전 9시에 비교표가 열려요.</p><ul><li>요청서를 보내면 분야가 맞는 기관과 지명한 기관에 요약이 담긴 참여 안내가 가요. 참여한 기관에만 요청서 전체가 열려요.</li><li>고른 견적 수(3곳, 5곳, 전체)만큼 참여한 순서대로 자리가 차요. 지명한 기관의 자리는 참여 결정 기한까지 비워 둬요.</li><li>회신 기한을 비워 두면 접수일부터 평일 7일 뒤로 정해져요. 공휴일은 따로 빼지 않아요.</li><li>자리가 다 찼거나 참여 결정 기한이 지났고, 참여한 기관이 모두 제출했다면 그때 바로 열려요.</li><li>열리기 전에는 참여·제출한 기관 수만 보여요. 지명한 기관은 이름과 참여 여부를 미리 볼 수 있어요.</li><li>기관은 비교표가 열리기 전까지 견적을 고칠 수 있고, 기관 선택은 열린 뒤에 해요. 열린 뒤에는 기한 연장이나 견적 수정이 없어요.</li><li>필요한 일정에 맞춰 전달 드려요.</li><li>참여한 기관이 적으면 먼저 알려 드릴게요. 기관에 참여를 권하거나, 기한 연장을 함께 상의해요.</li><li>첫 견적이 왔을 때와 비교표가 열릴 때 메일로 알려요.</li></ul></div></details><details className="q c-conf"><summary>우리 회사 정보는 안전한가요?</summary><div className="ans"><p className="al">회사명과 연락처는 기관을 고르기 전까지 공개되지 않아요.</p><ul><li>참여 안내에는 기관 유형, 시험 분야와 항목, 제출처, 희망 일정, 기밀 등급 같은 요약만 담겨요.</li><li>시험물질명(코드명 가능), 의뢰 목적, 시험 조건, 추가 설명, 첨부자료는 참여한 기관에만 열려요.</li><li>'CDA 필요'나 '자체 CDA 사용'을 고르면 첨부 파일은 기관별 CDA 체결을 운영자가 확인한 뒤 열려요.</li><li>지명한 기관에만 안내하도록 고를 수도 있어요. 기관을 선정하면 그 기관에만 회사명과 연락처가 전달돼요.</li><li>직접 CDA를 맺으면(자체 CDA 포함) CDA 문서의 회사명은 그 기관에 전달돼요.</li><li>첨부 파일 안에 적힌 회사명은 가려지지 않으니 보내기 전에 확인해주세요.</li></ul></div></details></div>
</section>
<section className="lavc" aria-labelledby="go"><div><h2 id="go" className="huge">비교 견적 요청,<br /><span>지금 시작해보세요.</span></h2></div><div className="act"><div><p className="actk">어떻게 시작할까요?</p><div className="pick"><input type="radio" name="hs" id="hs0" /><label htmlFor="hs0">시험을 직접 고를게요</label><input type="radio" name="hs" id="hs1" /><label htmlFor="hs1">패키지로 시작할게요</label><input type="radio" name="hs" id="hs2" /><label htmlFor="hs2">가이드라인을 참고할게요</label></div></div><div className="ctas"><a className="btn solid gate gate2 go g0" href="/request">시작하기 <span className="ar">→</span></a><a className="btn solid gate gate2 go g1" href="/request/new?preset=ind_small">시작하기 <span className="ar">→</span></a><a className="btn solid gate gate2 go g2" href="/request/new?start=advisor">시작하기 <span className="ar">→</span></a></div><p className="gatehint">하나를 고르면 시작할 수 있어요.</p></div></section>
    </Site>
  );
}
