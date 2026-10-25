import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Diag } from "@/components/site/Diag";
import { FilmPlay } from "@/components/site/FilmPlay";
import { HeadWatch } from "@/components/site/HeadWatch";
import { ScrollTop } from "@/components/site/ScrollTop";
import { ScrollCue } from "@/components/site/ScrollCue";
import { ViewportHeight } from "@/components/site/ViewportHeight";
import "@/app/site.css";

/**
 * 공개 페이지 골격. 루트 .a 가 B안 토큰을 켠다.
 * onescreen: 최상위 section 마다 한 화면(스크롤 스냅). 랜딩은 고정 장면이 있어 끄고, 나머지 공개 페이지는 켠다.
 * cue: "아래로 내려 보세요" 안내. 첫 화면부터 목록·본문이 이어지는 페이지(FAQ·약관)는 안내가 내용을 가리므로 끈다.
 */
export function Site({ children, current, next, onescreen = true, cue = true }: { children: React.ReactNode; current?: string; next?: { href: string; label: string }; onescreen?: boolean; cue?: boolean }) {
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
        <ViewportHeight />
        <ScrollTop />
        {cue && <ScrollCue />}
        <FilmPlay />
      <Diag />
      <HeadWatch />
    </div>
  );
}
