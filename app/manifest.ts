import type { MetadataRoute } from "next";

/** PWA 매니페스트 — 홈 화면 설치. 웹과 앱이 같은 코드를 쓴다. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "단추 — 비임상 시험 견적",
    short_name: "단추",
    description: "비임상 시험 견적을 한번 요청하고 한눈에 비교하세요.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F5F4",
    theme_color: "#A3690F",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "새 견적 요청", url: "/app/new" },
      { name: "받은 요청 (CRO)", url: "/cro" },
    ],
  };
}
