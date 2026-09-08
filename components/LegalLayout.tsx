import Link from "next/link";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import "@/app/home.css";

/** 약관·개인정보처리방침 공통 레이아웃 */
export function LegalLayout({
  title,
  effectiveDate,
  version,
  current,
  children,
}: {
  title: string;
  effectiveDate: string;
  version: string;
  current?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="site">
      <SiteHeader />
      <main className="legal-main">
        <article className="legal">
          <h1 className="legal__title">{title}</h1>
          <p className="legal__meta">
            시행일 {effectiveDate} · {version}
          </p>
          {children}
          <div className="legal__back">
            <Link href="/" className="btn btn--outline">
              ← 홈으로
            </Link>
          </div>
        </article>
      </main>
      <SiteFooter current={current} />
    </div>
  );
}

/** 가로 스크롤 가능한 표 래퍼 */
export function LegalTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal__table-wrap">
      <table>{children}</table>
    </div>
  );
}
