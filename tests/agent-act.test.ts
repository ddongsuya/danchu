import { describe, expect, it, vi } from "vitest";

/* 에이전트 쓰기(lib/agent-act.ts, lib/agent-context.ts): 웹 처리를 그 사용자로 부르고, 기록은 via=agent */
const fx = vi.hoisted(() => ({ updates: [] as Array<{ table: string; set: unknown; col: string; val: string }> }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      update: (set: unknown) => ({
        eq: async (col: string, val: string) => {
          fx.updates.push({ table, set, col, val });
          return { error: null };
        },
      }),
    }),
  }),
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, getAll: () => [] }) }));
vi.mock("@/lib/supabase-server", () => ({ createSessionClient: async () => null }));

import { callAs, markVia } from "@/lib/agent-act";
import { currentVia } from "@/lib/agent-context";
import { getSession, type Session } from "@/lib/auth";
import type { AgentSession } from "@/lib/agent-api";

const S = { userId: "u-1", email: "a@example.test", role: "requester", profile: { id: "u-1", role: "requester" }, org: null, pendingOrg: null } as unknown as AgentSession;

describe("에이전트로 웹 처리 부르기", () => {
  it("처리 안에서는 토큰 세션이 로그인 세션이고 via=agent, 밖에서는 web", async () => {
    let seen: Session | null = null;
    let via = "";
    const handler = async (req: Request, ctx: { params: Promise<{ no: string }> }) => {
      seen = await getSession();
      via = currentVia();
      const body = await req.json();
      return Response.json({ ok: true, no: (await ctx.params).no, body }, { status: 201 });
    };
    const from = new Request("https://danchu.example/api/agent/requests/DC-2026-0001/act", { headers: { "user-agent": "agent-test", authorization: "Bearer secret-token-should-not-pass" } });
    const r = await callAs(S, from, handler, { no: "DC-2026-0001" }, { action: "ask", body: "x" });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ ok: true, no: "DC-2026-0001", body: { action: "ask", body: "x" } });
    expect(seen).toBe(S);
    expect(via).toBe("agent");
    expect(currentVia()).toBe("web");
    expect(await getSession()).toBeNull();
  });

  it("사용자 토큰은 웹 처리로 넘기지 않는다", async () => {
    let auth: string | null = "unset";
    const handler = async (req: Request) => {
      auth = req.headers.get("authorization");
      return Response.json({ ok: true });
    };
    await callAs(S, new Request("https://x.example/", { headers: { authorization: "Bearer abcdefghijklmnopqrstuvwxyz" } }), handler, {}, {});
    expect(auth).toBeNull();
  });

  it("출처 표시는 지정한 줄에만", async () => {
    await markVia("rfq_questions", "id", "q-1");
    expect(fx.updates.at(-1)).toEqual({ table: "rfq_questions", set: { via: "agent" }, col: "id", val: "q-1" });
  });
});
