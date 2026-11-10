import type { MetadataRoute } from "next";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://danchu.kr").replace(/\/$/, "");

/** 공개 안내 페이지만 검색에 연다. 로그인 후 화면·토큰 회신·API·검토용 화면은 막는다 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/cro/", "/admin/", "/q/", "/api/", "/demo", "/design-preview", "/request-preview", "/request/new"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
