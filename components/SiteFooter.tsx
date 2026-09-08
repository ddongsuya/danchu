import Link from "next/link";

const LINKS: [string, string][] = [
  ["/about", "서비스 소개"],
  ["/faq", "FAQ"],
  ["/partners", "협력기관"],
  ["/for-cro", "CRO 참여"],
  ["/privacy", "개인정보처리방침"],
  ["/terms", "이용약관"],
];

export function SiteFooter({ current }: { current?: string }) {
  return (
    <footer className="sfoot">
      <div className="sfoot__brand">
        <b>단추 Danchu</b>
        <span>
          사업자 정보 준비 중 · <a href="mailto:hello@danchu.kr">hello@danchu.kr</a>
        </span>
      </div>
      <nav className="sfoot__links" aria-label="사이트 링크">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
