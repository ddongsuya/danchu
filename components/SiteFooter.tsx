import Link from "next/link";
import { LogoMark } from "@/components/Logo";

const SERVICE: [string, string][] = [
  ["/about", "서비스 소개"],
  ["/#fields", "시험 분야"],
  ["/faq", "자주 묻는 질문"],
];
const JOIN: [string, string][] = [
  ["/for-cro", "CRO 참여 안내"],
  ["/partners", "협력기관"],
];
const POLICY: [string, string][] = [
  ["/terms", "이용약관"],
  ["/privacy", "개인정보처리방침"],
];

function Col({ title, links, current }: { title: string; links: [string, string][]; current?: string }) {
  return (
    <nav className="sfoot__col" aria-label={title}>
      <span className="sfoot__coltitle">{title}</span>
      {links.map(([href, label]) => (
        <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** 공개 사이트 꼬리말 — 브랜드 · 3단 링크 · 사업자 정보 */
export function SiteFooter({ current }: { current?: string }) {
  return (
    <footer className="sfoot">
      <div className="sfoot__in">
        <div className="sfoot__top">
          <div className="sfoot__brand">
            <span className="sfoot__mark">
              <LogoMark size={24} />
              <b>단추</b>
            </span>
            <p>비임상 시험 의뢰자와 GLP 시험기관을 잇는 견적 비교 플랫폼</p>
          </div>
          <Col title="서비스" links={SERVICE} current={current} />
          <Col title="참여" links={JOIN} current={current} />
          <Col title="정책" links={POLICY} current={current} />
        </div>
        <div className="sfoot__legal">
          <span>
            [상호] · 대표 [대표자명] · 사업자등록번호 [000-00-00000] · [사업장 주소] ·{" "}
            <a href="mailto:hello@danchu.kr">hello@danchu.kr</a>
          </span>
          <span>© 2026 Danchu</span>
        </div>
      </div>
    </footer>
  );
}
