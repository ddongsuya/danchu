"use client";

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

/*
 * 공개 페이지 사이 이동은 next/link가 아니라 일반 <a>로 페이지를 새로 연다.
 * next/link로 옮기면 앞 페이지의 CSS가 문서에 남는데, 페이지마다 같은 .a 아래 같은 클래스 이름(.ph2 등)을 쓰고 있어
 * 랜딩 CSS가 메뉴 페이지 제목 영역을 숨기는 등 서로 덮어쓴다(2026-10-27 "처음 들어가면 제목이 없고 새로고침하면 보임"의 원인).
 */

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

  const closeOnLink = (e: React.MouseEvent) => {
    if ((e.target as Element).closest("a")) {
      document.documentElement.style.overflow = "";
      setOpen(false);
    }
  };

  const requestHref = loading ? REQUEST_HREF : !me ? GUEST_REQUEST_HREF : me.role === "requester" ? REQUEST_HREF : me.to;
  const on = (href: string) => pathname === href;

  return (
    <>
      <div className="links">
        {SITE_LINKS.map(([href, label]) => (
          <a key={href} href={href} aria-current={on(href) ? "page" : undefined}>
            {label}
          </a>
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
            {/* 링크를 누르면 이동 전에 먼저 닫는다. 열린 채로 이동하면 잠가 둔 스크롤이 새 페이지에서 풀리며 제목 아래로 밀린다 */}
            <nav className="mnav__links" aria-label="사이트 메뉴" onClick={closeOnLink}>
              <a href="/" aria-current={on("/") ? "page" : undefined}>홈</a>
              {SITE_LINKS.map(([href, label]) => (
                <a key={href} href={href} aria-current={on(href) ? "page" : undefined}>
                  {label}
                </a>
              ))}
            </nav>
            <div className="mnav__foot" onClick={closeOnLink}>
              <a href={requestHref} className="btn solid">견적 요청하기 <span className="ar">→</span></a>
              <a href={me ? me.to : "/login"} className="btn ghost">{me ? PORTAL[me.role] : "로그인"}</a>
              <div className="mnav__sub">
                <a href="/privacy"><strong>개인정보처리방침</strong></a>
                <a href="/terms">이용약관</a>
                <a href="mailto:hello@danchu.kr">hello@danchu.kr</a>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
