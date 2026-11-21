import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * 에이전트 요청서 도구의 실행 (2026-11-20 설계안 D1)
 * - request_schema·request_check: 의뢰자 읽기 도구. 검사는 저장하지 않고, 받을 기관은 있음/없음만
 * - create: 판을 보낸 새 앱은 시험 종류가 없으면 items_missing, 옛 판은 schema_outdated, 판 없는 옛 앱은 그대로 접수
 * - 기능 스위치 AGENT_ACTIONS_OFF
 */

const fx = vi.hoisted(() => ({ created: [] as Record<string, unknown>[], orgs: [{ id: "o1", name: "비밀 기관" }] as { id: string; name: string }[] }));

vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: () => null }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, getAll: () => [] }) }));
vi.mock("@/lib/supabase-server", () => ({ createSessionClient: async () => null }));
vi.mock("@/lib/rate-limit", () => ({ rateLimited: async () => false, clientIp: () => "test", TOO_MANY: "too many" }));
vi.mock("@/lib/distribute", async (orig) => ({ ...(await orig<object>()), matchOrgs: async () => ({ orgs: fx.orgs, skipped: [] }) }));
vi.mock("@/lib/agent-act", async (orig) => ({
  ...(await orig<object>()),
  markVia: async () => undefined,
  callAs: async (_s: unknown, _r: unknown, handler: (b: Record<string, unknown>) => Promise<{ status: number; body: Record<string, unknown> }>, _p: unknown, body: Record<string, unknown>) => handler(body),
}));
vi.mock("@/app/api/rfq/route", () => ({ POST: async (b: { payload: Record<string, unknown> }) => (fx.created.push(b.payload), { status: 200, body: { rfqNo: "DC-2026-0101", persisted: true } }) }));
vi.mock("@/app/api/rfq/[no]/start/route", () => ({ POST: async () => ({ status: 200, body: { ok: true } }) }));

import { catalogFor, findAction, runAgentAction } from "@/lib/agent-actions";
import { REQUEST_SCHEMA_VERSION } from "@/lib/agent-request";
import type { AgentSession } from "@/lib/agent-api";

const requester = {
  userId: "11111111-1111-4111-8111-111111111111", email: "r@x.test", role: "requester",
  profile: { id: "11111111-1111-4111-8111-111111111111", role: "requester", company: "테스트제약", name: "홍길동", phone: "010-0000-0000" },
  org: null, pendingOrg: null,
} as unknown as AgentSession;
const REQ = new Request("https://danchu.example/api/agent/act");

const body = (extra: Record<string, unknown> = {}) => ({
  purpose: "허가자료 제출용", intent: "비교 견적", substance: "TST-101", croCount: "3곳", confid: "일반",
  categories: ["일반독성"], "일반독성.items": ["반복투여 4주"], agreePrivacy: true, agreeTerms: true, agreeShare: true,
  ...extra,
});

beforeEach(() => {
  fx.created = [];
  delete process.env.AGENT_ACTIONS_OFF;
  delete process.env.AGENT_REQUEST_STRICT;
});

describe("선정 뒤·질의응답 읽기 (2026-11-21, 앱에서 계약 보고까지)", () => {
  it("의뢰자: 계약 진행·질의응답 읽기, 질의 입력은 웹 라우트와 같은 칸", () => {
    const c = catalogFor(requester);
    expect(c.find((a) => a.name === "contract_status")).toMatchObject({ level: "read", scope: "rfq" });
    expect(c.find((a) => a.name === "qna_view")).toMatchObject({ level: "read", scope: "rfq" });
    const ask = findAction("requester", "ask")!.input as { properties: Record<string, unknown>; required: string[] };
    expect(ask.required).toEqual(["inviteId", "topic", "body"]);
    const answer = findAction("requester", "answer")!.input as { required: string[] };
    expect(answer.required).toEqual(["questionId", "answer", "scope"]);
  });
  it("기관: 계약 진행·질의응답 읽기", () => {
    expect(findAction("cro", "contract_status")).toMatchObject({ level: "read", scope: "rfq" });
    expect(findAction("cro", "qna_view")).toMatchObject({ level: "read", scope: "rfq" });
    expect((findAction("cro", "ask")!.input as { required: string[] }).required).toEqual(["topic", "body"]);
  });
});

describe("요청서 양식·검사 도구", () => {
  it("의뢰자 읽기 도구로 목록에 있다", () => {
    const c = catalogFor(requester);
    expect(c.find((a) => a.name === "request_schema")).toMatchObject({ level: "read", tool: true, scope: "org" });
    expect(c.find((a) => a.name === "request_check")).toMatchObject({ level: "read", tool: true, scope: "org" });
  });

  it("request_schema: 양식과 판", async () => {
    const r = await runAgentAction(requester, REQ, "request_schema", null, {});
    expect(r.status).toBe(200);
    expect(r.body.schemaVersion).toBe(REQUEST_SCHEMA_VERSION);
  });

  it("request_check: 통과하면 받을 기관 있음/없음만, 기관 이름·수는 없다. 저장하지 않는다", async () => {
    const r = await runAgentAction(requester, REQ, "request_check", null, { payload: body() });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, deliverable: true, outdated: false });
    expect(JSON.stringify(r.body)).not.toContain("비밀 기관");
    expect(r.body).not.toHaveProperty("orgs");
    expect(fx.created).toEqual([]);
  });

  it("request_check: 시험 종류가 없으면 items_missing, 받을 기관은 보지 않는다", async () => {
    const r = await runAgentAction(requester, REQ, "request_check", null, { payload: body({ categories: ["유전독성"] }) });
    expect(r.body.ok).toBe(false);
    expect(r.body.deliverable).toBeNull();
    expect(r.body.issues).toEqual([expect.objectContaining({ code: "items_missing", key: "유전독성.items" })]);
  });

  it("request_check: 받을 기관이 없으면 deliverable false", async () => {
    fx.orgs = [];
    const r = await runAgentAction(requester, REQ, "request_check", null, { payload: body() });
    expect(r.body.deliverable).toBe(false);
    fx.orgs = [{ id: "o1", name: "비밀 기관" }];
  });

  it("request_check: 본문이 없으면 400", async () => {
    expect((await runAgentAction(requester, REQ, "request_check", null, {})).status).toBe(400);
  });
});

describe("접수 검사", () => {
  it("새 앱(판 있음): 시험 종류가 없으면 접수하지 않는다", async () => {
    const r = await runAgentAction(requester, REQ, "create", null, { ...body({ categories: ["유전독성"] }), schemaVersion: REQUEST_SCHEMA_VERSION });
    expect(r).toMatchObject({ status: 400, body: { error: "items_missing" } });
    expect(fx.created).toEqual([]);
  });

  it("새 앱: 통과하면 양식에 없는 칸을 빼고, 담당자 칸은 프로필로 접수한다", async () => {
    const r = await runAgentAction(requester, REQ, "create", null, { ...body({ priorStudies: "없음", company: "가짜" }), schemaVersion: REQUEST_SCHEMA_VERSION });
    expect(r.status).toBe(200);
    expect(fx.created[0]).not.toHaveProperty("priorStudies");
    expect(fx.created[0]).not.toHaveProperty("schemaVersion");
    expect(fx.created[0]).toMatchObject({ company: "테스트제약", email: "r@x.test" });
  });

  it("옛 판이면 schema_outdated 와 지금 판", async () => {
    const r = await runAgentAction(requester, REQ, "create", null, { ...body(), schemaVersion: "000000000000" });
    expect(r).toMatchObject({ status: 409, body: { error: "schema_outdated", schemaVersion: REQUEST_SCHEMA_VERSION } });
  });

  it("옛 앱(판 없음): 유예 기간에는 본문 그대로 접수한다", async () => {
    const r = await runAgentAction(requester, REQ, "create", null, body({ categories: ["유전독성"], priorStudies: "없음" }));
    expect(r.status).toBe(200);
    expect(fx.created[0]).toHaveProperty("priorStudies", "없음");
  });

  it("엄격 스위치를 켜면 옛 앱도 막는다", async () => {
    process.env.AGENT_REQUEST_STRICT = "1";
    const r = await runAgentAction(requester, REQ, "create", null, body({ categories: ["유전독성"] }));
    expect(r).toMatchObject({ status: 400, body: { error: "items_missing" } });
  });
});

describe("기능 스위치", () => {
  it("끈 액션은 목록에서 빠지고 실행되지 않는다", async () => {
    process.env.AGENT_ACTIONS_OFF = "request_check, request_schema";
    expect(catalogFor(requester).map((a) => a.name)).not.toContain("request_check");
    expect(findAction("requester", "request_schema")).toBeNull();
    expect((await runAgentAction(requester, REQ, "request_check", null, { payload: body() })).status).toBe(400);
    expect(findAction("requester", "create")).not.toBeNull();
  });
});
