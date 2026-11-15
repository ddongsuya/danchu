import { createHash, timingSafeEqual } from "node:crypto";

export const LAB_ACCESS_COOKIE = "danchu-agent-access";

/** A separate invitation protects preview AI calls even if hosting protection changes. */
export function hasLabAccess(token: string | undefined, env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "development") return true;
  const expected = env.DANCHU_AGENT_ACCESS_HASH ?? "";
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[a-f0-9]{64}$/.test(expected)) return false;
  if (!(Date.parse(env.DANCHU_AGENT_ACCESS_EXPIRES_AT ?? "") > Date.now())) return false;
  return timingSafeEqual(createHash("sha256").update(token).digest(), Buffer.from(expected, "hex"));
}
