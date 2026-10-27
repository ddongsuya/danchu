import type { Metadata } from "next";
import Link from "next/link";
import { Lockup } from "@/components/Logo";
import "@/components/shell/portal.css";

export const metadata: Metadata = { title: "단추 · 견적 회신", robots: { index: false, follow: false } };

/** 토큰 링크로 들어온 CRO용 골격 - 로그인 없이, 메뉴 없이 */
export default function TokenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt">
      <div className="pt__body">
        <header className="pt__top" style={{ display: "block" }}>
          <div className="pt__topin" style={{ maxWidth: 1080, margin: "0 auto" }}>
            <a href="/" className="pt__brand">
              <Lockup size={20} />
              <span className="pt__role">기관</span>
            </a>
            <span className="pt__tokenhint">로그인 없이 열린 참여 안내 · <Link href="/signup/cro">기관 계정 만들기</Link></span>
          </div>
        </header>
        <main className="pt__main" style={{ paddingBottom: 48 }}>{children}</main>
      </div>
    </div>
  );
}
