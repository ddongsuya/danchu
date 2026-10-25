import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import "./page.css";

export const metadata: Metadata = {
  title: "자주 묻는 질문 · 단추",
  description: "비용, 시험 구성, 기한, 기밀, 비교표, 계약, 기관 참여에 대한 답.",
};

export default function Page() {
  return (
    <Site current="/faq" onescreen={false} cue={false}>
<section className="ph" aria-labelledby="t">
<div><h1 id="t">자주 묻는 질문</h1></div>
<div><p className="lead">여기 없는 질문은 hello@danchu.kr로 보내주세요.</p></div>
</section>
<section className="faq" aria-label="질문 목록">
<input type="radio" name="fc" id="f-all" defaultChecked /><input type="radio" name="fc" id="f-cost" /><input type="radio" name="fc" id="f-plan" /><input type="radio" name="fc" id="f-time" /><input type="radio" name="fc" id="f-conf" /><input type="radio" name="fc" id="f-cmp" /><input type="radio" name="fc" id="f-deal" /><input type="radio" name="fc" id="f-cro" />
<div className="fc" role="radiogroup" aria-label="분류"><label htmlFor="f-all">전체</label><label htmlFor="f-cost">비용</label><label htmlFor="f-plan">시험 구성</label><label htmlFor="f-time">기한</label><label htmlFor="f-conf">기밀</label><label htmlFor="f-cmp">비교표</label><label htmlFor="f-deal">계약</label><label htmlFor="f-cro">기관</label></div>
<div className="qs">
<details className="q c-cost" open><summary>비용이 드나요?</summary><div className="ans"><p>의뢰자에게는 비용을 청구하지 않습니다. 요청서 작성, 기관 안내, 비교표 수령까지 무료입니다.</p><p>시범운영 기간에는 기관에도 비용을 받지 않으며, 시범운영 기간에 기관이 참여한 요청은 그 뒤에도 무료입니다. 이후 기관 수수료를 정하게 되면 기관과 서면으로 합의하고, 그 이후 기관이 직접 참여한 요청에 제출한 견적에만 적용합니다. 자세한 내용은 이용약관 제5조에 있습니다.</p></div></details>
<details className="q c-plan"><summary>어떤 시험이 필요한지 모르겠어요.</summary><div className="ans"><p>요청서에서 '상황을 말하고 제안 받기'를 고르면 개발 단계, 제출처, 임상 투여경로와 기간, 보유 자료를 묻고 공개 가이드라인(ICH, 식약처 고시, OECD 시험법)에 근거해 필요한 시험을 제안합니다. 항목마다 근거 조항이 붙습니다.</p><p>합성의약품, 바이오의약품, 세포·유전자치료제, 건강기능식품, 화장품, 의료기기, 화학물질·농약을 지원하며, 유형에 따라 질문이 달라집니다. 제안 규칙은 초안이며 실무 검토 전입니다. 시험 항목을 직접 고르거나 패키지로 시작할 수도 있습니다.</p></div></details>
<details className="q c-time"><summary>견적은 언제 받나요?</summary><div className="ans"><p>요청서를 제출하면 수행 분야가 맞는 기관과 지명한 기관에 참여 안내가 갑니다. 안내에는 요약만 담기고, 기관이 참여를 누르면 요청서 전체가 열립니다. 고른 견적 수(3곳, 5곳 또는 전체)는 참여 자리 수이며 기관이 참여한 순서대로 찹니다. 지명한 기관의 자리는 참여 결정 기한까지 비워 둡니다.</p><p>회신 기한은 요청서에서 정하며, 비워 두면 접수일부터 평일 기준 7일 뒤입니다. 공휴일은 별도로 반영하지 않습니다. 참여가 적으면 한 번 알려 드리고, 운영자가 기관에 참여를 권하거나 기한 연장을 여쭙니다.</p><p>비교표는 회신 기한 다음 날 오전 9시에 열립니다. 참여 자리가 다 찼거나 참여 결정 기한이 지났고 참여한 기관이 모두 제출했으면 그때 바로 열립니다. 그 전에는 참여한 기관 수와 제출한 기관 수만 보이고, 기관명과 금액은 비교표가 열릴 때 함께 보입니다. 지명한 기관은 이름과 참여 여부(참여, 불참, 결정 전)를 미리 볼 수 있습니다. 기관은 비교표가 열리기 전까지 견적을 수정할 수 있고, 기관 선택은 비교표가 열린 뒤에 합니다. 비교표가 열린 뒤에는 회신 기한을 늘리거나 견적 수정을 다시 열지 않습니다. 기한 전에 회신을 마감해 드리지 않으니, 빨리 받아야 하면 요청서에서 회신 기한을 짧게 정해 주세요. 첫 견적이 왔을 때와 비교표가 열릴 때 메일로 알려 드립니다.</p></div></details>
<details className="q c-conf"><summary>시험물질 정보는 어떻게 보호되나요?</summary><div className="ans"><p>회사명과 담당자 연락처는 모든 요청에서 선정 전까지 기관에 공개되지 않습니다. 참여 안내에는 기관 유형, 시험 분야와 항목, 제출처, 희망 일정, 기밀 등급 같은 요약만 담기고, 시험물질명(코드명 가능), 의뢰 목적, 시험 조건, 추가 설명과 첨부자료(CDA 등급은 체결 확인 후)는 참여한 기관에만 열립니다. 지명한 기관에만 안내하도록 고를 수도 있습니다. 비교표에서 기관을 선정하면 그 기관에만 회사명과 연락처가 공개됩니다.</p><p>기밀 등급을 'CDA 필요' 또는 '자체 CDA 사용'으로 지정하면 첨부 파일도 기관별 CDA 체결을 운영자가 확인한 뒤 공개합니다. 단추는 CDA를 체결해도 선정 전에는 회사명과 연락처를 기관에 전달하지 않습니다. 다만 의뢰자가 기관과 직접 CDA를 체결하면(자체 CDA 포함) CDA 문서에 적힌 회사명은 그 기관에 전달됩니다. 첨부 파일 안에 적힌 회사명은 가려지지 않으니 제출 전에 확인해 주세요. 물질명은 코드명으로 입력할 수 있습니다.</p></div></details>
<details className="q c-cmp"><summary>비교표에는 무엇이 있나요?</summary><div className="ans"><p>총액, 항목별 금액과 리드타임, 수행 범위, 착수 가능일, 기본 포함 항목, 제외·별도 옵션, 제출처 대비 GLP 대응, 결제 조건, 유효기간을 같은 양식으로 정리합니다. 가이드라인이 정하지 않은 부분은 각 기관의 설명을 나란히 보여 줍니다.</p><p>정본은 기관의 PDF 견적서입니다. 기관이 PDF만 보낸 경우에는 단추가 내용을 옮겨 정리하고 '단추 정리 · 기관 PDF 기준'으로 표시합니다. 비교표와 PDF가 다르면 PDF가 우선하며, 옮겨 적은 내용의 오류는 비교표가 열리기 전에는 단추가 바로잡고, 열린 뒤에는 비교표를 고치지 않고 알려 드립니다.</p></div></details>
<details className="q c-cmp"><summary>기관은 다른 기관의 견적을 볼 수 있나요?</summary><div className="ans"><p>볼 수 없습니다. 비교표는 의뢰자에게만 전달되며, 의뢰자도 비교표가 열리기 전에는 기관명과 금액을 보지 못합니다. 단추는 어느 기관의 금액, 순위, 참여 여부도 다른 기관에 알리지 않고, 선택되지 않은 기관에는 결과만 안내합니다.</p></div></details>
<details className="q c-deal"><summary>견적을 받은 뒤 계약은 어떻게 하나요?</summary><div className="ans"><p>비교표에서 고른 기관과 직접 계약합니다. 선택하면 그 기관과 회사명·담당자 연락처를 서로 주고받으며, 단추는 계약 조건에 관여하지 않습니다. 선택 기록은 그 시점에 남깁니다. 기관이 체결일과 계약금액을 보고하면 요청 화면에서 내용을 확인해 주세요. 보고 뒤 7일 안에 이의가 없으면 보고한 내용대로 확정되고, 이의를 남기면 운영자가 양쪽에 확인한 뒤 정리합니다.</p></div></details>
<details className="q c-cro"><summary>기관은 어떻게 참여하나요?</summary><div className="ans"><p>기관 참여 안내 페이지에서 가입을 신청하면 단추가 기관 정보를 확인한 뒤 승인합니다. 승인된 기관에는 수행 분야에 맞는 요청의 참여 안내가 가고, 기관이 요약을 보고 참여를 누르면 요청서 전체가 열립니다. 역량 카탈로그를 등록해 두면 회신 초안이 채워진 채 열립니다. 견적을 내지 않을 요청은 불참을 누르면 되고, 다음 안내에 영향이 없습니다. 참여 결정 기한 전이고 자리가 남아 있으면 불참을 취소하고 다시 참여할 수 있습니다. 참여한 뒤 철회한 요청에는 다시 참여할 수 없습니다.</p></div></details>
</div>
</section>
<section className="close" aria-labelledby="go">
<h2 id="go">궁금한 점이 풀렸다면<br /><span>견적을 요청해보세요.</span></h2>
<div className="ctas"><a className="btn solid" href="/request">견적 요청하기 <span className="ar">→</span></a><a className="btn ghost" href="mailto:hello@danchu.kr">hello@danchu.kr</a></div>
</section>
    </Site>
  );
}
