/**
 * 브라우저 → Supabase Storage 직접 업로드.
 * 서버는 서명 URL만 발급하고 파일 본문은 받지 않는다 (Vercel 함수 본문 한도 4.5MB 회피).
 */
export type UploadTicket = { name: string; path: string; signedUrl: string };

export async function uploadToSigned(ticket: UploadTicket, file: File): Promise<boolean> {
  try {
    const res = await fetch(ticket.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 파일명에서 경로·특수문자 제거 (한글 유지) */
export function safeName(name: string): string {
  return name.replace(/[^\w.\-가-힣]/g, "_").slice(0, 120) || "file";
}
