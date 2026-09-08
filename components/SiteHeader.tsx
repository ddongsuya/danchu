import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { HeaderAuth } from "@/components/HeaderAuth";
import { RfqLink } from "@/components/RfqLink";
import { SiteNav } from "@/components/SiteNav";

/** 공개 사이트 헤더 — 로고 · 메뉴(좁은 화면은 햄버거) · KO/EN · 로그인 · CTA */
export function SiteHeader() {
  return (
    <header className="shead">
      <div className="shead__left">
        <Logo href="/" size={28} nameSize={18} />
        <SiteNav />
      </div>
      <div className="shead__right">
        <LangToggle />
        <HeaderAuth className="shead__login" />
        <RfqLink className="btn btn--pill btn--sm">견적 요청하기</RfqLink>
      </div>
    </header>
  );
}
