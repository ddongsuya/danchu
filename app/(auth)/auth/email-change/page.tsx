import type { Metadata } from "next";
import { EmailChangeConfirm } from "@/components/auth/EmailChangeConfirm";

export const metadata: Metadata = { title: "이메일 변경 확인 · 단추", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** 메일의 버튼이 여기로 온다. 확인은 사용자의 POST 에서만 일어난다 (메일 스캐너의 GET 으로 토큰이 소진되지 않게) */
export default async function EmailChangePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return (
      <div className="auth__card">
        <h1 className="auth__title">링크가 올바르지 않습니다</h1>
        <p className="auth__sub">메일의 버튼을 다시 눌러 주세요. 계속 안 되면 프로필에서 변경을 다시 요청할 수 있습니다.</p>
      </div>
    );
  }
  return (
    <div className="auth__card">
      <div>
        <h1 className="auth__title">로그인 이메일을 바꿉니다</h1>
        <p className="auth__sub">잠시 후 자동으로 넘어갑니다. 로그인되어 있지 않으면 먼저 로그인 화면이 열립니다.</p>
      </div>
      <EmailChangeConfirm token={token} />
    </div>
  );
}
