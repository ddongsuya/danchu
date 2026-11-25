import type { Metadata } from "next";

/**
 * 링크 미리보기(카카오톡·Threads·슬랙 등) 공통값.
 * Next.js는 하위 페이지가 metadata.openGraph 를 주지 않으면 루트 값을 그대로 물려받아
 * 어느 주소를 붙여도 홈 제목·주소로 보인다. 공개 페이지는 pageMeta()로 제목·설명·주소를 따로 준다.
 * 이미지를 바꾸면 파일 이름도 바꾼다(카카오는 같은 주소의 이미지를 오래 캐시한다).
 */
export const SITE_URL = "https://danchu.kr";
export const SITE_TITLE = "단추 · 비임상시험 비교 견적표, 비임상 CRO 견적 비교";
export const SITE_DESC =
  "비임상시험 견적을 한 번 요청으로 여러 비임상 CRO·시험기관에서 같은 양식으로 받아 비교해요. 독성·효력·약동학 시험과 GLP 비임상시험의 항목별 금액·기간·조건을 나란히 보고 기관을 직접 고르세요.";
export const SHARE_IMAGE = {
  url: "/og-share.png",
  width: 1200,
  height: 630,
  alt: "단추. 연구와 연구 사이를 잇다",
};

/**
 * 검색엔진에 알리는 공통 낱말. 화면 문구가 아니라 메타데이터에만 쓴다.
 * 실제로 하는 일만 넣는다: 단추는 비임상 시험 견적을 여러 기관에서 받아 비교하는 곳이고,
 * 시험을 수행하거나 순위를 매기지 않는다(PRODUCT.md). 기관을 늘리거나 실적을 앞세우는 말은 넣지 않는다.
 */
export const SITE_KEYWORDS = [
  "비임상시험",
  "비임상시험 견적",
  "GLP 비임상시험",
  "비임상 CRO",
  "비임상 시험기관",
  "독성시험 견적",
  "비임상 시험 견적",
  "비임상 시험 견적 비교",
  "비임상 독성시험",
  "효력시험 견적",
  "약동학시험 견적",
];

/** 공통 낱말 뒤에 페이지 낱말을 붙이고, 겹치는 것은 한 번만 남긴다. */
function keywordsFor(extra: readonly string[]): string[] {
  return [...new Set([...SITE_KEYWORDS, ...extra])];
}

export function shareMeta(title: string, description: string, path: string): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${path}`,
      siteName: "단추 Danchu",
      locale: "ko_KR",
      type: "website",
      images: [SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE.url] },
  };
}

/** 공개 페이지 metadata: 탭 제목·검색 설명·검색 낱말·링크 미리보기를 한 번에 맞춘다. */
export function pageMeta(title: string, description: string, path: string, extraKeywords: readonly string[] = []): Metadata {
  return {
    title,
    description,
    keywords: keywordsFor(extraKeywords),
    alternates: { canonical: path },
    ...shareMeta(title, description, path),
  };
}
