import type { Metadata } from "next";
import "./globals.css";

const TITLE = "단추 · 비임상 시험 견적, 근거부터 비교표까지";
const DESC =
  "개발 단계와 임상 계획을 답하면 공개 가이드라인에 근거해 필요한 시험을 제안합니다. 요청서 하나로 여러 기관이 같은 양식으로 회신합니다.";

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
    // 카카오톡·슬랙 등 링크 미리보기 썸네일 (public/og.png · scripts/gen-images.js로 생성)
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "단추, 비임상 시험 견적을 같은 양식으로" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og.png"] },
  robots: { index: true, follow: true },
  other: { "color-scheme": "light dark" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "단추" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 같은 도메인에서 서비스하는 Pretendard 가변 폰트 (public/fonts/pretendard) */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendard.css" />
        {/* 페인트 전에 테마를 정해 깜빡임을 없앤다. 값은 앱 설정과 같은 키를 쓴다. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=JSON.parse(localStorage.getItem('danchu.app.settings')||'{}');var t=s.theme||'system';var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})()",
          }}
        />
      </head>
      <body>
        {/* 스크립트가 없으면 등장 애니메이션 없이 바로 보이게 */}
        <noscript>
          <style>{".rv{opacity:1;transform:none}.op{display:none}"}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
