import type { MetadataRoute } from "next";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://danchu.kr").replace(/\/$/, "");

/** 로그인 후 화면·토큰 회신·API·검토용 화면. 검색엔진과 AI 봇 모두에게 막는다 */
export const PRIVATE_PATHS = ["/app/", "/cro/", "/admin/", "/q/", "/api/", "/demo", "/design-preview", "/request-preview", "/request/new"];

/**
 * AI 검색·답변 봇. 이름이 맞는 묶음이 있으면 봇은 * 묶음을 보지 않으므로(robots.txt 규칙),
 * 같은 허용·차단을 이 묶음에도 그대로 준다. 공개 안내 페이지와 /llms.txt 를 읽어 단추를 인용할 수 있게 한다.
 */
export const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
];

/** 공개 안내 페이지만 검색에 연다. 로그인 후 화면·토큰 회신·API·검토용 화면은 막는다 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: AI_BOTS, allow: ["/", "/llms.txt"], disallow: PRIVATE_PATHS },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
