import Link from "next/link";
import { Logo } from "@/components/Logo";
import "./auth.css";
import { ArrowUpRight, Check } from "@phosphor-icons/react/dist/ssr";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <header className="auth__head">
        <div className="fm__head-in">
          <Logo />
          <Link href="/" style={{ fontSize: 14, color: "var(--muted)" }}>홈으로</Link>
        </div>
      </header>
      <main className="auth__main"><aside className="auth__intro"><h2>연구의 다음 단계,<br /><strong>단추에서 시작하세요.</strong></h2><p>필요한 시험을 요청하고,<br />기관의 견적을 한곳에서 비교합니다.</p><ul><li><Check size={18} aria-hidden="true" /> 한 번의 요청, 같은 양식의 회신</li><li><Check size={18} aria-hidden="true" /> 설계와 포함 범위까지 비교</li><li><Check size={18} aria-hidden="true" /> 기밀 등급에 따른 정보 보호</li></ul><Link href="/about">단추 서비스 알아보기 <ArrowUpRight size={17} aria-hidden="true" /></Link></aside><div className="auth__form-area">{children}</div></main>
    </div>
  );
}
