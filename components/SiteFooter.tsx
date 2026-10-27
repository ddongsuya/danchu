import { LogoMark, Wordmark } from "@/components/Logo";

const COLS: [string, [string, string][]][] = [
  ["서비스", [["/about", "서비스 소개"], ["/how-it-works", "이용 안내"], ["/request", "견적 요청"]]],
  ["안내", [["/guide", "시험 가이드"], ["/faq", "자주 묻는 질문"]]],
  ["기관", [["/for-cro", "기관 참여 안내"], ["/login", "기관 로그인"], ["/partners", "협력기관"]]],
  ["문의", [["mailto:hello@danchu.kr", "hello@danchu.kr"], ["/terms", "이용약관"], ["/privacy", "개인정보처리방침"]]],
];

/** 공개 사이트 꼬리말. 큰 연회색 로고(마크 + danchu)가 공식 로고이며 줄이거나 색을 바꾸지 않는다. */
export function SiteFooter({ current }: { current?: string }) {
  return (
    <footer>
      <div className="cols">
        {COLS.map(([title, links]) => (
          <div key={title}>
            <b>{title}</b>
            {links.map(([href, label]) =>
              href.startsWith("mailto:") ? (
                <a key={href} href={href}>{label}</a>
              ) : (
                <a key={href} href={href} aria-current={current === href ? "page" : undefined}>{label}</a>
              ),
            )}
          </div>
        ))}
      </div>
      <div className="word" aria-hidden="true">
        <LogoMark className="bigmark" />
        <span className="wm"><Wordmark /></span>
      </div>
      <div className="fine mono"><span>© 2026 단추</span><span>비임상 시험 비교 견적</span></div>
    </footer>
  );
}
