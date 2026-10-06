"use client";
import { useState } from "react";
import { uploadToSigned } from "@/lib/upload";
import { useRouter } from "next/navigation";
export async function retryAttachment(
  no: string,
  file: File,
): Promise<boolean> {
  const r = await fetch(`/api/rfq/${no}/files/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "업로드를 준비하지 못했습니다.");
  if (d.uploaded) return true;
  if (!(await uploadToSigned(d, file))) return false;
  const confirmed = await fetch(`/api/rfq/${no}/files/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths: [d.path] }),
  });
  const result = await confirmed.json();
  return confirmed.ok && result.complete === true;
}
export function AttachmentRetry({ no }: { no: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="stack">
      <label className="fld">
        <span>첨부파일 추가·다시 올리기</span>
        <input
          type="file"
          disabled={busy}
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.hwp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            try {
              if (!(await retryAttachment(no, file)))
                throw new Error(
                  "업로드하지 못했습니다. 파일을 다시 선택해 주세요.",
                );
              setMsg(`${file.name} 업로드 완료`);
              router.refresh();
            } catch (error) {
              setMsg(
                error instanceof Error ? error.message : "다시 시도해 주세요.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p className="fld__help" role="status">
        {busy
          ? "업로드 중…"
          : msg ||
            "파일당 20MB 이하, 최대 10개. 같은 이름과 크기의 미완료 파일은 다시 업로드합니다."}
      </p>
    </div>
  );
}
