import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Diag } from "@/components/site/Diag";
import { FilmPlay } from "@/components/site/FilmPlay";
import { ScrollTop } from "@/components/site/ScrollTop";
import { ScrollCue } from "@/components/site/ScrollCue";
import "@/app/site.css";

/**
 * 공개 페이지 골격. 루트 .a 가 B안 토큰을 켠다.
 * onescreen: 최상위 section 마다 한 화면(스크롤 스냅). 랜딩은 고정 장면이 있어 끄고, 나머지 공개 페이지는 켠다.
 */
export function Site({ children, current, next, onescreen = true }: { children: React.ReactNode; current?: string; next?: { href: string; label: string }; onescreen?: boolean }) {
  return (
    <div className={onescreen ? "a onescreen" : "a"}>
      <div className="wrap">
        <SiteHeader />
        <main id="main">{children}</main>
        {next && (
          <Link className="nextp" href={next.href}>
            <span><small>다음으로 읽어보세요</small><b>{next.label}</b></span>
            <span className="ar" aria-hidden="true">→</span>
          </Link>
        )}
        <SiteFooter current={current} />
      </div>
        <ScrollTop />
        <ScrollCue />
        <FilmPlay />
      <Diag />
    </div>
  );
}
