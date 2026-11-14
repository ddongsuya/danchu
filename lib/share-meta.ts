import type { Metadata } from "next";

/**
 * 링크 미리보기(카카오톡·Threads·슬랙 등) 공통값.
 * Next.js는 하위 페이지가 metadata.openGraph 를 주지 않으면 루트 값을 그대로 물려받아
 * 어느 주소를 붙여도 홈 제목·주소로 보인다. 공개 페이지는 pageMeta()로 제목·설명·주소를 따로 준다.
 * 이미지를 바꾸면 파일 이름도 바꾼다(카카오는 같은 주소의 이미지를 오래 캐시한다).
 */
export const SITE_URL = "https://danchu.kr";
export const SITE_TITLE = "단추 · 비임상 시험 비교 견적표";
export const SITE_DESC = "요청서 한 번으로 여러 기관의 견적을 같은 양식으로 받아 비교해요.";
export const SHARE_IMAGE = {
  url: "/og-share.png",
  width: 1200,
  height: 630,
  alt: "단추. 연구 사이를 잇는 B2B 플랫폼",
};

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

/** 공개 페이지 metadata: 탭 제목·검색 설명·링크 미리보기를 한 번에 맞춘다. */
export function pageMeta(title: string, description: string, path: string): Metadata {
  return { title, description, alternates: { canonical: path }, ...shareMeta(title, description, path) };
}
