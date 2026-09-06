import Link from "next/link";
import { Logo } from "./Logo";
import { LangToggle } from "./LangToggle";

/** 약관·개인정보처리방침 공통 레이아웃 */
export function LegalLayout({
  title,
  effectiveDate,
  version,
  children,
}: {
  title: string;
  effectiveDate: string;
  version: string;
  children: React.ReactNode;
}) {
  return (
    <div className="page form-page">
      <header className="header">
        <div className="container header__inner">
          <Logo sub={title} />
          <LangToggle />
        </div>
      </header>
      <main className="legal-main">
        <article className="legal">
          <h1 className="legal__title">{title}</h1>
          <p className="legal__meta">
            시행일 {effectiveDate} · {version}
          </p>
          {children}
          <div className="legal__back">
            <Link href="/" className="btn btn--outline btn--sm">
              ← 홈으로
            </Link>
          </div>
        </article>
      </main>
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
