"use client";
import { useRef, useState } from "react";
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
  if (!r.ok) throw new Error(d.error || "업로드를 준비하지 못했어요.");
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
/** 요청 첨부로 고를 수 있는 형식 (서버 검사는 lib/upload allowedRfqFile) */
export const ACCEPT = ".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.hwp";

export type AttachmentFile = { id: string; name: string; size: number; uploaded: boolean };
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;

/**
 * 첨부 목록 (시안 v7 r-req att). 올라간 파일은 내려받기, 올라가지 않은 파일만 오류 줄과 "다시 올리기"를 단다.
 * 다시 올리기는 같은 이름과 크기의 파일을 고르면 그 줄을 채운다 (/api/rfq/[no]/files/retry).
 */
export function AttachmentRows({ no, files, canRetry }: { no: string; files: AttachmentFile[]; canRetry: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<AttachmentFile | null>(null);
  const [busy, setBusy] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const pick = (f: AttachmentFile) => {
    if (busy) return;
    setTarget(f);
    fileRef.current?.click();
  };
  return (
    <div className="rq-files">
      {files.map((f) =>
        f.uploaded ? (
          <div key={f.id} className="rq-file">
            <a className="rq-file__n" href={`/api/files/${f.id}`}>{f.name}</a>
            <span className="rq-file__s tnum">{mb(f.size)} · 첨부함</span>
          </div>
        ) : (
          <div key={f.id} className="rq-file rq-file--bad">
            <span className="rq-file__n">{f.name}</span>
            <span className="rq-file__s tnum">{mb(f.size)}</span>
            {canRetry && (
              <button type="button" className="btxt" disabled={!!busy} aria-busy={busy === f.id || undefined} onClick={() => pick(f)}>
                {busy === f.id ? "올리는 중" : "다시 올리기"}
              </button>
            )}
            <span className="rq-file__msg" role="alert">{errs[f.id] || `첨부를 올리지 못했어요: ${f.name}. 다시 골라 주세요.`}</span>
          </div>
        ),
      )}
      <input
        ref={fileRef}
        type="file"
        hidden
        aria-label="다시 올릴 파일 고르기"
        accept={ACCEPT}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const t = target;
          if (!file || !t) return;
          setBusy(t.id);
          setErrs((m) => ({ ...m, [t.id]: "" }));
          try {
            if (!(await retryAttachment(no, file))) throw new Error(`첨부를 올리지 못했어요: ${file.name}. 다시 골라 주세요.`);
            router.refresh();
          } catch (error) {
            setErrs((m) => ({ ...m, [t.id]: error instanceof Error ? error.message : `첨부를 올리지 못했어요: ${file.name}. 다시 골라 주세요.` }));
          } finally {
            setBusy("");
          }
        }}
      />
    </div>
  );
}

export function AttachmentRetry({ no }: { no: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>첨부파일 추가·다시 올리기</span>
        {/* 브라우저 기본 파일 칸 대신 같은 모양의 버튼으로 연다 */}
        <button type="button" className="b2" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "올리는 중…" : "파일 고르기"}
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          aria-label="첨부파일 고르기"
          disabled={busy}
          accept={ACCEPT}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            try {
              if (!(await retryAttachment(no, file)))
                throw new Error(
                  "업로드하지 못했어요. 파일을 다시 선택해 주세요.",
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
      </div>
      <p className="fld__help" role="status">
        {busy
          ? "업로드 중…"
          : msg ||
            "파일당 20MB 이하, 최대 10개. 같은 이름과 크기의 미완료 파일은 다시 업로드해요."}
      </p>
    </div>
  );
}
