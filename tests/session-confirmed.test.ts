import { beforeEach, describe, expect, it, vi } from "vitest";

/* 공통 세션 검사(lib/auth.ts getSession): 이메일 확인이 끝나지 않은 계정은 세션 쿠키가 있어도 로그인하지 않은 것으로 본다 */
const fx = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }));
vi.mock("@/lib/supabase-server", () => ({ createSessionClient: async () => ({ auth: { getUser: async () => ({ data: { user: fx.user } }) } }) }));
vi.mock("@/lib/supabase", () => {
  const q: Record<string, unknown> = {};
  Object.assign(q, {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data: { id: "u-1", email: "a@example.test", role: "requester", cro_org_id: null, pending_org_id: null } }),
  });
  return { getSupabaseAdmin: () => ({ from: () => q }) };
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));

import { getSession, sessionOrNull, requireSession } from "@/lib/auth";

beforeEach(() => {
  fx.user = null;
});

describe("이메일 미확인 계정", () => {
  it("세션이 있어도 getSession·sessionOrNull 은 null, 보호 화면은 로그인으로 보낸다", async () => {
    fx.user = { id: "u-1", email: "a@example.test", email_confirmed_at: null, user_metadata: {} };
    expect(await getSession()).toBeNull();
    expect(await sessionOrNull()).toBeNull();
    expect(await sessionOrNull("requester")).toBeNull();
    await expect(requireSession("requester")).rejects.toThrow("redirect:/login");
  });
  it("확인된 계정은 세션이 된다", async () => {
    fx.user = { id: "u-1", email: "a@example.test", email_confirmed_at: "2026-10-18T00:00:00Z", user_metadata: {} };
    const s = await getSession();
    expect(s?.userId).toBe("u-1");
  });
});
