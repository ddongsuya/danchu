"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/lib/use-me";
import { REQUEST_HREF, SIGNUP_HREF } from "@/components/RfqLink";

const LINKS: [string, string][] = [
  ["/about", "서비스 소개"],
  ["/faq", "자주 묻는 질문"],
  ["/partners", "협력기관"],
  ["/for-cro", "CRO 참여"],
];

const PORTAL = { requester: "내 요청", cro: "CRO 포털", admin: "운영" } as const;

/** 공개 사이트 메뉴 — 넓은 화면은 가로 링크, 좁은 화면은 햄버거 패널 */
export function SiteNav() {
  const pathname = usePathname();
  const { me, loading } = useMe();
  const [open, setOpen] = useState(false);

  // 화면 이동·ESC·리사이즈 시 닫기, 열려 있는 동안 배경 스크롤 잠금
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => innerWidth >= 900 && setOpen(false);
    addEventListener("keydown", onKey);
    addEventListener("resize", onResize);
    return () => {
      document.documentElement.style.overflow = "";
      removeEventListener("keydown", onKey);
      removeEventListener("resize", onResize);
    };
  }, [open]);

  const requestHref = loading ? REQUEST_HREF : !me ? SIGNUP_HREF : me.role === "requester" ? REQUEST_HREF : me.to;
  const on = (href: string) => pathname === href;

  return (
    <>
      <nav className="snav" aria-label="주요 메뉴">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      <button type="button" className="burger" aria-label="메뉴 열기" aria-expanded={open} onClick={() => setOpen(true)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="메뉴">
          <div className="sheet__bg" onClick={() => setOpen(false)} />
          <div className="sheet__panel">
            <div className="sheet__top">
              <span className="sheet__ttl">메뉴</span>
              <button type="button" className="sheet__x" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <nav className="sheet__links" aria-label="사이트 메뉴">
              <Link href="/" aria-current={on("/") ? "page" : undefined}>홈</Link>
              {LINKS.map(([href, label]) => (
                <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="sheet__foot">
              <Link href={requestHref} className="btn btn--pill btn--lg" style={{ width: "100%" }}>
                무료로 견적 요청
              </Link>
              <Link href={me ? me.to : "/login"} className="btn--ghost" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {me ? PORTAL[me.role] : "로그인"}
              </Link>
              <div className="sheet__sub">
                <Link href="/privacy">개인정보처리방침</Link>
                <Link href="/terms">이용약관</Link>
                <a href="mailto:hello@danchu.kr">hello@danchu.kr</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
