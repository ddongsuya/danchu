import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RfqLink } from "@/components/RfqLink";
import { Chevron } from "@/components/Chevron";
import "../home.css";

export const metadata: Metadata = { title: "자주 묻는 질문 — 단추" };

const FAQ = [
  { q: "비용이 드나요?", a: "의뢰자에게는 비용을 청구하지 않습니다. 견적 요청, CRO 배포, 비교표 수령까지 모두 무료입니다." },
  { q: "시험물질 정보는 어떻게 보호되나요?", a: "기밀 등급을 \"CDA 필요\"로 지정하면 비밀유지계약을 체결한 CRO에만 요청서를 전달하고, 체결 전까지 회사명은 가려집니다. 물질명은 코드명으로 입력할 수도 있습니다." },
  { q: "어떤 CRO가 참여하나요?", a: "GLP 인증을 보유한 국내 비임상 CRO가 참여합니다. 요청하신 시험 분야를 수행할 수 있는 기관에만 배포합니다." },
  { q: "견적은 언제 받나요?", a: "접수 후 영업일 1일 내 배포하고, 회신 기한(보통 5영업일)이 지나면 단추가 회신 내용을 검수한 뒤 비교표를 공개합니다. 도착할 때마다 알림을 보냅니다." },
  { q: "비교표에는 무엇이 있나요?", a: "총액, 항목별 금액, 소요기간, 착수 가능일, 기본 포함 항목, 제외·별도 옵션, 제출처 대비 GLP 대응 여부, 결제 조건, 유효기간을 같은 형식으로 정리합니다. 정본은 CRO가 첨부한 PDF 견적서입니다." },
  { q: "견적을 받은 뒤 계약은 어떻게 하나요?", a: "비교표에서 선택한 CRO와 직접 계약합니다. 선택하면 그 CRO에만 연락처가 공개되며, 단추는 계약 조건에 관여하지 않습니다." },
  { q: "어떤 시험이 필요한지 모르겠어요.", a: "시험 항목 대분류만 고르고 상황을 자유롭게 적어 주시면 됩니다. CRO가 허가 단계와 제출처에 맞는 표준 설계로 견적하고, 필요한 추가 시험을 제안합니다." },
  { q: "CRO는 어떻게 참여하나요?", a: "CRO 참여 안내 페이지에서 가입을 신청하면 단추가 기관 정보를 확인한 뒤 승인합니다. 승인된 기관에는 수행 분야에 맞는 요청서가 배포됩니다." },
];

export default function Faq() {
  return (
    <div className="site">
      <SiteHeader />
      <main style={{ flex: 1 }}>
        <section className="sub">
          <p className="eyebrow">자주 묻는 질문</p>
          <h1 className="sub__title">궁금한 점을 모았습니다</h1>
          <div className="faq">
            {FAQ.map((q) => (
              <details key={q.q}>
                <summary>
                  <span>{q.q}</span>
                  <Chevron size={20} />
                </summary>
                <p>{q.a}</p>
              </details>
            ))}
          </div>
          <p style={{ margin: "24px 0 0", fontSize: 14, color: "var(--muted)" }}>
            더 궁금한 점은 <a href="mailto:hello@danchu.kr">hello@danchu.kr</a>로 보내주세요.
          </p>
        </section>
        <section className="band--surface">
          <div className="cta__in">
            <h2>한번 입력하고, 비교표로 받아보세요</h2>
            <RfqLink className="btn btn--pill btn--lg">무료로 견적 요청</RfqLink>
          </div>
        </section>
      </main>
      <SiteFooter current="/faq" />
    </div>
  );
}
