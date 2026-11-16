import { agentError, agentJson, agentGate } from "@/lib/agent-api";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 동의 판: 에이전트 앱의 문구 판(날짜). 형식만 확인하고 판의 뜻은 에이전트 앱이 정한다 */
const VERSION = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 견적 에이전트 이용 동의 (연동 3단계, 0046).
 * GET — 내 동의 기록(철회하지 않은 판들). POST { version } — 이 판에 동의. DELETE { version } — 철회.
 * 사용자는 토큰으로만 정한다. 본문의 계정 값은 받지 않는다.
 */
export async function GET(req: Request) {
  const s = await agentGate(req);
  if (s instanceof Response) return s;
  const sb = getSupabaseAdmin();
  if (!sb) return agentError("unavailable");
  const { data, error } = await sb.from("agent_consents").select("version, agreed_at").eq("user_id", s.userId).is("revoked_at", null).order("agreed_at", { ascending: false });
  if (error) return agentError("unavailable");
  return agentJson({ consents: (data ?? []).map((r) => ({ version: r.version as string, agreedAt: r.agreed_at as string })) });
}

async function versionOf(req: Request): Promise<string | null> {
  const body = (await req.json().catch(() => null)) as { version?: unknown } | null;
  const v = typeof body?.version === "string" ? body.version : "";
  return VERSION.test(v) ? v : null;
}

export async function POST(req: Request) {
  const s = await agentGate(req);
  if (s instanceof Response) return s;
  const version = await versionOf(req);
  if (!version) return agentJson({ error: "bad_request" }, 400);
  const sb = getSupabaseAdmin();
  if (!sb) return agentError("unavailable");
  const { error } = await sb.from("agent_consents").upsert({ user_id: s.userId, version, agreed_at: new Date().toISOString(), revoked_at: null }, { onConflict: "user_id,version" });
  if (error) return agentError("unavailable");
  return agentJson({ consent: { version } });
}

export async function DELETE(req: Request) {
  const s = await agentGate(req);
  if (s instanceof Response) return s;
  const version = await versionOf(req);
  if (!version) return agentJson({ error: "bad_request" }, 400);
  const sb = getSupabaseAdmin();
  if (!sb) return agentError("unavailable");
  const { error } = await sb.from("agent_consents").update({ revoked_at: new Date().toISOString() }).eq("user_id", s.userId).eq("version", version).is("revoked_at", null);
  if (error) return agentError("unavailable");
  return agentJson({ revoked: { version } });
}
