import { Logo } from "@/components/Logo";
import { HeaderAuth } from "@/components/HeaderAuth";
import { RfqLink } from "@/components/RfqLink";
import { SiteNav } from "@/components/SiteNav";

/** 공개 사이트 헤더. 한 줄 64px: 워드마크 · 메뉴 · 로그인 · 요청서 작성 */
export function SiteHeader() {
  return (
    <header className="hd">
      <div className="wrap hd__in">
        <div className="hd__left">
          <Logo />
          <SiteNav />
        </div>
        <div className="hd__right">
          <HeaderAuth className="hd__login" />
          <RfqLink className="b b--fill b--sm hd__cta">요청서 작성</RfqLink>
        </div>
      </div>
    </header>
  );
}
