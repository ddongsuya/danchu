import { Logo } from "@/components/Logo";
import { HeaderAuth } from "@/components/HeaderAuth";
import { RfqLink } from "@/components/RfqLink";
import { SiteNav } from "@/components/SiteNav";

/** 공개 사이트 상단 바. 한 줄 68px: 로고 락업 · 메뉴 · 로그인 · 견적 요청하기. 스타일은 app/site.css 의 nav.top */
export function SiteHeader() {
  return (
    <>
      <a className="skip" href="#main">본문으로 건너뛰기</a>
      <nav className="top" aria-label="주요 메뉴">
        <Logo />
        <SiteNav />
        <div className="right">
          <HeaderAuth className="si" />
          <RfqLink className="btn solid sm">견적 요청하기 <span className="ar">→</span></RfqLink>
        </div>
      </nav>
    </>
  );
}
