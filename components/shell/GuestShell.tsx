import Link from "next/link";
import { Lockup } from "@/components/Logo";
import "./portal.css";

/**
 * 로그인 전 방문자가 요청서를 쓰는 화면의 셸. 포털과 같은 토큰·컴포넌트를 쓰되 메뉴는 없다.
 * 가입은 다 쓰고 보내기 직전에 같은 화면에서 이메일 인증으로 한다.
 */
export function GuestShell({ children, loginNext = "/app/new" }: { children: React.ReactNode; loginNext?: string }) {
  return (
    <div className="pt pt--guest">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <div className="pt__body">
        <header className="pt__top">
          <div className="pt__topin">
            <a href="/" className="pt__brand">
              <Lockup size={20} />
            </a>
            <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="pt__guest-login">
              이미 계정이 있다면 로그인
            </Link>
          </div>
        </header>
        <main className="pt__main" id="main-content">{children}</main>
      </div>
    </div>
  );
}
