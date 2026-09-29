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
    if (!res.ok) console.error("upload failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("upload failed", e);
    return false;
  }
}

/**
 * 저장 경로용 파일명. 영문·숫자·점·하이픈·밑줄만 남긴다.
 * Supabase Storage는 경로에 한글 등 비ASCII 문자가 있으면 업로드를 거부한다.
 * 원래 파일명은 DB(file_name, pdf_name)에 따로 저장해 화면과 내려받기에 쓴다.
 */
export function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toLowerCase() : "";
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
  return (base || "file") + (ext ? `.${ext}` : "");
}

/** 서버 전용: 비공개 버킷에 객체가 실제로 있는지 (서명 업로드가 끝났는지) */
export async function storageHas(sb: { storage: { from: (b: string) => { list: (dir: string, o: { search: string; limit: number }) => Promise<{ data: { name: string }[] | null; error: unknown }> } } }, bucket: string, path: string): Promise<boolean> {
  const i = path.lastIndexOf("/");
  const dir = i > 0 ? path.slice(0, i) : "";
  const name = i > 0 ? path.slice(i + 1) : path;
  const { data, error } = await sb.storage.from(bucket).list(dir, { search: name, limit: 20 });
  return !error && !!data?.some((o) => o.name === name);
}
