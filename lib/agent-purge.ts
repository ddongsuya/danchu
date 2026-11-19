import { createHmac } from "node:crypto";
import type { Admin } from "./supabase";
import { captureError } from "./observe";

/**
 * 견적 에이전트 서버에 대화·승인 기록 삭제를 요청한다 (0049, 처리방침 3항 "탈퇴하거나 동의를 철회할 때까지").
 *
 * - 요청은 먼저 agent_purge_requests 에 적고(같은 계정·사유의 열린 줄은 하나), 바로 한 번 보낸다.
 *   못 보내면 매일 예약 작업(retryAgentPurges)이 다시 보낸다. 에이전트 쪽 삭제는 여러 번 받아도 같다.
 * - 서명: HMAC-SHA256(AGENT_PURGE_SECRET, `${timestamp}.${본문}`) 16진수. 에이전트 서버가 5분 안의 요청만 받는다.
 *   본문에는 계정 id 와 사유만 넣는다. 이메일·이름은 보내지 않는다.
 * - AGENT_PURGE_SECRET 이 없으면 보내지 않고 대기열에 남긴다(설정 뒤 예약 작업이 보낸다).
 */
export type PurgeReason = "account_deleted" | "consent_revoked";

export const AGENT_SERVER_DEFAULT = "https://danchuai-server.vercel.app";
export const PURGE_PATH = "/internal/danchu/purge";
/** 이 횟수를 넘기면 예약 작업이 더 보내지 않고 운영자 확인을 기다린다 */
export const PURGE_MAX_ATTEMPTS = 20;

export function purgeSignature(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

type Env = Record<string, string | undefined>;
type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number }>;

/** 에이전트 서버에 한 번 보낸다. 성공(2xx)이면 true */
export async function sendAgentPurge(userId: string, reason: PurgeReason, opts: { env?: Env; fetchImpl?: Fetch; now?: () => number } = {}): Promise<{ ok: true } | { ok: false; error: string }> {
  const env = opts.env ?? process.env;
  const secret = (env.AGENT_PURGE_SECRET || "").trim();
  if (!secret) return { ok: false, error: "AGENT_PURGE_SECRET 미설정" };
  const base = (env.AGENT_SERVER_URL || AGENT_SERVER_DEFAULT).replace(/\/+$/, "");
  const body = JSON.stringify({ userId, reason });
  const timestamp = String(Math.floor((opts.now ?? Date.now)() / 1000));
  const f = opts.fetchImpl ?? (fetch as unknown as Fetch);
  try {
    const res = await f(`${base}${PURGE_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-danchu-timestamp": timestamp, "x-danchu-signature": purgeSignature(secret, timestamp, body) },
      body,
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.name : "network" };
  }
}

/** 삭제 요청을 대기열에 적고 바로 한 번 보낸다. 실패해도 예외를 던지지 않는다(탈퇴·철회 자체는 진행) */
export async function requestAgentPurge(sb: Admin, userId: string, reason: PurgeReason, opts: { env?: Env; fetchImpl?: Fetch } = {}): Promise<boolean> {
  const { error: insErr } = await sb.from("agent_purge_requests").insert({ user_id: userId, reason });
  // 23505: 같은 계정·사유의 열린 요청이 이미 있다 → 그 줄을 이어서 보낸다
  if (insErr && insErr.code !== "23505") captureError(insErr, "agent-purge:enqueue", { reason });
  const r = await sendAgentPurge(userId, reason, opts);
  await markAttempt(sb, userId, reason, r);
  return r.ok;
}

async function markAttempt(sb: Admin, userId: string, reason: PurgeReason, r: { ok: true } | { ok: false; error: string }) {
  const { data: row } = await sb.from("agent_purge_requests").select("id, attempts").eq("user_id", userId).eq("reason", reason).is("done_at", null).maybeSingle();
  if (!row) return;
  await sb
    .from("agent_purge_requests")
    .update(r.ok ? { attempts: row.attempts + 1, done_at: new Date().toISOString(), last_error: null } : { attempts: row.attempts + 1, last_error: r.error.slice(0, 200) })
    .eq("id", row.id);
}

/** 매일 예약 작업: 못 보낸 삭제 요청을 다시 보낸다 (한 번에 최대 100건) */
export async function retryAgentPurges(sb: Admin, opts: { env?: Env; fetchImpl?: Fetch } = {}): Promise<{ sent: number; failed: number }> {
  const out = { sent: 0, failed: 0 };
  const { data } = await sb
    .from("agent_purge_requests")
    .select("user_id, reason")
    .is("done_at", null)
    .lt("attempts", PURGE_MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(100);
  for (const r of data ?? []) {
    const res = await sendAgentPurge(r.user_id, r.reason, opts);
    await markAttempt(sb, r.user_id, r.reason, res);
    if (res.ok) out.sent++;
    else out.failed++;
  }
  return out;
}
