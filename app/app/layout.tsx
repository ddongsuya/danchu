import type { Metadata, Viewport } from "next";
import { AppState } from "@/components/app/AppState";
import "./app.css";

export const metadata: Metadata = {
  title: "단추 — 견적 요청과 비교",
  description: "비임상 시험 견적을 요청하고 도착한 견적을 비교합니다.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "단추" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F4" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppState>
      {/* 첫 페인트 전에 테마를 확정해 화면이 번쩍이지 않게 한다 */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var s=JSON.parse(localStorage.getItem('danchu.app.settings')||'{}');var t=s.theme||'system';var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})()",
        }}
      />
      <div className="mobshell">
        <div className="mob">{children}</div>
      </div>
    </AppState>
  );
}
