import { Logo } from "@/components/Logo";
import { Orbit } from "@/components/site/Orbit";
import "@/app/site.css";
import "./auth.css";

/**
 * 로그인·가입·비밀번호 화면 골격. 왼쪽은 로고와 첫 화면의 궤도(계속 반복)만, 오른쪽은 양식.
 * PC에서는 왼쪽 패널이 스크롤에도 고정되고, 휴대폰에서는 로고 아래 작은 궤도 띠가 된다.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="a">
      <div className="wrap">
        <main id="main">
          <div className="auth">
            <aside className="brand">
              <Logo />
              <div className="lo" aria-hidden="true"><Orbit /></div>
            </aside>
            <div className="formside">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
