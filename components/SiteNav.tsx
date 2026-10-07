"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/lib/use-me";
import { REQUEST_HREF, SIGNUP_HREF } from "@/components/RfqLink";

export const SITE_LINKS: [string, string][] = [
  ["/about", "서비스 소개"],
  ["/for-cro", "기관 참여"],
  ["/faq", "자주 묻는 질문"],
];

const PORTAL = { requester: "내 요청", cro: "기관 포털", admin: "운영" } as const;

/** 공개 사이트 메뉴. 넓은 화면은 가로 링크, 좁은 화면은 오른쪽 시트 */
export function SiteNav() {
  const pathname = usePathname();
  const { me, loading } = useMe();
  const [open, setOpen] = useState(false);

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
      <nav className="nav" aria-label="주요 메뉴">
        {SITE_LINKS.map(([href, label]) => (
          <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      <button type="button" className="burger" aria-label="메뉴 열기" aria-expanded={open} onClick={() => setOpen(true)}>
        <i /><i /><i />
      </button>

      {open && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="메뉴">
          <div className="sheet__bg" onClick={() => setOpen(false)} />
          <div className="sheet__panel">
            <div className="sheet__top">
              <span className="sheet__ttl">메뉴</span>
              <button type="button" className="sheet__x" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>×</button>
            </div>
            <nav className="sheet__links" aria-label="사이트 메뉴">
              <Link href="/" aria-current={on("/") ? "page" : undefined}>홈</Link>
              {SITE_LINKS.map(([href, label]) => (
                <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="sheet__foot">
              <Link href={requestHref} className="b b--fill b--lg">견적 요청하기</Link>
              <Link href={me ? me.to : "/login"} className="b b--line b--lg">{me ? PORTAL[me.role] : "로그인"}</Link>
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
