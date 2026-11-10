import type { MetadataRoute } from "next";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://danchu.kr").replace(/\/$/, "");

/** 검색에 올릴 공개 페이지. 새 공개 페이지를 만들면 여기에 더한다 (tests/seo.test.ts 가 robots 와 겹치지 않는지 본다) */
export const PUBLIC_PATHS = ["/", "/about", "/how-it-works", "/guide", "/guide/library", "/for-cro", "/faq", "/request", "/partners", "/terms", "/privacy"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PATHS.map((p) => ({
    url: `${base}${p === "/" ? "" : p}`,
    changeFrequency: p === "/terms" || p === "/privacy" ? "yearly" : "monthly",
    priority: p === "/" ? 1 : p === "/terms" || p === "/privacy" ? 0.3 : 0.7,
  }));
}
