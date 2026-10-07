import Link from "next/link";

const COLS: [string, [string, string][]][] = [
  ["서비스", [["/about", "서비스 소개"], ["/#fields", "시험 분야"], ["/faq", "자주 묻는 질문"]]],
  ["참여", [["/for-cro", "기관 참여 안내"], ["/partners", "협력기관"]]],
  ["정책", [["/terms", "이용약관"], ["/privacy", "개인정보처리방침"]]],
];

/** 공개 사이트 꼬리말. 유일한 반전 면 */
export function SiteFooter({ current }: { current?: string }) {
  return (
    <footer className="ft">
      <div className="wrap">
        <div className="ft__top">
          <div className="ft__brand">
            <b>단추</b>
            <p>비임상 시험의 견적과 계약을 한곳에서. 의뢰자가 한 번 요청하면 여러 기관이 같은 양식으로 회신합니다.</p>
          </div>
          {COLS.map(([title, links]) => (
            <nav key={title} className="ft__col" aria-label={title}>
              <span>{title}</span>
              {links.map(([href, label]) => (
                <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>{label}</Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="ft__legal">
          <span>
            문의 <a href="mailto:hello@danchu.kr">hello@danchu.kr</a>
          </span>
          <span>© 2026 Danchu</span>
        </div>
      </div>
    </footer>
  );
}
