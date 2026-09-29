import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { NewRequest } from "@/components/NewRequest";
import "@/components/shell/portal.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "요청서 체험 · 단추",
  robots: { index: false, follow: false },
};

/** Synthetic, submit-disabled form. Never enables access to authenticated routes. */
export default function RequestPreview() {
  const enabled = process.env.VERCEL_ENV === "preview" ||
    (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();

  return <AppState>
    <div className="pt" style={{ display: "block" }}>
      <main className="pt__main" style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div className="note note--tint" style={{ marginBottom: 24 }}>
          <b>요청서 체험</b>
          <p>로그인 없이 입력 순서와 최종 확인 화면을 살펴볼 수 있습니다. 실제 접수나 파일 업로드는 이루어지지 않습니다. 예시 정보로 작성해 주세요.</p>
        </div>
        <NewRequest preview userId="request-preview" contact={{
          company: "예시 의뢰사", name: "검토 담당자", email: "preview@example.invalid",
          dept: "", phone: "", orgType: "",
        }} />
      </main>
    </div>
  </AppState>;
}
