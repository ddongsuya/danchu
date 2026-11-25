/**
 * 기관 CRM 기록 첨부 (0051). 회의 녹음·회의록·자료를 기록(cro_crm_activities)에 붙인다.
 * - 파일은 비공개 버킷 crm-files 의 `<org_id>/<activity_id>/<uuid>-<안전한 이름>`. 서버(service role)만 읽고 쓴다.
 * - 목록은 cro_crm_activities.files [{path, name, size, type}] 최대 10개. 쓰기는 /api/cro/crm/files 만 한다.
 * - 녹음을 글로 옮기는 기능(전사)은 아직 없다. 녹음 파일은 그대로 보관만 한다.
 * 순수 함수는 화면·서버·테스트가 함께 쓴다. 저장소를 부르는 함수는 맨 아래.
 */
import { safeName } from "./upload";
import type { CrmFile } from "./crm-shape";

export const CRM_BUCKET = "crm-files";
/** 파일 하나 최대 크기 (회의 녹음 1~2시간이 들어가게) */
export const CRM_FILE_MAX = 50 * 1024 * 1024;
/** 기록 하나에 붙이는 파일 수 (0051 의 check 와 같다) */
export const CRM_FILES_PER_ACTIVITY = 10;
/** 받는 형식: 녹음, 문서(pdf·docx·xlsx·pptx·txt), 이미지 */
export const CRM_AUDIO_EXTS = ["mp3", "m4a", "wav", "aac", "ogg", "oga", "webm", "flac", "amr"] as const;
export const CRM_DOC_EXTS = ["pdf", "docx", "xlsx", "pptx", "txt", "png", "jpg", "jpeg", "gif", "webp", "heic"] as const;
/** 파일 고르기(accept). 서버도 같은 목록으로 다시 본다 */
export const CRM_FILE_ACCEPT = ["audio/*", ...[...CRM_AUDIO_EXTS, ...CRM_DOC_EXTS].map((e) => `.${e}`)].join(",");

const extOf = (name: string) => /\.([A-Za-z0-9]+)$/.exec(name.trim())?.[1].toLowerCase() ?? "";

/** 녹음 파일인지 (화면의 "녹음 파일" 표시) */
export const isAudioFile = (f: Pick<CrmFile, "name" | "type">) => (CRM_AUDIO_EXTS as readonly string[]).includes(extOf(f.name)) || f.type.startsWith("audio/");

/** 올리기 전 검사. 문제가 없으면 null. 확장자로만 판단한다 (브라우저가 주는 형식은 믿지 않는다) */
export function crmFileError(name: string, size: number): string | null {
  if (!name.trim() || !Number.isFinite(size) || size <= 0) return "파일 정보가 올바르지 않아요.";
  const ext = extOf(name);
  if (![...CRM_AUDIO_EXTS, ...CRM_DOC_EXTS].includes(ext as never)) return "녹음(mp3·m4a·wav 등), pdf, docx, xlsx, pptx, txt, 이미지 파일만 붙일 수 있어요.";
  if (size > CRM_FILE_MAX) return "파일 하나는 50MB까지 붙일 수 있어요.";
  return null;
}

/** 저장 경로. 원래 이름은 files 목록에 따로 남기고, 경로에는 영문·숫자만 남긴 이름을 쓴다 (Storage 는 비ASCII 경로를 거부) */
export const crmFilePath = (orgId: string, activityId: string, name: string, uuid: string = crypto.randomUUID()) => `${orgId}/${activityId}/${uuid}-${safeName(name)}`;

/** 이 기관·이 기록의 경로인지 (다른 기관·다른 기록의 파일을 붙이거나 내려받지 못하게) */
export function isCrmFilePath(path: unknown, orgId: string, activityId: string): path is string {
  if (typeof path !== "string" || path.length > 400 || path.includes("..")) return false;
  const pre = `${orgId}/${activityId}/`;
  return path.startsWith(pre) && /^[0-9a-f-]{36}-[A-Za-z0-9._-]+$/.test(path.slice(pre.length));
}

/** DB 의 files 값을 믿을 수 있는 모양으로 (모양이 다른 항목은 버린다) */
export function cleanFiles(v: unknown): CrmFile[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({ path: String(x.path ?? ""), name: String(x.name ?? "").slice(0, 200), size: Number(x.size) || 0, type: String(x.type ?? "").slice(0, 100) }))
    .filter((x) => x.path && x.name)
    .slice(0, CRM_FILES_PER_ACTIVITY);
}

/** 화면에 보일 이름 (경로가 아니라 올린 사람이 고른 이름, 줄바꿈·제어 문자 없이) */
export const displayName = (name: string) => name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) || "파일";

/** 1.2MB · 340KB */
export function sizeLabel(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
  return `${Math.max(1, Math.round(n / 1024))}KB`;
}

/** 기록 여러 개의 첨부 경로 (지우기 전에 모은다) */
export const activityFilePaths = (rows: { files?: unknown }[]) => rows.flatMap((r) => cleanFiles(r.files).map((f) => f.path));

// ─── 저장소 (서버 전용) ───
type Bucket = {
  remove: (paths: string[]) => Promise<{ error: unknown }>;
  list: (dir: string, o: { search: string; limit: number }) => Promise<{ data: { name: string; metadata?: Record<string, unknown> | null }[] | null; error: unknown }>;
};
type Store = { storage: { from: (b: string) => Bucket } };

/** 파일 지우기. 실패해도 기록 지우기는 막지 않고 남긴다 (고아 파일은 비공개라 밖으로 새지 않는다) */
export async function removeCrmFiles(sb: Store, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await sb.storage.from(CRM_BUCKET).remove(paths.slice(i, i + 100));
    if (error) console.error("crm files remove", error);
  }
}

/** 서명 업로드가 끝난 객체의 실제 크기 (없으면 null) */
export async function storedSize(sb: Store, path: string): Promise<number | null> {
  const i = path.lastIndexOf("/");
  const { data, error } = await sb.storage.from(CRM_BUCKET).list(path.slice(0, i), { search: path.slice(i + 1), limit: 20 });
  if (error) return null;
  const o = data?.find((x) => x.name === path.slice(i + 1));
  if (!o) return null;
  const n = Number(o.metadata?.size);
  return Number.isFinite(n) ? n : 0;
}
