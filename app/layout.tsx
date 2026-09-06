import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "단추 — 비임상 시험 견적, 한 번 요청하고 한눈에 비교",
  description:
    "여러 CRO에 따로 연락하지 마세요. 표준 양식으로 한 번 입력하면 단추가 배포하고, 같은 형식의 견적 비교표로 돌려드립니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
