import type { Metadata } from "next";

// 비밀번호 찾기 페이지는 클라이언트 컴포넌트라 탭 제목을 여기서 정한다.
export const metadata: Metadata = { title: "비밀번호 찾기 · 단추" };

export default function ForgotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
