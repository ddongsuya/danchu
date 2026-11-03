import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* 문자 알림 (0033) */

const fx = vi.hoisted(() => ({
  profiles: [] as { id: string; phone: string | null; sms_notifications?: boolean }[],
  logs: [] as Record<string, unknown>[],
  dup: false,
}));

vi.mock("@/lib/supabase", () => {
  const from = (table: string) => {
    const b: Record<string, unknown> = {};
    const self = () => b;
    Object.assign(b, {
      select: self, eq: self, limit: async () => ({ data: fx.dup ? [{ id: "x" }] : [], error: null }),
      in: async () => ({ data: fx.profiles, error: null }),
      insert: async (row: Record<string, unknown>) => (fx.logs.push({ table, ...row }), { error: null }),
    });
    return b;
  };
  return { getSupabaseAdmin: () => ({ from }) };
});
vi.mock("@/lib/observe", () => ({ captureError: () => {} }));

import { maskPhone, normalizeMobile, smsBytes, smsUsers, solapiAuth } from "@/lib/sms";

beforeEach(() => {
  fx.profiles = [];
  fx.logs = [];
  fx.dup = false;
  delete process.env.SOLAPI_API_KEY;
  delete process.env.SOLAPI_API_SECRET;
  delete process.env.SMS_SENDER;
  vi.unstubAllGlobals();
});

describe("번호·길이", () => {
  it("휴대전화만 숫자로 (국가번호 82 포함), 유선·잘못된 번호는 null", () => {
    expect(normalizeMobile("010-1234-5678")).toBe("01012345678");
    expect(normalizeMobile("+82 10 1234 5678")).toBe("01012345678");
    expect(normalizeMobile("011-123-4567")).toBe("0111234567");
    expect(normalizeMobile("02-123-4567")).toBeNull();
    expect(normalizeMobile("")).toBeNull();
    expect(normalizeMobile(null)).toBeNull();
  });
  it("기록에는 가린 번호", () => {
    expect(maskPhone("01012345678")).toBe("010-****-5678");
  });
  it("한글 2바이트, 영문·숫자 1바이트", () => {
    expect(smsBytes("단추 ab1")).toBe(8);
  });
  it("솔라피 인증 머리글: HMAC-SHA256(date + salt)", () => {
    const h = solapiAuth("KEY", "SECRET", "2028-01-01T00:00:00.000Z", "abc");
    const sig = createHmac("sha256", "SECRET").update("2028-01-01T00:00:00.000Zabc").digest("hex");
    expect(h).toBe(`HMAC-SHA256 apiKey=KEY, date=2028-01-01T00:00:00.000Z, salt=abc, signature=${sig}`);
  });
});

describe("보내기", () => {
  it("키가 없으면 보내지 않고 skipped 로 남긴다. 휴대전화 없음·문자 끔은 건너뛴다", async () => {
    fx.profiles = [{ id: "a", phone: "010-1111-2222" }, { id: "b", phone: null }, { id: "c", phone: "01033334444", sms_notifications: false }];
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await smsUsers(["a", "b", "c"], { kind: "compare", text: "테스트" })).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fx.logs).toEqual([expect.objectContaining({ table: "sms_log", user_id: "a", phone_masked: "010-****-2222", status: "skipped", reason: "not_configured" })]);
  });
  it("키가 있으면 솔라피로 보내고 sent. 90바이트를 넘으면 LMS", async () => {
    process.env.SOLAPI_API_KEY = "k";
    process.env.SOLAPI_API_SECRET = "s";
    process.env.SMS_SENDER = "010-9999-0000";
    fx.profiles = [{ id: "a", phone: "01011112222" }];
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ messageId: "M1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await smsUsers(["a"], { kind: "selected", text: "가".repeat(50) })).toBe(1);
    const body = JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.message).toMatchObject({ to: "01011112222", from: "01099990000", type: "LMS" });
    expect(body.message.text.startsWith("[단추] ")).toBe(true);
    expect(fx.logs[0]).toMatchObject({ status: "sent", provider_id: "M1" });
  });
  it("같은 알림은 한 번만 (dedupeKey)", async () => {
    process.env.SOLAPI_API_KEY = "k";
    process.env.SOLAPI_API_SECRET = "s";
    process.env.SMS_SENDER = "01099990000";
    fx.profiles = [{ id: "a", phone: "01011112222" }];
    fx.dup = true;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await smsUsers(["a"], { kind: "invite", text: "x", dedupeKey: "invite:1" })).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("실패는 던지지 않고 failed 로 남긴다", async () => {
    process.env.SOLAPI_API_KEY = "k";
    process.env.SOLAPI_API_SECRET = "s";
    process.env.SMS_SENDER = "01099990000";
    fx.profiles = [{ id: "a", phone: "01011112222" }];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ errorCode: "NotEnoughBalance", errorMessage: "잔액 부족" }), { status: 402 })));
    expect(await smsUsers(["a"], { kind: "invoice", text: "x" })).toBe(0);
    expect(fx.logs[0]).toMatchObject({ status: "failed", reason: "NotEnoughBalance 잔액 부족" });
  });
});
