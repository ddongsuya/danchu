import { randomUUID } from "node:crypto";
import { get, put, del, list, BlobPreconditionFailedError } from "@vercel/blob";
import { createLabSession, getLabSession, restoreLabSnapshot, saveLabSnapshot, type LabSession, type SavedLabSession } from "./runtime";

const PREFIX = "danchu-agent-test/v1/";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
type Record = { session: SavedLabSession; lease: { id: string; until: number } | null };
export type LoadedSession = { session: LabSession; etag?: string; lease: Record["lease"] };
export class LabStoreError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
const durable = () => process.env.VERCEL_ENV === "preview";
const options = () => ({ storeId: process.env.DANCHU_AGENT_BLOB_STORE_ID!, abortSignal: AbortSignal.timeout(10000) });
const pathFor = (id: string) => `${PREFIX}sessions/${id}.json`;

async function read<T>(path: string) {
  const result = await get(path, { ...options(), access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return null;
  if (result.blob.size > 4 * 1024 * 1024) throw new LabStoreError("테스트 기록이 너무 큽니다. 새 테스트를 시작해 주세요.", 413);
  return { value: await new Response(result.stream).json() as T, etag: result.blob.etag };
}

async function write(path: string, value: unknown, etag?: string) {
  const body = JSON.stringify(value);
  if (Buffer.byteLength(body) > 4 * 1024 * 1024) throw new LabStoreError("테스트 기록이 너무 큽니다. 새 테스트를 시작해 주세요.", 413);
  const result = await put(path, body, {
    ...options(), access: "private", addRandomSuffix: false, contentType: "application/json", ttlDays: 1,
    ...(etag ? { allowOverwrite: true, ifMatch: etag } : { allowOverwrite: false }),
  });
  return result.etag;
}

/** One shared counter across serverless instances; resets do not restore the budget. */
export async function reserveLabBudget(kind: "sessions" | "turns") {
  if (!durable()) return;
  const hour = Math.floor(Date.now() / 3600000);
  const path = `${PREFIX}budget/${hour}.json`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await read<{ sessions: number; turns: number }>(path);
    const count = current?.value ?? { sessions: 0, turns: 0 };
    if (count[kind] >= (kind === "sessions" ? 30 : 120)) throw new LabStoreError("이번 시간의 테스트 이용 한도에 도달했습니다. 다음 시간에 다시 시도해 주세요.", 429);
    count[kind] += 1;
    try { await write(path, count, current?.etag); return; }
    catch (error) {
      if (error instanceof LabStoreError) throw error;
      if (!(error instanceof BlobPreconditionFailedError) && !/already exists/i.test(error instanceof Error ? error.message : "")) throw error;
    }
  }
  throw new LabStoreError("다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.", 409);
}

export async function loadLabSession(id: string | undefined): Promise<LoadedSession | null> {
  if (!id || !UUID.test(id)) return null;
  if (!durable()) { const session = getLabSession(id); return session ? { session, lease: null } : null; }
  const saved = await read<Record>(pathFor(id));
  if (!saved) return null;
  if (saved.value.session.id !== id || saved.value.session.version !== 1) throw new LabStoreError("테스트 기록을 확인하지 못했습니다. 새로고침해 주세요.", 503);
  if (saved.value.session.expiresAt <= Date.now()) {
    await del(pathFor(id), { ...options(), ifMatch: saved.etag });
    return null;
  }
  // An interrupted worker's pending tool must not be replayed from an old snapshot.
  if (saved.value.lease && saved.value.lease.until <= Date.now()) {
    await del(pathFor(id), { ...options(), ifMatch: saved.etag });
    return null;
  }
  try {
    return { session: await restoreLabSnapshot(saved.value.session), etag: saved.etag, lease: saved.value.lease };
  } catch {
    // An incompatible SDK snapshot must never revive tools from an old deployment.
    await del(pathFor(id), { ...options(), ifMatch: saved.etag });
    return null;
  }
}

export async function newStoredLabSession(): Promise<LoadedSession> {
  if (!durable()) return { session: createLabSession(), lease: null };
  await reserveLabBudget("sessions");
  const session = createLabSession(false);
  const etag = await write(pathFor(session.id), { session: saveLabSnapshot(session), lease: null });
  return { session, etag, lease: null };
}

/** ETag acquisition prevents two instances from approving or modifying the same case. */
export async function changeLabSession<T>(loaded: LoadedSession, action: (session: LabSession) => Promise<T>, usesModel: boolean): Promise<T> {
  if (loaded.session.busy || loaded.lease) throw new LabStoreError("이전 작업이 진행 중입니다. 완료된 뒤 다시 시도해 주세요.", 409);
  if (!durable()) return action(loaded.session);
  const path = pathFor(loaded.session.id);
  let leaseEtag: string;
  try {
    leaseEtag = await write(path, { session: saveLabSnapshot(loaded.session), lease: { id: randomUUID(), until: Date.now() + 120000 } }, loaded.etag);
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) throw new LabStoreError("업무 상태가 변경됐습니다. 새로고침한 뒤 다시 시도해 주세요.", 409);
    throw error;
  }
  try {
    if (usesModel) await reserveLabBudget("turns");
    return await action(loaded.session);
  } finally {
    // An unsuccessful final write leaves the lease in place: never silently claim persistence.
    await write(path, { session: saveLabSnapshot(loaded.session), lease: null }, leaseEtag);
  }
}

/** Called after session creation; private, expired synthetic records only. */
export async function cleanOldLabRecords() {
  if (!durable()) return;
  const result = await list({ ...options(), prefix: PREFIX, limit: 1000 });
  const old = result.blobs.filter(blob => blob.uploadedAt.getTime() < Date.now() - 4 * 3600000);
  for (const blob of old) await del(blob.url, { ...options(), ifMatch: blob.etag });
}
