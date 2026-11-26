import type { Metadata } from "next";
import Link from "next/link";
import { Lockup } from "@/components/Logo";
import { UiProvider } from "@/components/ui/UiProvider";
import "@/components/shell/portal.css";
import "../layout-q.css";

export const metadata: Metadata = { title: "단추 · 견적 회신", robots: { index: false, follow: false } };

/** 토큰 링크로 들어온 CRO용 골격 - 로그인 없이, 메뉴 없이 위 바만 (로그인 전 요청서 GuestShell 과 같은 pt--guest) */
export default function TokenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt pt--guest pt--q">
      <UiProvider>
      <div className="pt__body">
        <header className="pt__top">
          <div className="pt__topin">
            <a href="/" className="pt__brand">
              <Lockup size={20} />
              <span className="pt__role">기관</span>
            </a>
            <span className="pt__tokenhint"><span className="pt__tokenhint-lead">로그인 없이 열린 참여 안내 · </span><Link href="/signup/cro">기관 계정 만들기</Link></span>
          </div>
        </header>
        <main className="pt__main">{children}</main>
      </div>
      </UiProvider>
    </div>
  );
}
