import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/app/ui";
import "@/components/shell/portal.css";

export const metadata: Metadata = { title: "단추 — 견적 회신", robots: { index: false, follow: false } };

/** 토큰 링크로 들어온 CRO용 골격 — 로그인 없이, 메뉴 없이 */
export default function TokenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt">
      <div className="pt__body">
        <header className="pt__top" style={{ display: "block" }}>
          <div className="pt__topin" style={{ maxWidth: 1080, margin: "0 auto" }}>
            <Link href="/" className="pt__brand">
              <Mark size={24} />
              <span>단추</span>
              <span className="pt__role">CRO</span>
            </Link>
            <Link href="/signup/cro" style={{ fontSize: 13, color: "var(--muted)" }}>CRO 계정 만들기</Link>
          </div>
        </header>
        <main className="pt__main" style={{ paddingBottom: 48 }}>{children}</main>
      </div>
    </div>
  );
}
