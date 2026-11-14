import type { Metadata } from "next";
import "./globals.css";
import { SITE_DESC, SITE_TITLE, SITE_URL, shareMeta } from "@/lib/share-meta";

const TITLE = SITE_TITLE;
const DESC = SITE_DESC;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESC,
  // 카카오톡·Threads·슬랙 등 링크 미리보기. 하위 공개 페이지는 lib/share-meta pageMeta()로 따로 준다
  ...shareMeta(TITLE, DESC, ""),
  robots: { index: true, follow: true },
  other: { "color-scheme": "light dark" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "단추" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* 같은 도메인에서 서비스하는 Pretendard 가변 폰트 (public/fonts/pretendard) */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendard.css" />
        {/* 페인트 전에 테마를 정해 깜빡임을 없앤다. 값은 앱 설정과 같은 키를 쓴다. 공개 페이지(랜딩·요청서·로그인·약관)는 늘 밝은 테마, 로그인 후 화면만 다크를 따른다. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var app=/^\\/(app|cro|admin|q)(\\/|$)/.test(location.pathname);var s=JSON.parse(localStorage.getItem('danchu.app.settings')||'{}');var t=s.theme||'system';var d=app&&(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches));document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})()",
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
