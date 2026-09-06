import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 첨부 업로드(최대 10개 × 20MB)를 위해 서버 액션/라우트 바디 제한 완화
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
};

export default nextConfig;
