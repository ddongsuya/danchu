import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import "./page.css";

export const metadata: Metadata = {
  title: "자주 묻는 질문 · 단추",
  description: "시험 구성, 기한, 기밀, 비교표, 계약, 기관 참여에 대한 답.",
};

export default function Page() {
  return (
    <Site current="/faq" cue={false}>
{/* 제목과 질문 목록은 한 장면. 제목만 한 화면을 차지하면 첫 화면에 질문이 하나도 안 보인다. */}
<section className="faqs" aria-labelledby="t">
<div className="ph">
<div><h1 id="t">자주 묻는 질문</h1></div>
<div><p className="lead">찾는 답이 없다면 hello@danchu.kr로 편하게 물어보세요.</p></div>
</div>
<div className="faq">
<input type="radio" name="fc" id="f-all" defaultChecked /><input type="radio" name="fc" id="f-plan" /><input type="radio" name="fc" id="f-time" /><input type="radio" name="fc" id="f-conf" /><input type="radio" name="fc" id="f-cmp" /><input type="radio" name="fc" id="f-deal" /><input type="radio" name="fc" id="f-cro" />
<div className="fc" role="radiogroup" aria-label="분류"><label htmlFor="f-all">전체</label><label htmlFor="f-plan">시험 구성</label><label htmlFor="f-time">기한</label><label htmlFor="f-conf">기밀</label><label htmlFor="f-cmp">비교표</label><label htmlFor="f-deal">계약</label><label htmlFor="f-cro">기관</label></div>
<div className="qs">

<details className="q c-plan" open><summary>어떤 시험이 필요한지 모르겠어요.</summary><div className="ans"><p className="al">내 상황에 맞는 가이드라인 기준을 찾아볼 수 있어요.</p><ul><li>'내 상황에 맞는 시험 찾아보기'에서 개발 단계, 제출처, 임상 투여경로와 기간, 보유 자료를 고르면 돼요.</li><li>ICH, 식약처 고시, OECD 시험법에서 해당하는 시험과 근거 문서를 함께 보여드려요.</li><li>합성의약품, 바이오의약품, 세포·유전자치료제, 건강기능식품, 화장품, 의료기기, 화학물질·농약을 지원해요. 세포·유전자치료제는 공개 문서가 정한 범위까지만 보여드려요. 관찰 기간 같은 숫자는 기관과 함께 정하세요.</li><li>참고 자료예요. 최종 설계는 기관과 함께 정하세요.</li></ul></div></details>
<details className="q c-time"><summary>견적은 언제 받나요?</summary><div className="ans"><p className="al">회신 기한 다음 날 오전 9시에 비교표가 열려요.</p><ul><li>요청서를 보내면 분야가 맞는 기관과 지명한 기관에 요약이 담긴 참여 안내가 가요. 참여한 기관에만 요청서 전체가 열려요.</li><li>고른 견적 수(3곳, 5곳, 전체)만큼 참여한 순서대로 자리가 차요. 지명한 기관의 자리는 참여 결정 기한까지 비워 둬요.</li><li>회신 기한을 비워 두면 접수일부터 평일 7일 뒤로 정해져요. 공휴일은 따로 빼지 않아요.</li><li>자리가 다 찼거나 참여 결정 기한이 지났고, 참여한 기관이 모두 제출했다면 그때 바로 열려요.</li><li>열리기 전에는 참여·제출한 기관 수만 보여요. 지명한 기관은 이름과 참여 여부를 미리 볼 수 있어요.</li><li>기관은 비교표가 열리기 전까지 견적을 고칠 수 있고, 기관 선택은 열린 뒤에 해요. 열린 뒤에는 기한 연장이나 견적 수정이 없어요.</li><li>기한 전에 마감해드리지 않으니, 빨리 받아야 하면 회신 기한을 짧게 정해주세요.</li><li>참여가 적으면 한 번 알려드리고, 운영자가 기관에 참여를 권하거나 기한 연장을 여쭤봐요.</li><li>첫 견적이 왔을 때와 비교표가 열릴 때 메일로 알려드려요.</li></ul></div></details>
<details className="q c-conf"><summary>우리 회사 정보는 안전한가요?</summary><div className="ans"><p className="al">회사명과 연락처는 기관을 고르기 전까지 공개되지 않아요.</p><ul><li>참여 안내에는 기관 유형, 시험 분야와 항목, 제출처, 희망 일정, 기밀 등급 같은 요약만 담겨요.</li><li>시험물질명(코드명 가능), 의뢰 목적, 시험 조건, 추가 설명, 첨부자료는 참여한 기관에만 열려요.</li><li>'CDA 필요'나 '자체 CDA 사용'을 고르면 첨부 파일은 기관별 CDA 체결을 운영자가 확인한 뒤 열려요.</li><li>지명한 기관에만 안내하도록 고를 수도 있어요. 기관을 선정하면 그 기관에만 회사명과 연락처가 전달돼요.</li><li>직접 CDA를 맺으면(자체 CDA 포함) CDA 문서의 회사명은 그 기관에 전달돼요.</li><li>첨부 파일 안에 적힌 회사명은 가려지지 않으니 보내기 전에 확인해주세요.</li></ul></div></details>
<details className="q c-cmp"><summary>비교표에서는 무엇을 볼 수 있나요?</summary><div className="ans"><p className="al">총액부터 항목별 금액, 일정, 조건까지 같은 양식으로 나란히 볼 수 있어요.</p><ul><li>총액, 항목별 금액과 리드타임, 수행 범위, 착수 가능일, 기본 포함 항목, 별도 옵션, GLP 대응, 결제 조건, 유효기간을 한 표에 정리해요.</li><li>가이드라인이 정하지 않은 부분은 각 기관의 설명을 그대로 나란히 보여드려요.</li><li>기준은 기관의 PDF 견적서예요. PDF만 온 경우 단추가 옮겨 정리하고 '단추 정리 · 기관 PDF 기준'으로 표시해요.</li><li>비교표와 PDF가 다르면 PDF가 우선해요. 옮겨 적은 오류는 열리기 전엔 바로잡고, 열린 뒤엔 비교표를 고치지 않고 알려드려요.</li></ul></div></details>
<details className="q c-cmp"><summary>기관은 다른 기관의 견적을 볼 수 있나요?</summary><div className="ans"><p className="al">볼 수 없어요. 비교표는 의뢰자에게만 전달돼요.</p><ul><li>의뢰자도 비교표가 열리기 전에는 기관명과 금액을 볼 수 없어요.</li><li>단추는 어느 기관의 금액, 순위, 참여 여부도 다른 기관에 알리지 않아요. 선택되지 않은 기관에는 결과만 안내해요.</li></ul></div></details>
<details className="q c-deal"><summary>기관을 고르면 그다음은요?</summary><div className="ans"><p className="al">고른 기관과 직접 계약하시면 돼요.</p><ul><li>선택하면 그 기관과 회사명, 담당자 연락처를 서로 주고받아요. 단추는 계약 조건에 관여하지 않아요.</li><li>기관이 체결일과 계약금액을 알려오면 요청 화면에서 확인해주세요.</li><li>7일 안에 이의가 없으면 그대로 확정되고, 이의를 남기면 운영자가 양쪽에 확인해 정리해요.</li></ul></div></details>
<details className="q c-cro"><summary>기관은 어떻게 참여하나요?</summary><div className="ans"><p className="al">가입을 신청하면 기관 정보를 확인한 뒤 승인해드려요.</p><ul><li>승인되면 분야에 맞는 요청의 참여 안내를 받고, 참여를 누르면 요청서 전체가 열려요.</li><li>역량 카탈로그를 등록해 두면 회신 초안이 채워진 채로 열려요.</li><li>견적을 내지 않을 요청은 불참을 누르면 돼요. 다음 안내에는 영향이 없어요.</li><li>참여 결정 기한 전이고 자리가 남아 있으면 불참을 취소하고 다시 참여할 수 있어요. 참여한 뒤 철회한 요청에는 다시 참여할 수 없어요.</li></ul></div></details>
</div>
</div>
</section>
<section className="close" aria-labelledby="go">
<h2 id="go">궁금증이 풀렸다면,<br /><span>이제 견적을 받아보세요.</span></h2>
<div className="ctas"><a className="btn solid" href="/request">견적 요청하기 <span className="ar">→</span></a><a className="btn ghost" href="mailto:hello@danchu.kr">hello@danchu.kr</a></div>
</section>
    </Site>
  );
}
