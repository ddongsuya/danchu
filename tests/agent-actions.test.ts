import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * 에이전트 액션 등록부 (lib/agent-actions.ts, 2026-11-19 기관 비서 기능 지도 1~3단계)
 * - 목록: 역할·요금제별, 비서 도구는 읽기·바로 실행만, 금액·연락처 칸 없음
 * - 실행: 역할·범위·사람만 검사, 바로 실행은 실행 기록과 되돌리기 정보를 남긴다
 * - 되돌리기: 시킨 사람만, 7일 안, 그 뒤 바뀌지 않았을 때만
 * - 브리핑: 오늘 화면과 같은 계산, 금액·이메일·전화 없음
 */

type R = Record<string, unknown>;
const fx = vi.hoisted(() => ({
  tables: {} as Record<string, R[]>,
  crmCalls: [] as { method: string; kind: string; body: R }[],
  crmReply: null as null | ((m: string, kind: string, b: R) => { status: number; body: R }),
  seq: 0,
}));

// 작은 메모리 Supabase: from(t).select/insert/update/delete + eq/is/not/lt/in + single/maybeSingle
vi.mock("@/lib/supabase", () => {
  const q = (table: string) => {
    let rows = () => (fx.tables[table] ??= []);
    const filters: ((r: R) => boolean)[] = [];
    let op: "select" | "update" | "delete" | "insert" = "select";
    let patch: R | null = null;
    let inserted: R[] = [];
    const one = (xs: R[]) => (xs[0] ? { ...xs[0] } : null);
    const matched = () => rows().filter((r) => filters.every((f) => f(r)));
    const run = () => {
      if (op === "update") {
        const m = matched();
        for (const r of m) Object.assign(r, patch, { updated_at: `t${++fx.seq}` });
        return m;
      }
      if (op === "delete") {
        const m = matched();
        fx.tables[table] = rows().filter((r) => !m.includes(r));
        return m;
      }
      if (op === "insert") return inserted;
      return matched();
    };
    const b: R = {
      select: () => b,
      insert: (v: R) => {
        op = "insert";
        inserted = [{ id: `00000000-0000-4000-8000-${String(++fx.seq).padStart(12, "0")}`, created_at: new Date().toISOString(), undone_at: null, ...v }];
        rows().push(...inserted);
        return b;
      },
      update: (v: R) => ((op = "update"), (patch = v), b),
      delete: () => ((op = "delete"), b),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), b),
      not: (k: string, _o: string, v: unknown) => (filters.push((r) => (r[k] ?? null) !== v), b),
      lt: (k: string, v: string) => (filters.push((r) => String(r[k]) < v), b),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), b),
      order: () => b,
      limit: () => b,
      // 실제 DB 처럼 읽을 때마다 새 객체
      maybeSingle: async () => ({ data: one(run()), error: null }),
      single: async () => ({ data: one(run()), error: null }),
      then: (ok: (v: { data: R[]; error: null }) => unknown) => Promise.resolve({ data: run(), error: null }).then(ok),
    };
    void rows;
    rows = () => (fx.tables[table] ??= []);
    return b;
  };
  return { getSupabaseAdmin: () => ({ from: q, rpc: async () => ({ data: null, error: null }) }) };
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, getAll: () => [] }) }));
vi.mock("@/lib/supabase-server", () => ({ createSessionClient: async () => null }));
// 웹 CRM 쓰기는 가짜로: 테이블에 직접 넣고 고친다(검증은 웹 라우트 테스트가 본다)
vi.mock("@/app/api/cro/crm/[kind]/route", () => {
  const handle = (method: string) => async (req: Request, ctx: { params: Promise<{ kind: string }> }) => {
    const kind = (await ctx.params).kind;
    const body = (await req.json()) as R;
    fx.crmCalls.push({ method, kind, body });
    const custom = fx.crmReply?.(method, kind, body);
    if (custom) return Response.json(custom.body, { status: custom.status });
    const t = `cro_crm_${kind === "move" ? "deals" : kind}`;
    const rows = (fx.tables[t] ??= []);
    if (method === "POST" && kind !== "move") {
      const id = `00000000-0000-4000-8000-${String(++fx.seq).padStart(12, "0")}`;
      rows.push({ id, org_id: ORG, ...body, updated_at: `t${++fx.seq}` });
      return Response.json({ ok: true, id });
    }
    const row = rows.find((r) => r.id === body.id);
    if (!row) return Response.json({ error: "없음" }, { status: 404 });
    const { id: _id, ...rest } = body;
    Object.assign(row, rest, { updated_at: `t${++fx.seq}` });
    return Response.json({ ok: true, id: row.id });
  };
  return { POST: handle("POST"), PATCH: handle("PATCH"), DELETE: handle("DELETE") };
});

const ORG = "11111111-1111-4111-8111-111111111111";
const ME = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

import { AGENT_ACTIONS, catalogFor, changedBefore, findAction, runAgentAction, undoAgentAction, undoBlock } from "@/lib/agent-actions";
import { buildBrief, reportRange } from "@/lib/agent-brief";
import type { AgentSession } from "@/lib/agent-api";
import type { CrmData } from "@/lib/crm";

const cro = (userId = ME) => ({ userId, email: "a@lab.test", role: "cro", profile: { id: userId, role: "cro", cro_org_id: ORG }, org: { id: ORG, name: "가람랩", status: "approved", plan: "pro" }, pendingOrg: null }) as unknown as AgentSession;
const requester = { userId: ME, email: "r@x.test", role: "requester", profile: { id: ME, role: "requester" }, org: null, pendingOrg: null } as unknown as AgentSession;
const REQ = new Request("https://danchu.example/api/agent/act");

beforeEach(() => {
  fx.tables = {};
  fx.crmCalls = [];
  fx.crmReply = null;
});

describe("액션 목록", () => {
  it("역할마다 이름이 겹치지 않고, 사람만 하는 것 말고는 모두 실행 함수가 있다", () => {
    for (const role of ["requester", "cro"] as const) {
      const names = AGENT_ACTIONS.filter((a) => a.role === role).map((a) => a.name);
      expect(new Set(names).size).toBe(names.length);
    }
    for (const a of AGENT_ACTIONS) expect(!!a.run).toBe(a.level !== "human");
  });

  it("이미 배포된 에이전트가 부르던 동작이 모두 있다", () => {
    const old = {
      requester: ["create", "ask", "answer", "select", "detail", "contract_confirm", "contract_result"],
      cro: ["join", "decline", "ask", "answer", "quote_draft", "quote_upload", "quote_submit", "detail_reply", "contract_report", "crm_activity"],
    } as const;
    for (const role of ["requester", "cro"] as const) for (const n of old[role]) expect(findAction(role, n), `${role}.${n}`).not.toBeNull();
  });

  it("기관 밖으로 나가는 일은 모두 확인 후 실행", () => {
    for (const n of ["create", "ask", "answer", "select", "detail", "contract_confirm", "contract_result"]) expect(findAction("requester", n)!.level).toBe("confirm");
    for (const n of ["join", "decline", "ask", "answer", "quote_submit", "detail_reply", "contract_report", "price_book_apply"]) expect(findAction("cro", n)!.level).toBe("confirm");
  });

  it("비서 도구는 읽기·바로 실행만. 금액·이메일·전화 칸이 없고, 참조 칸은 정해진 종류만", () => {
    const tools = AGENT_ACTIONS.filter((a) => a.tool);
    expect(tools.length).toBeGreaterThanOrEqual(8);
    for (const a of tools) {
      expect(["auto", "read"]).toContain(a.level);
      const props = (a.input.properties ?? {}) as Record<string, R>;
      for (const k of Object.keys(props)) expect(k).not.toMatch(/amount|won|price|email|phone|mobile/);
      for (const p of Object.values(props)) if (p["x-ref"]) expect(["deal", "task", "event", "contact", "company", "member"]).toContain(p["x-ref"]);
      expect(a.input.additionalProperties).toBe(false);
    }
  });

  it("목록은 내 역할의 것만, 실행 함수 없이", () => {
    const c = catalogFor(cro());
    expect(c.every((a) => !("run" in a))).toBe(true);
    expect(c.map((a) => a.name)).toEqual(expect.arrayContaining(["brief", "report", "task_create", "deal_move", "quote_submit"]));
    expect(catalogFor(requester).map((a) => a.name)).not.toContain("task_create");
    expect(catalogFor(cro()).find((a) => a.name === "crm_delete")).toMatchObject({ level: "human", tool: false });
    // 2026-11-20: 견적 금액 계산·견적서 만들기는 화면이 부르고(비서 도구 아님), 과거 견적 찾기는 읽기 도구
    expect(catalogFor(cro()).find((a) => a.name === "quote_price")).toMatchObject({ scope: "rfq", level: "read", tool: false });
    expect(catalogFor(cro()).find((a) => a.name === "quote_doc")).toMatchObject({ scope: "rfq", level: "auto", tool: false });
    expect(catalogFor(cro()).find((a) => a.name === "quote_history")).toMatchObject({ scope: "org", level: "read", tool: true });
  });
});

describe("실행", () => {
  it("모르는 동작 400, 다른 역할의 동작 403, 번호 범위가 틀리면 400, 사람만 하는 것 403", async () => {
    expect((await runAgentAction(cro(), REQ, "nope", null, {})).status).toBe(400);
    expect((await runAgentAction(requester, REQ, "task_create", null, { title: "x" })).status).toBe(403);
    expect((await runAgentAction(cro(), REQ, "task_create", "DC-2026-0001", { title: "x" })).status).toBe(400);
    expect((await runAgentAction(cro(), REQ, "join", null, {})).status).toBe(400);
    expect(await runAgentAction(cro(), REQ, "crm_delete", null, {})).toMatchObject({ status: 403, body: { error: "human_only" } });
  });

  it("할 일 만들기: 웹 처리로 만들고 실행 기록에 '지우기로 되돌림'을 남긴다. 담당자가 없으면 시킨 사람", async () => {
    const r = await runAgentAction(cro(), REQ, "task_create", null, { title: "가람 후속 연락", due_on: "2026-11-20" });
    expect(r.status).toBe(200);
    expect(fx.crmCalls[0]).toMatchObject({ method: "POST", kind: "tasks", body: { title: "가람 후속 연락", assignee: ME } });
    const log = fx.tables.agent_action_log![0]!;
    expect(log).toMatchObject({ user_id: ME, org_id: ORG, action: "task_create", level: "auto", target_kind: "tasks", target_id: r.body.id, undo: "delete", before: null, status: 200 });
    expect(r).toMatchObject({ logId: log.id, undoable: true });
  });

  it("고치기: 바뀐 칸의 이전 값만 남기고, 되돌리면 그 값으로 돌아간다", async () => {
    fx.tables.cro_crm_tasks = [{ id: "44444444-4444-4444-8444-444444444444", org_id: ORG, title: "자료 보내기", due_on: "2026-11-20", assignee: ME, updated_at: "t0" }];
    const r = await runAgentAction(cro(), REQ, "task_update", null, { id: "44444444-4444-4444-8444-444444444444", due_on: "2026-11-25" });
    expect(r.undoable).toBe(true);
    expect(fx.tables.agent_action_log![0]).toMatchObject({ undo: "patch", before: { due_on: "2026-11-20" } });
    expect(await undoAgentAction(cro(), r.logId!)).toEqual({ ok: true });
    expect(fx.tables.cro_crm_tasks![0]).toMatchObject({ due_on: "2026-11-20", title: "자료 보내기" });
    expect(await undoAgentAction(cro(), r.logId!)).toEqual({ ok: false, error: "already_undone" });
  });

  it("다른 사람은 되돌리지 못하고, 그 뒤 사람이 고쳤으면 되돌리지 않는다", async () => {
    const r = await runAgentAction(cro(), REQ, "task_create", null, { title: "보고서 초안" });
    expect(await undoAgentAction(cro(OTHER), r.logId!)).toEqual({ ok: false, error: "not_found" });
    const row = fx.tables.cro_crm_tasks!.find((x) => x.id === r.body.id)!;
    row.updated_at = "사람이 고침";
    expect(await undoAgentAction(cro(), r.logId!)).toEqual({ ok: false, error: "changed" });
    expect(fx.tables.cro_crm_tasks!.some((x) => x.id === r.body.id)).toBe(true);
  });

  it("안건 단계: 금액 칸은 웹으로 넘기지 않고, 되돌리면 이전 단계와 이력 한 줄", async () => {
    fx.tables.cro_crm_deals = [{ id: "55555555-5555-4555-8555-555555555555", org_id: ORG, stage: "quote", status: "open", updated_at: "t0" }];
    const r = await runAgentAction(cro(), REQ, "deal_move", null, { id: "55555555-5555-4555-8555-555555555555", stage: "negotiation", won_amount: 999 });
    expect(fx.crmCalls[0]).toMatchObject({ kind: "move", body: { id: "55555555-5555-4555-8555-555555555555", stage: "negotiation" } });
    expect(fx.crmCalls[0]!.body).not.toHaveProperty("won_amount");
    expect(fx.tables.agent_action_log![0]).toMatchObject({ undo: "move", before: { stage: "quote" } });
    expect(await undoAgentAction(cro(), r.logId!)).toEqual({ ok: true });
    expect(fx.tables.cro_crm_deals![0]).toMatchObject({ stage: "quote" });
    expect(fx.tables.cro_crm_deal_history![0]).toMatchObject({ from_stage: "negotiation", to_stage: "quote", created_by: ME });
  });

  it("담당자 추가: 이메일·전화는 넘기지 않는다", async () => {
    await runAgentAction(cro(), REQ, "contact_create", null, { company_id: "66666666-6666-4666-8666-666666666666", name: "박 팀장", email: "p@x.test", phone: "010" });
    expect(fx.crmCalls[0]!.body).toEqual({ company_id: "66666666-6666-4666-8666-666666666666", name: "박 팀장" });
  });

  it("안건 넘기기: 담당자 칸만 넘기고, 되돌리면 이전 담당자", async () => {
    fx.tables.cro_crm_deals = [{ id: "55555555-5555-4555-8555-555555555555", org_id: ORG, stage: "quote", status: "open", owner: ME, updated_at: "t0" }];
    const r = await runAgentAction(cro(), REQ, "deal_assign", null, { id: "55555555-5555-4555-8555-555555555555", owner: OTHER, stage: "contract" });
    expect(fx.crmCalls[0]).toEqual({ method: "PATCH", kind: "deals", body: { id: "55555555-5555-4555-8555-555555555555", owner: OTHER } });
    expect(fx.tables.agent_action_log![0]).toMatchObject({ action: "deal_assign", undo: "patch", before: { owner: ME } });
    expect(await undoAgentAction(cro(), r.logId!)).toEqual({ ok: true });
    expect(fx.tables.cro_crm_deals![0]).toMatchObject({ owner: ME, stage: "quote" });
  });

  it("결재 요청: 결재자에게 [결재] 할 일(내부)로 맡기고, 지우기로 되돌린다", async () => {
    const r = await runAgentAction(cro(), REQ, "approval_request", null, { title: "가람 견적 할인 10%", approver: OTHER, due_on: "2026-11-21", assignee: ME, category: "other" });
    expect(fx.crmCalls[0]).toMatchObject({ method: "POST", kind: "tasks", body: { title: "[결재] 가람 견적 할인 10%", category: "internal", assignee: OTHER, due_on: "2026-11-21" } });
    expect(fx.crmCalls[0]!.body).not.toHaveProperty("approver");
    expect(r).toMatchObject({ status: 200, undoable: true });
  });

  it("웹 처리가 거절하면 기록을 남기지 않는다. 없는 행을 고치려 하면 404", async () => {
    fx.crmReply = () => ({ status: 400, body: { error: "할 일을 적어 주세요." } });
    expect((await runAgentAction(cro(), REQ, "task_create", null, { title: "" })).status).toBe(400);
    expect(fx.tables.agent_action_log ?? []).toHaveLength(0);
    fx.crmReply = null;
    expect((await runAgentAction(cro(), REQ, "task_update", null, { id: "77777777-7777-4777-8777-777777777777", title: "x" })).status).toBe(404);
  });
});

describe("되돌리기 판정", () => {
  const log = { undo: "patch", undone_at: null, created_at: new Date("2026-11-19T00:00:00Z").toISOString(), before: { a: 1 }, after_updated_at: "t1" };
  const now = new Date("2026-11-20T00:00:00Z").getTime();
  it("7일이 지나면 되돌리지 않는다", () => {
    expect(undoBlock(log, { updated_at: "t1" }, now)).toBeNull();
    expect(undoBlock(log, { updated_at: "t1" }, now + 8 * 864e5)).toBe("expired");
  });
  it("지우기 되돌림은 이미 없으면 그대로 끝, 고치기 되돌림은 행이 없으면 바뀐 것으로 본다", () => {
    expect(undoBlock({ ...log, undo: "delete", before: null }, null, now)).toBeNull();
    expect(undoBlock(log, null, now)).toBe("changed");
    expect(undoBlock({ ...log, before: null }, { updated_at: "t1" }, now)).toBe("not_undoable");
  });
  it("바뀐 칸만 이전 값으로 (id·기관·시각 칸은 빼고)", () => {
    expect(changedBefore({ id: "x", org_id: "o", title: "a", due_on: "1", updated_at: "t0" }, { id: "x", org_id: "o", title: "b", due_on: "1", updated_at: "t1" })).toEqual({ title: "a" });
  });
});

describe("브리핑 (3단계: 먼저 챙기기)", () => {
  const NOW = new Date("2026-11-19T09:00:00+09:00").getTime();
  const iso = (s: string) => new Date(`${s}+09:00`).toISOString();
  const base = { org_id: ORG, created_by: ME, created_at: iso("2026-11-01T09:00:00"), updated_at: iso("2026-11-01T09:00:00") };
  const data = {
    ready: true,
    companies: [{ ...base, id: "c1", name: "가람바이오", aliases: [], industry: "", biz_no: "", address: "", website: "", email_domain: "", memo: "", owner: null, source: "manual", first_deal_on: null }],
    contacts: [{ ...base, id: "p1", company_id: "c1", name: "박 팀장", dept: "", title: "팀장", role: null, email: "park@garam.example", phone: "010-1234-5678", mobile: "", memo: "", source: "manual", danchu_key: null }],
    deals: [
      { ...base, id: "d1", company_id: "c1", contact_ids: ["p1"], title: "랫드 4주 독성", kind: "tox", substance: "", submit_to: "", report_lang: "", amount: 48_500_000, expected_on: null, stage: "quote", status: "open", stage_at: iso("2026-11-01T09:00:00"), lost_reason: "", lost_note: "", won_amount: null, closed_at: null, owner: ME, source: "manual", invite_id: null, rfq_no: "", memo: "", import_id: null },
    ],
    history: [],
    events: [{ ...base, id: "e1", company_id: "c1", deal_id: "d1", contact_id: null, quote_doc_id: null, kind: "meeting", title: "가람 미팅", starts_at: iso("2026-11-19T14:00:00"), ends_at: null, all_day: false, mode: "video", location: "", attendee_contacts: [], attendee_members: [], attendees_extra: "", requests: "", remind: false, reminded_at: null, done_at: null }],
    activities: [],
    tasks: [{ ...base, id: "t1", company_id: "c1", deal_id: "d1", contact_id: null, quote_doc_id: null, activity_id: null, title: "견적서 보완", memo: "", category: "material", due_on: "2026-11-18", assignee: ME, done_at: null, done_by: null }],
    quotes: [],
    members: [{ id: ME, name: "임 매니저" }],
  } as unknown as CrmData;

  it("오늘 일정·기한 지난 할 일, 진행 중 안건과 고칠 대상 목록", () => {
    const b = buildBrief({ data, danchu: new Map(), me: ME, now: NOW });
    expect(b.date).toBe("2026-11-19");
    expect(b.today.map((x) => [x.kind, x.title, x.overdue])).toEqual([
      ["task", "견적서 보완", true],
      ["event", "가람 미팅", false],
    ]);
    expect(b.deals[0]).toMatchObject({ id: "d1", company: "가람바이오", stageLabel: "견적", mine: true });
    expect(b.tasks[0]).toMatchObject({ id: "t1", assignee: "임 매니저" });
    expect(b.members).toEqual([{ id: ME, name: "임 매니저", me: true }]);
  });

  it("금액·이메일·전화는 넣지 않는다", () => {
    const text = JSON.stringify(buildBrief({ data, danchu: new Map(), me: ME, now: NOW }));
    expect(text).not.toMatch(/48500000|park@garam|010-1234/);
    expect(text).not.toContain("amount");
  });

  it("보고 기간: 틀리면 이번 주 월요일 ~ 오늘", () => {
    expect(reportRange("2026-11-01", "2026-11-15", NOW)).toEqual({ from: "2026-11-01", to: "2026-11-15" });
    expect(reportRange("bad", null, NOW)).toEqual({ from: "2026-11-16", to: "2026-11-19" });
    expect(reportRange("2025-01-01", "2026-11-19", NOW)).toEqual({ from: "2026-11-16", to: "2026-11-19" });
  });
});
