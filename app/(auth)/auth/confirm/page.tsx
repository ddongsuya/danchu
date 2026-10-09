import type { Metadata } from "next";
import { safeNext } from "@/lib/auth-links";
import { ConfirmForm } from "@/components/auth/ConfirmForm";

export const metadata: Metadata = { title: "이메일 확인 · 단추", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TITLE: Record<string, string> = { recovery: "비밀번호를 다시 정합니다", magiclink: "로그인합니다", signup: "가입을 완료합니다", email: "이메일을 확인합니다" };

/**
 * 메일의 버튼이 여기로 온다. 이 페이지는 토큰을 쓰지 않는다.
 * 기업 메일 보안 스캐너(Safe Links, Mimecast 등)가 링크를 미리 열어 보면 GET 한 번에 토큰이 소진되므로,
 * 실제 확인은 사용자의 POST(/api/auth/confirm)에서만 일어난다.
 */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const sp = await searchParams;
  const tokenHash = sp.token_hash || "";
  const type = ["magiclink", "recovery", "signup", "email"].includes(sp.type || "") ? (sp.type as string) : "magiclink";
  const next = safeNext(sp.next);

  if (!tokenHash) {
    return (
      <div className="auth__card">
        <h1 className="auth__title">링크가 올바르지 않습니다</h1>
        <p className="auth__sub">메일의 버튼을 다시 눌러 주세요. 계속 안 되면 <a href="/login">로그인 화면</a>에서 링크를 새로 요청할 수 있습니다.</p>
      </div>
    );
  }
  return (
    <div className="auth__card">
      <div>
        <h1 className="auth__title">{TITLE[type]}</h1>
        <p className="auth__sub">잠시 후 자동으로 넘어갑니다. 넘어가지 않으면 아래 버튼을 눌러 주세요.</p>
      </div>
      <ConfirmForm tokenHash={tokenHash} type={type} next={next} />
    </div>
  );
}
