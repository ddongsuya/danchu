import { SITE_URL } from "@/lib/share-meta";
import { FAQ_ITEMS, faqAnswerText } from "@/lib/faq-page";

/**
 * 검색엔진·AI 검색용 구조화 데이터(JSON-LD, schema.org).
 * 실제로 하는 일과 화면에 있는 내용만 적는다(PRODUCT.md "아는 만큼만 말한다").
 * - 사업자 등록 전이라 전화번호·사업자번호·주소는 넣지 않는다.
 * - 요금 금액은 비공개(PRICE_OPEN=false)라 offers·price 를 넣지 않는다.
 * - 순위·추천·평점(aggregateRating)처럼 근거 없는 값은 넣지 않는다.
 */
export const SUPPORT_EMAIL = "support@danchu.kr";
export const SERVICE_DESC = "비임상 시험(독성·효력·약동학·개별 분석) 비교 견적 플랫폼";

type Json = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;
const APP_ID = `${SITE_URL}/#app`;

/** 홈에 싣는 Organization + SoftwareApplication 그래프 */
export function siteJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "단추",
        alternateName: "Danchu",
        url: SITE_URL,
        logo: `${SITE_URL}/icons/icon-512.png`,
        description: `${SERVICE_DESC}. 여러 비임상 시험기관의 견적을 같은 양식으로 받아 나란히 비교하는 비교 견적표를 제공해요.`,
        email: SUPPORT_EMAIL,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: SUPPORT_EMAIL,
          availableLanguage: ["ko"],
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": APP_ID,
        name: "단추",
        alternateName: "Danchu",
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "ko",
        description: `${SERVICE_DESC}. 요청서 한 번으로 여러 기관의 회신을 받아 항목별 금액·기간·조건을 같은 양식으로 비교해요.`,
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

/** /faq 에 싣는 FAQPage. 화면과 같은 FAQ_ITEMS 에서 만든다 */
export function faqPageJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: `${SITE_URL}/faq`,
    inLanguage: "ko",
    mainEntity: FAQ_ITEMS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: faqAnswerText(f) },
    })),
  };
}

/** <script type="application/ld+json"> 에 넣을 문자열. `<` 를 < 로 바꿔 문자열이 태그를 닫지 못하게 한다 */
export function jsonLdString(data: Json): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
