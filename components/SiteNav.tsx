"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMe } from "@/lib/use-me";
import { GUEST_REQUEST_HREF, REQUEST_HREF } from "@/components/RfqLink";

export const SITE_LINKS: [string, string][] = [
  ["/about", "서비스 소개"],
  ["/how-it-works", "이용 안내"],
  ["/guide", "시험 가이드"],
  ["/for-cro", "기관 참여"],
  ["/faq", "자주 묻는 질문"],
];

const PORTAL = { requester: "내 요청", cro: "기관 포털", admin: "운영" } as const;

/** 공개 사이트 메뉴. 넓은 화면은 가로 링크(.links), 좁은 화면은 "메뉴" 버튼 → 오른쪽 시트 */
export function SiteNav() {
  const pathname = usePathname();
  const { me, loading } = useMe();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const surface = dialog.current;
    surface?.showModal();
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => innerWidth > 860 && setOpen(false);
    addEventListener("keydown", onKey);
    addEventListener("resize", onResize);
    return () => {
      surface?.close();
      trigger.current?.focus();
      document.documentElement.style.overflow = "";
      removeEventListener("keydown", onKey);
      removeEventListener("resize", onResize);
    };
  }, [open]);

  const requestHref = loading ? REQUEST_HREF : !me ? GUEST_REQUEST_HREF : me.role === "requester" ? REQUEST_HREF : me.to;
  const on = (href: string) => pathname === href;

  return (
    <>
      <div className="links">
        {SITE_LINKS.map(([href, label]) => (
          <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </div>

      <button type="button" className="menu" ref={trigger} aria-label="메뉴 열기" aria-expanded={open} onClick={() => setOpen(true)}>
        메뉴
      </button>

      {open && (
        <dialog className="mnav" ref={dialog} aria-label="메뉴" onCancel={() => setOpen(false)}>
          <div className="mnav__bg" onClick={() => setOpen(false)} />
          <div className="mnav__panel">
            <div className="mnav__top">
              <span className="mnav__ttl">메뉴</span>
              <button type="button" className="mnav__x" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>×</button>
            </div>
            <nav className="mnav__links" aria-label="사이트 메뉴">
              <Link href="/" aria-current={on("/") ? "page" : undefined}>홈</Link>
              {SITE_LINKS.map(([href, label]) => (
                <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="mnav__foot">
              <Link href={requestHref} className="btn solid">견적 요청하기 <span className="ar">→</span></Link>
              <Link href={me ? me.to : "/login"} className="btn ghost">{me ? PORTAL[me.role] : "로그인"}</Link>
              <div className="mnav__sub">
                <Link href="/privacy">개인정보처리방침</Link>
                <Link href="/terms">이용약관</Link>
                <a href="mailto:hello@danchu.kr">hello@danchu.kr</a>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
