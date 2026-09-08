import type { Metadata } from "next";
import "./globals.css";

const TITLE = "단추 — 비임상 시험 한번 요청으로 한눈에 비교하세요";
const DESC =
  "여러 기관에 따로 연락하지 마세요. 한번 입력하면 단추가 배포하고 비교 견적서로 드려요.";

export const metadata: Metadata = {
  metadataBase: new URL("https://danchu.kr"),
  title: TITLE,
  description: DESC,
  // 카카오톡·슬랙 등 링크 미리보기
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://danchu.kr",
    siteName: "단추 Danchu",
    locale: "ko_KR",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "단추" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        {/* 스크립트가 없으면 등장 애니메이션 없이 바로 보이게 */}
        <noscript>
          <style>{".rv{opacity:1;transform:none}.intro{display:none}"}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
