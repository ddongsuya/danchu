import type { NextConfig } from "next";

// 첨부 업로드는 서버를 거치지 않고 Supabase Storage 서명 URL로 직접 올린다
// (Vercel 함수 요청 본문 한도 4.5MB). 서버 바디 제한을 늘릴 필요가 없다.
const nextConfig: NextConfig = {};

export default nextConfig;
