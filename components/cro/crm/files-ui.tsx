"use client";

/**
 * 기록 첨부 (0051). 녹음·회의록·자료를 기록에 붙이고, 내려받고, 뺀다.
 * 올리기: 서명 URL(/api/cro/crm/files) → 브라우저가 Storage 로 바로 → 붙이기. 녹음을 글로 옮기는 기능은 아직 없다.
 */
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Microphone, Paperclip, X } from "@phosphor-icons/react";
import { CRM_FILES_PER_ACTIVITY, CRM_FILE_ACCEPT, crmFileError, displayName, isAudioFile, sizeLabel } from "@/lib/crm-files";
import type { CrmFile } from "@/lib/crm-shape";
import { uploadToSigned } from "@/lib/upload";
import { Err, useSend } from "./forms";

/** 녹음 듣기 주소 (서명 URL 로 보낸다, /api/cro/crm/files ?play=1) */
export const playHref = (activityId: string, path: string) => `/api/cro/crm/files?a=${activityId}&p=${encodeURIComponent(path)}&play=1`;

/**
 * 미팅 기록의 녹음 + 회의록 (와이어프레임 v7 c-voice). 녹음은 듣기만 하고, 회의록은 기록 본문(body)을 그대로 쓴다.
 * 녹음을 글로 옮기는 기능(전사)은 없다. 회의록은 사람이 적는다.
 */
export function VoiceNote({ activityId, files, body, readOnly = false }: { activityId: string; files: CrmFile[]; body: string; readOnly?: boolean }) {
  const audios = files.filter(isAudioFile);
  const { busy, err, setErr, send } = useSend();
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(body);
  const tid = useId();
  if (!audios.length) return null;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setErr("회의록을 적어 주세요.");
    if (await send("activities", "PATCH", { id: activityId, body: text })) setEdit(false);
  }
  return (
    <div className="cx-voice">
      <div className="cx-voice__rec">
        <span className="cx-voice__lab"><Microphone size={14} aria-hidden="true" />녹음</span>
        {audios.map((f) => (
          <figure key={f.path}>
            <audio controls preload="none" src={playHref(activityId, f.path)} aria-label={`${displayName(f.name)} 듣기`} />
            <figcaption><span className="cx-files__n">{displayName(f.name)}</span><span className="cx-files__s tnum">{sizeLabel(f.size)}</span></figcaption>
          </figure>
        ))}
      </div>
      <div className="cx-voice__min">
        <span className="cx-voice__lab">
          <label htmlFor={tid}>회의록</label>
          {!readOnly && !edit && <button type="button" className="crm-lk" onClick={() => { setText(body); setEdit(true); }}>{body ? "고치기" : "적기"}</button>}
        </span>
        {edit ? (
          <form onSubmit={save} className="cx-voice__form">
            <textarea id={tid} className="ta" rows={6} value={text} maxLength={20000} onChange={(e) => setText(e.target.value)} />
            <Err msg={err} />
            <span className="crm-acts">
              <button type="button" className="b2 bsm" onClick={() => { setEdit(false); setErr(""); }}>취소</button>
              <button type="submit" className="b1 bsm" disabled={busy}>{busy ? "저장 중" : "저장"}</button>
            </span>
          </form>
        ) : body ? <p className="cx-voice__body">{body}</p> : <p className="cx-muted cx-small">회의록이 없어요. 녹음은 글로 옮겨지지 않아요.</p>}
      </div>
    </div>
  );
}

async function post(body: Record<string, unknown>, method = "POST"): Promise<{ ok: boolean; error?: string; path?: string; signedUrl?: string; name?: string }> {
  try {
    const r = await fetch("/api/cro/crm/files", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; path?: string; signedUrl?: string; name?: string };
    return r.ok ? { ok: true, ...j } : { ok: false, error: j.error || (r.status === 403 ? "권한이 없어요. 미리보기에서는 저장되지 않아요." : "파일을 올리지 못했어요.") };
  } catch {
    return { ok: false, error: "연결이 끊겼어요. 인터넷 연결을 확인하고 다시 시도해 주세요." };
  }
}

/** 기록 하나에 파일 여러 개를 차례로 올린다. 실패한 파일 이름과 이유를 돌려준다 */
export async function uploadCrmFiles(activityId: string, files: File[]): Promise<string[]> {
  const fails: string[] = [];
  for (const f of files) {
    const meta = { activity_id: activityId, name: f.name, size: f.size, type: f.type };
    const t = await post(meta);
    if (!t.ok || !t.path || !t.signedUrl) { fails.push(`${f.name}: ${t.error ?? "올리지 못했어요."}`); continue; }
    if (!(await uploadToSigned({ name: t.name ?? f.name, path: t.path, signedUrl: t.signedUrl }, f))) { fails.push(`${f.name}: 올리는 중에 끊겼어요.`); continue; }
    const a = await post({ ...meta, action: "attach", path: t.path });
    if (!a.ok) fails.push(`${f.name}: ${a.error ?? "붙이지 못했어요."}`);
  }
  return fails;
}

/** 파일 고르기 + 고른 목록 (기록 남기기 폼). 저장 전에는 고르기만 한다 */
export function FilePicker({ files, onChange, max = CRM_FILES_PER_ACTIVITY }: { files: File[]; onChange: (f: File[]) => void; max?: number }) {
  const hid = useId();
  const [err, setErr] = useState("");
  function add(list: FileList | null) {
    if (!list) return;
    const picked = [...list];
    const bad = picked.map((f) => [f.name, crmFileError(f.name, f.size)] as const).find(([, e]) => e);
    const ok = picked.filter((f) => !crmFileError(f.name, f.size));
    const next = [...files, ...ok].slice(0, max);
    setErr(bad ? `${bad[0]}: ${bad[1]}` : files.length + ok.length > max ? `파일은 ${max}개까지 붙일 수 있어요.` : "");
    onChange(next);
  }
  return (
    <div className="cx-files">
      {files.length > 0 && (
        <ul className="cx-files__list">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <FileIcon f={{ name: f.name, type: f.type }} />
              <span className="cx-files__n">{f.name}</span>
              {isAudioFile({ name: f.name, type: f.type }) && <span className="cx-chip">녹음 파일</span>}
              <span className="cx-files__s tnum">{sizeLabel(f.size)}</span>
              <button type="button" className="cx-icon" aria-label={`${f.name} 빼기`} onClick={() => onChange(files.filter((_, j) => j !== i))}><X size={14} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
      {files.length < max && (
        <label className="cx-mini cx-files__add" htmlFor={hid}>
          <Paperclip size={15} aria-hidden="true" />파일 첨부
          <input id={hid} type="file" multiple accept={CRM_FILE_ACCEPT} className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
      )}
      <Err msg={err} />
    </div>
  );
}

function FileIcon({ f }: { f: Pick<CrmFile, "name" | "type"> }) {
  return isAudioFile(f) ? <Microphone size={15} aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />;
}

/** 기록 줄 아래 첨부: 내려받기 · 빼기 · 더 붙이기 */
export function ActivityFiles({ activityId, files, readOnly = false }: { activityId: string; files: CrmFile[]; readOnly?: boolean }) {
  const router = useRouter();
  const hid = useId();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ask, setAsk] = useState<string | null>(null);
  async function add(list: FileList | null) {
    const picked = [...(list ?? [])].slice(0, CRM_FILES_PER_ACTIVITY - files.length);
    if (!picked.length) return;
    const bad = picked.find((f) => crmFileError(f.name, f.size));
    if (bad) return setErr(`${bad.name}: ${crmFileError(bad.name, bad.size)}`);
    setBusy(true); setErr("");
    const fails = await uploadCrmFiles(activityId, picked);
    setBusy(false);
    if (fails.length) setErr(fails.join(" "));
    router.refresh();
  }
  async function remove(path: string) {
    setBusy(true); setErr("");
    const r = await post({ activity_id: activityId, path }, "DELETE");
    setBusy(false); setAsk(null);
    if (!r.ok) return setErr(r.error ?? "파일을 빼지 못했어요.");
    router.refresh();
  }
  if (!files.length && readOnly) return null;
  return (
    <div className="cx-files cx-files--row">
      {files.length > 0 && (
        <ul className="cx-files__list">
          {files.map((f) => (
            <li key={f.path}>
              <FileIcon f={f} />
              <a className="cx-files__n cx-lk" href={`/api/cro/crm/files?a=${activityId}&p=${encodeURIComponent(f.path)}`} rel="noopener" download>{displayName(f.name)}</a>
              {isAudioFile(f) && <span className="cx-chip">녹음 파일</span>}
              <span className="cx-files__s tnum">{sizeLabel(f.size)}</span>
              {!readOnly && (ask === f.path ? (
                <span className="crm-confirm">
                  <button type="button" className="crm-lk" disabled={busy} onClick={() => remove(f.path)}>빼기</button>
                  <button type="button" className="crm-lk" onClick={() => setAsk(null)}>그대로 두기</button>
                </span>
              ) : (
                <button type="button" className="cx-icon" aria-label={`${displayName(f.name)} 빼기`} onClick={() => setAsk(f.path)}><X size={14} aria-hidden="true" /></button>
              ))}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && files.length < CRM_FILES_PER_ACTIVITY && (
        <label className="cx-mini cx-files__add" htmlFor={hid} data-busy={busy ? "1" : "0"}>
          <Paperclip size={14} aria-hidden="true" />{busy ? "올리는 중" : files.length ? "파일 더 붙이기" : "파일 첨부"}
          <input id={hid} type="file" multiple accept={CRM_FILE_ACCEPT} className="sr-only" disabled={busy} onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
        </label>
      )}
      <Err msg={err} />
    </div>
  );
}
