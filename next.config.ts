import type { NextConfig } from "next";

// 첨부 업로드는 서버를 거치지 않고 Supabase Storage 서명 URL로 직접 올린다
// (Vercel 함수 요청 본문 한도 4.5MB). 서버 바디 제한을 늘릴 필요가 없다.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
