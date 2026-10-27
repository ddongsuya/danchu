import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * 선정 무결성·배포 순서·첨부 안내 (2026-10-18 보안 검토 #5·#7·#10·#1, 0022).
 * DB 쪽(조건부 갱신 뒤 선정 유지, 선정 뒤 수정 거절, 견적 판 확인, 동시 선정 1건, 배포 순서, 직접 접근 차단)은
 * tests/db/selection_integrity.sql · security_privileges.sql · shell/*.sh 가 실제 PostgreSQL 로 본다.
 */

type Row = Record<string, unknown>;
type Call = { table: string; op: "select" | "update" | "insert"; payload?: unknown; filters: [string, string, unknown][] };
const fx = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as { table: string; op: string; payload?: unknown; filters: [string, string, unknown][] }[],
  /** 다음 select 에 돌려줄 오류 (표 이름 → 메시지) */
  failSelect: {} as Record<string, string>,
  schema: { data: 27 as unknown, error: null as null | { code?: string; message: string } },
  sendMail: vi.fn(async (_m: unknown) => true),
  notifyUsers: vi.fn(async () => {}),
  logEvent: vi.fn(async () => {}),
  captureError: vi.fn(),
  session: null as null | { userId: string; email: string; profile: { role: string } },
  rfq: null as unknown,
  selectQuote: vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({ ok: true, award_id: "a-1", invite_id: "inv-1", cro_org_id: null, cro_name: "기관" })),
}));

vi.mock("@/lib/supabase", () => {
  const builder = (table: string) => {
    const call: Call = { table, op: "select", filters: [] };
    let head = false;
    let counted = false;
    const match = (r: Row) =>
      call.filters.every(([k, col, v]) =>
        k === "eq" ? r[col] === v : k === "is" ? (r[col] ?? null) === v : k === "in" ? (v as unknown[]).includes(r[col]) : true,
      );
    const run = (): { data: unknown; error: unknown; count?: number } => {
      fx.calls.push(call);
      const rows = fx.tables[table] ?? [];
      if (call.op === "update") {
        const hit = rows.filter(match);
        for (const r of hit) Object.assign(r, call.payload as Row);
        return { data: hit, error: null };
      }
      if (call.op === "insert") {
        const r = { id: `${table}-${rows.length + 1}`, token: `tok-${rows.length + 1}`, ...(call.payload as Row) };
        (fx.tables[table] ??= []).push(r);
        return { data: r, error: null };
      }
      if (fx.failSelect[table]) return { data: null, error: { message: fx.failSelect[table] } };
      const list = rows.filter(match).map((r) => ({ ...r }));
      return { data: head ? null : list, error: null, ...(counted ? { count: list.length } : {}) };
    };
    const b: Record<string, unknown> = {};
    const f = (kind: string) => (col: string, v: unknown) => (call.filters.push([kind, col, v]), b);
    Object.assign(b, {
      select: (_c?: string, o?: { count?: string; head?: boolean }) => {
        if (o?.count) counted = true;
        if (o?.head) head = true;
        return b;
      },
      update: (p: unknown) => ((call.op = "update"), (call.payload = p), b),
      insert: (p: unknown) => ((call.op = "insert"), (call.payload = p), b),
      eq: f("eq"), is: f("is"), in: f("in"), neq: f("neq"), gte: f("gte"), lt: f("lt"),
      order: () => b, limit: () => b,
      single: async () => {
        const r = run();
        return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data };
      },
      maybeSingle: async () => {
        const r = run();
        return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data };
      },
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    });
    return b;
  };
  return {
    getSupabaseAdmin: () => ({
      from: builder,
      rpc: async (fn: string) => (fn === "danchu_schema_version" ? fx.schema : { data: null, error: null }),
    }),
  };
});
vi.mock("@/lib/mail-preferences", () => ({ notificationRecipients: async (to: string[]) => to }));
vi.mock("@/lib/mail", () => ({ mailWrap: (s: string) => s, esc: (s: string) => s, sendMail: fx.sendMail }));
vi.mock("@/lib/notify", () => ({
  logEvent: fx.logEvent,
  notifyUsers: fx.notifyUsers,
  adminUserIds: async () => ["admin-1"],
  adminEmails: () => [],
  operatorReplyTo: () => "hello@danchu.kr",
  siteUrl: () => "https://danchu.kr",
}));
vi.mock("@/lib/observe", () => ({ captureError: fx.captureError, sentryEnabled: () => false, maskEmail: (s: string) => s }));
vi.mock("@/lib/auth", () => ({ sessionOrNull: async () => fx.session }));
vi.mock("@/lib/data", () => ({ getRfqByNo: async () => fx.rfq, ownsRfq: () => true }));
vi.mock("@/lib/rpc", async (orig) => ({ ...(await orig<typeof import("@/lib/rpc")>()), selectQuote: fx.selectQuote }));

import { distributeTo, matchOrgs } from "@/lib/distribute";
import { REQUIRED_SCHEMA_VERSION, SchemaNotReadyError, readSchemaStatus, resetSchemaCheck } from "@/lib/schema-version";
import { POST as selectRoute } from "@/app/api/rfq/[no]/select/route";
import { QUOTE_CHANGED_MESSAGE } from "@/lib/rpc";
import { ATTACHMENT_WARNING, ATTACHMENT_WARNING_TITLE, AttachmentNotice } from "@/components/AttachmentNotice";
import { REQUIRED as SCRIPT_REQUIRED, checkSchema } from "../scripts/check-schema.mjs";

const RFQ_ID = "rfq-1";
const rfqRow = (over: Row = {}) => ({
  id: RFQ_ID, rfq_no: "DC-2026-0200", substance: "X", categories: ["일반독성"], purpose: null, intent: "비교 견적", confidentiality: "일반",
  org_type: "바이오벤처", cro_count: "전체", status: "received", reply_by: null, distributed_at: null, selected_quote_id: null, compared_at: null,
  user_id: null, email: "s@example.test", payload: {}, created_at: "2026-10-18T00:00:00Z", ...over,
});
const org = (i: number) => ({ id: `org-${i}`, name: `기관${i}`, contact_email: `cro${i}@example.test`, categories: ["일반독성"], glp_certs: [], managed: false });

beforeEach(() => {
  fx.tables = { rfq_requests: [rfqRow()], rfq_invites: [], profiles: [], cro_orgs: [], cro_catalog: [] };
  fx.calls = [];
  fx.failSelect = {};
  fx.schema = { data: 27, error: null };
  fx.sendMail.mockReset().mockResolvedValue(true);
  fx.notifyUsers.mockClear();
  fx.logEvent.mockClear();
  fx.captureError.mockClear();
  fx.selectQuote.mockClear();
  resetSchemaCheck();
});

describe("배포가 메일을 기다리는 사이 선정되면 (#5)", () => {
  it("배포를 메일 대기 지점에서 멈춤 → 제출·선정 → 배포 재개: 선정 상태가 그대로 남는다", async () => {
    let release!: () => void;
    let reached!: () => void;
    const atMail = new Promise<void>((r) => (reached = r));
    fx.sendMail.mockImplementation(() => {
      reached();
      return new Promise<boolean>((r) => (release = () => r(true)));
    });
    // 배포 시작: 요청을 received 로 읽어 둔다
    const stale = rfqRow();
    const run = distributeTo(stale as never, [org(1)], "2026-10-30", "admin-1", false, "manual");
    await atMail;

    // 그 사이 기관이 제출하고(quoted) 의뢰자가 선정했다(selected). 운영자는 기한도 바꿨다
    Object.assign(fx.tables.rfq_requests[0], { status: "selected", selected_quote_id: "q-1", reply_by: "2026-11-05" });

    release();
    const res = await run;
    expect(res.sent).toBe(1);
    const now = fx.tables.rfq_requests[0];
    expect(now.status).toBe("selected");
    expect(now.selected_quote_id).toBe("q-1");
    expect(now.reply_by).toBe("2026-11-05"); // 옛 값(비어 있던 기한의 기본값)으로 덮지 않는다
    expect(now.distributed_at).toBeTruthy(); // 처음 배포 시각은 채운다

    // 상태 갱신은 "지금도 received 일 때만" 조건을 단다
    const statusUpdate = fx.calls.find((c) => c.table === "rfq_requests" && c.op === "update" && (c.payload as Row).status === "distributed");
    expect(statusUpdate?.filters).toEqual(expect.arrayContaining([["eq", "status", "received"]]));
    // 기한은 비어 있을 때만 채운다
    const replyUpdate = fx.calls.find((c) => c.table === "rfq_requests" && c.op === "update" && "reply_by" in (c.payload as Row));
    expect(replyUpdate?.filters).toEqual(expect.arrayContaining([["is", "reply_by", null]]));
    // 선정 상태를 지우거나 바꾸는 갱신은 없다
    for (const c of fx.calls.filter((c) => c.table === "rfq_requests" && c.op === "update")) {
      expect(c.payload).not.toHaveProperty("selected_quote_id");
    }
  });

  it("경합이 없으면 received → distributed 로 바꾸고 기한·배포 시각을 채운다", async () => {
    const res = await distributeTo(rfqRow() as never, [org(1), org(2)], "2026-10-30", "admin-1", false, "manual");
    expect(res.sent).toBe(2);
    expect(fx.tables.rfq_requests[0]).toMatchObject({ status: "distributed", reply_by: "2026-10-30" });
    expect(fx.tables.rfq_requests[0].distributed_at).toBeTruthy();
  });

  it("이미 distributed 인 요청에 기관을 더해도 상태·기한을 다시 쓰지 않는다", async () => {
    fx.tables.rfq_requests[0] = rfqRow({ status: "quoted", reply_by: "2026-11-01", distributed_at: "2026-10-10T00:00:00Z" });
    await distributeTo(fx.tables.rfq_requests[0] as never, [org(3)], "2026-10-30", "admin-1", false, "manual");
    expect(fx.calls.filter((c) => c.table === "rfq_requests" && c.op === "update")).toEqual([]);
    expect(fx.tables.rfq_requests[0]).toMatchObject({ status: "quoted", reply_by: "2026-11-01" });
  });

  it("lib/distribute.ts 에 조건 없는 요청 상태 갱신이 남아 있지 않다", () => {
    const src = readFileSync("lib/distribute.ts", "utf8");
    expect(src).not.toMatch(/update\(patch\)\.eq\("id", rfq\.id\);/);
    expect(src).toMatch(/\.eq\("id", rfq\.id\)\.eq\("status", "received"\)/);
  });
});

describe("배포 대상 조회 오류는 '대상 없음'이 아니다 (#10)", () => {
  it("기관 조회가 실패하면 빈 목록이 아니라 오류를 던진다", async () => {
    fx.failSelect.cro_orgs = "permission denied for table cro_orgs";
    await expect(matchOrgs(rfqRow() as never)).rejects.toThrow(/배포 대상 기관을 조회하지 못했습니다/);
  });
  it("카탈로그 조회가 실패해도 오류를 던진다", async () => {
    fx.tables.cro_orgs = [{ ...org(1), status: "approved" }];
    fx.failSelect.cro_catalog = "column cro_catalog.available does not exist";
    await expect(matchOrgs(rfqRow() as never)).rejects.toThrow(/카탈로그를 조회하지 못했습니다/);
  });
  it("정상이면 분야가 맞는 기관을 돌려준다", async () => {
    fx.tables.cro_orgs = [{ ...org(1), status: "approved" }, { ...org(2), status: "approved", categories: ["안전성약리"] }];
    const r = await matchOrgs(rfqRow() as never);
    expect(r.orgs.map((o) => o.id)).toEqual(["org-1"]);
  });
  it("0019~0022 가 없는 DB(판 함수 없음)에서는 기관 조회 전에 멈춘다", async () => {
    fx.schema = { data: null, error: { code: "PGRST202", message: "Could not find the function public.danchu_schema_version without parameters" } };
    fx.tables.cro_orgs = [{ ...org(1), status: "approved" }];
    await expect(matchOrgs(rfqRow() as never)).rejects.toBeInstanceOf(SchemaNotReadyError);
    expect(fx.calls.some((c) => c.table === "cro_orgs")).toBe(false);
  });
  it("판이 모자란 DB 에서는 초대를 하나도 만들지 않고 오류를 던진다", async () => {
    fx.schema = { data: 21, error: null };
    await expect(distributeTo(rfqRow() as never, [org(1)], "2026-10-30", "admin-1")).rejects.toThrow(/21 까지만 적용/);
    expect(fx.calls.some((c) => c.table === "rfq_invites" && c.op === "insert")).toBe(false);
    expect(fx.sendMail).not.toHaveBeenCalled();
  });
  it("readSchemaStatus: 없음·모자람·맞음", async () => {
    fx.schema = { data: null, error: { code: "PGRST202", message: "not found" } };
    expect(await readSchemaStatus()).toMatchObject({ ok: false, reason: "missing" });
    fx.schema = { data: 21, error: null };
    expect(await readSchemaStatus()).toMatchObject({ ok: false, reason: "behind", version: 21 });
    fx.schema = { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } };
    expect(await readSchemaStatus()).toMatchObject({ ok: false, reason: "error" });
    fx.schema = { data: 27, error: null };
    expect(await readSchemaStatus()).toEqual({ ok: true, version: 27, required: 27 });
  });
});

describe("배포 순서 확인 (npm run check:schema)", () => {
  const fake = (status: number, body: string) => (async () => ({ ok: status >= 200 && status < 300, status, text: async () => body })) as unknown as typeof fetch;
  it("판 함수가 없으면 실패하고 적용 순서를 알려 준다", async () => {
    const r = await checkSchema({ url: "https://x.supabase.co", key: "k", fetchImpl: fake(404, JSON.stringify({ code: "PGRST202" })) });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/0019 → 0020 → 0021 → 0022/);
  });
  it("판이 모자라면 실패, 맞으면 통과", async () => {
    expect((await checkSchema({ url: "x.supabase.co", key: "k", fetchImpl: fake(200, "21") })).ok).toBe(false);
    expect(await checkSchema({ url: "x.supabase.co", key: "k", fetchImpl: fake(200, "27") })).toMatchObject({ ok: true, version: 27 });
  });
  it("환경변수가 없으면 실패하고, 주소·키를 출력하지 않는다", async () => {
    const r = await checkSchema({ url: "", key: "" });
    expect(r.ok).toBe(false);
    const leaked = await checkSchema({ url: "https://secret-host.supabase.co", key: "secret-key", fetchImpl: fake(500, "{}") });
    expect(leaked.message).not.toMatch(/secret/);
  });
  it("코드·스크립트·마지막 마이그레이션·SQL 판 함수의 번호가 같다", () => {
    const files = readdirSync("supabase/migrations").filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
    const last = files[files.length - 1];
    const lastNo = Number(last.slice(0, 4));
    expect(REQUIRED_SCHEMA_VERSION).toBe(lastNo);
    expect(SCRIPT_REQUIRED).toBe(lastNo);
    const sql = readFileSync(`supabase/migrations/${last}`, "utf8");
    const m = sql.match(/function public\.danchu_schema_version\(\)[\s\S]*?\$\$\s*select\s+(\d+)\s*\$\$/);
    expect(Number(m?.[1])).toBe(lastNo);
  });
  it("README 에 배포 순서가 있다", () => {
    const md = readFileSync("README.md", "utf8");
    expect(md).toMatch(/### 배포 순서/);
    for (const s of ["쓰기 중지", "0019", "0020", "0021", "0022", "npm run test:db", "npm run check:schema"]) expect(md).toContain(s);
  });
});

describe("선정은 확인 화면이 본 견적 판으로만 (#7)", () => {
  const ctx = { params: Promise.resolve({ no: "DC-2026-0200" }) };
  const QID = "00000000-0000-4000-8000-0000000000c1";
  const req = (body: unknown) => new Request("https://danchu.kr/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  beforeEach(() => {
    fx.session = { userId: "sponsor-1", email: "s@example.test", profile: { role: "requester" } };
    fx.rfq = rfqRow({ status: "quoted", user_id: "sponsor-1", company: "의뢰사", contact_name: "담당", phone: null });
    fx.tables.cro_quotes = [{ id: QID, rfq_id: RFQ_ID, status: "submitted", auto: false, pdf_path: "x.pdf", start_date: "2099-01-01", valid_until: "2099-12-31", revision: 4, invite_id: "inv-1", cro_name: "기관", total_amount: 1 }];
  });
  it("판 없이 보내면(옛 화면) 선정하지 않고 다시 확인하게 한다", async () => {
    const r = await selectRoute(req({ quoteId: QID }), ctx);
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("quote_changed");
    expect(fx.selectQuote).not.toHaveBeenCalled();
  });
  it("그 사이 견적이 바뀌었으면 409 와 '견적이 바뀌었습니다' 안내, 알림·메일 없음", async () => {
    fx.selectQuote.mockResolvedValueOnce({ ok: false, code: "quote_changed" });
    const r = await selectRoute(req({ quoteId: QID, revision: 3 }), ctx);
    expect(r.status).toBe(409);
    const body = await r.json();
    expect(body).toMatchObject({ code: "quote_changed", error: QUOTE_CHANGED_MESSAGE });
    expect(body.error).toMatch(/^견적이 바뀌었습니다/);
    expect(fx.selectQuote).toHaveBeenCalledWith(RFQ_ID, QID, "sponsor-1", 3);
    expect(fx.notifyUsers).not.toHaveBeenCalled();
    expect(fx.logEvent).not.toHaveBeenCalled();
  });
  it("동시 선정에서 진 쪽은 409 already_selected, 알림 없음", async () => {
    fx.selectQuote.mockResolvedValueOnce({ ok: false, code: "already_selected" });
    const r = await selectRoute(req({ quoteId: QID, revision: 4 }), ctx);
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("already_selected");
    expect(fx.notifyUsers).not.toHaveBeenCalled();
  });
  it("상세 화면이 본 판을 선정 화면에 넘기고, 선정 화면은 그 판으로만 선정한다", () => {
    // 상세의 선택 버튼(2곳)이 ?rev= 로 상세에서 본 판을 넘긴다
    expect(readFileSync("app/app/r/[no]/q/[quoteId]/page.tsx", "utf8").match(/select\?rev=\$\{q\.revision\}/g)).toHaveLength(2);
    const page = readFileSync("app/app/r/[no]/q/[quoteId]/select/page.tsx", "utf8");
    // 지금 판이 아니라 상세에서 본 판을 보내고, 다르거나 없으면 폼을 그리지 않는다
    expect(page).toMatch(/revision=\{seenRevision\}/);
    expect(page).toMatch(/!seenRevision \|\| seenRevision !== q\.revision/);
    expect(page).not.toMatch(/revision=\{q\.revision\}/);
    const form = readFileSync("components/SelectCroForm.tsx", "utf8");
    expect(form).toMatch(/JSON\.stringify\(\{ quoteId, revision \}\)/);
    expect(form).toMatch(/quote_changed/);
  });
});

describe("첨부 안내: 일반·CDA 모두 같은 경고 (#1)", () => {
  const html = (cda: boolean) => renderToStaticMarkup(createElement(AttachmentNotice, { cda }));
  it("두 경우 모두 회사 정보 제거 경고가 보인다", () => {
    for (const cda of [false, true]) {
      const h = html(cda);
      expect(h).toContain(ATTACHMENT_WARNING_TITLE);
      expect(h).toContain(ATTACHMENT_WARNING);
      expect(h).toContain("data-attachment-warning");
    }
    // 흐름 안내는 다르고 경고는 같다
    expect(html(false)).not.toEqual(html(true));
    expect(html(true)).toContain("CDA 체결");
  });
  it("경고는 본문·이미지·문서 속성(작성자·회사)과 회사명·연락처를 모두 짚는다", () => {
    for (const s of ["본문", "이미지", "문서 속성", "작성자", "회사", "회사명", "이메일", "전화번호", "지운 뒤"]) expect(ATTACHMENT_WARNING + ATTACHMENT_WARNING_TITLE).toContain(s);
  });
  it("요청서는 기밀 등급과 상관없이 같은 안내 컴포넌트를 쓴다", () => {
    const src = readFileSync("components/NewRequest.tsx", "utf8");
    expect(src).toContain("<AttachmentNotice cda={needsCda(values.confid)} />");
    expect(src).not.toContain("파일 내용 안의 회사명은 가려지지 않으니");
  });
  it("화면 문구에 긴 대시가 없다", () => {
    const src = readFileSync("components/AttachmentNotice.tsx", "utf8") + readFileSync("components/SelectCroForm.tsx", "utf8") + QUOTE_CHANGED_MESSAGE;
    expect(src).not.toMatch(/[–—]/);
  });
});
