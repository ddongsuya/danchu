import Link from "next/link";
import { Logo } from "@/components/Logo";
import "./auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <header className="auth__head">
        <div className="fm__head-in">
          <Logo />
          <Link href="/" style={{ fontSize: 14, color: "var(--muted)" }}>홈으로</Link>
        </div>
      </header>
      <main className="auth__main">{children}</main>
    </div>
  );
}
