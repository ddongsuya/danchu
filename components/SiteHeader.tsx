import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { HeaderAuth } from "@/components/HeaderAuth";
import { RfqLink } from "@/components/RfqLink";

/** 공개 사이트 헤더 — 로고 · KO/EN · 로그인(또는 포털) · CTA */
export function SiteHeader() {
  return (
    <header className="shead">
      <Logo href="/" size={28} nameSize={18} />
      <div className="shead__right">
        <LangToggle />
        <HeaderAuth className="shead__login" />
        <RfqLink className="btn btn--pill btn--sm">견적 요청하기</RfqLink>
      </div>
    </header>
  );
}
