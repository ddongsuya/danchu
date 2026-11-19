import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AGENT_SERVER_DEFAULT, PURGE_PATH, purgeSignature, sendAgentPurge } from "@/lib/agent-purge";
import { RETENTION } from "@/lib/retention";
import { readFileSync } from "node:fs";

type Call = { url: string; init: { method: string; headers: Record<string, string>; body: string } };
const recorder = (status: number) => {
  const calls: Call[] = [];
  const f = async (url: string, init: Call["init"]) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status };
  };
  return { calls, f };
};

describe("에이전트 삭제 요청 (0049, 처리방침 3항)", () => {
  it("서명은 timestamp.본문 의 HMAC-SHA256 이다 (에이전트 서버와 같은 규칙)", () => {
    const want = createHmac("sha256", "s3cret").update('1700000000.{"userId":"u","reason":"account_deleted"}').digest("hex");
    expect(purgeSignature("s3cret", "1700000000", '{"userId":"u","reason":"account_deleted"}')).toBe(want);
  });

  it("비밀값이 없으면 보내지 않는다", async () => {
    const r = recorder(200);
    expect(await sendAgentPurge("u1", "account_deleted", { env: {}, fetchImpl: r.f })).toEqual({ ok: false, error: "AGENT_PURGE_SECRET 미설정" });
    expect(r.calls).toHaveLength(0);
  });

  it("계정 id 와 사유만 보내고, 서명 머리글을 붙인다", async () => {
    const r = recorder(200);
    const out = await sendAgentPurge("u1", "consent_revoked", { env: { AGENT_PURGE_SECRET: "k" }, fetchImpl: r.f, now: () => 1_700_000_000_000 });
    expect(out).toEqual({ ok: true });
    const c = r.calls[0]!;
    expect(c.url).toBe(`${AGENT_SERVER_DEFAULT}${PURGE_PATH}`);
    expect(JSON.parse(c.init.body)).toEqual({ userId: "u1", reason: "consent_revoked" });
    expect(c.init.headers["x-danchu-timestamp"]).toBe("1700000000");
    expect(c.init.headers["x-danchu-signature"]).toBe(purgeSignature("k", "1700000000", c.init.body));
  });

  it("주소는 환경 변수로 바꿀 수 있고 끝의 / 는 뗀다", async () => {
    const r = recorder(200);
    await sendAgentPurge("u1", "account_deleted", { env: { AGENT_PURGE_SECRET: "k", AGENT_SERVER_URL: "https://agent.example/" }, fetchImpl: r.f });
    expect(r.calls[0]!.url).toBe("https://agent.example/internal/danchu/purge");
  });

  it("2xx 가 아니면 실패로 돌려준다 (대기열에 남아 다시 보낸다)", async () => {
    const r = recorder(503);
    expect(await sendAgentPurge("u1", "account_deleted", { env: { AGENT_PURGE_SECRET: "k" }, fetchImpl: r.f })).toEqual({ ok: false, error: "HTTP 503" });
  });

  it("동의 기록 보존기간은 처리방침과 같은 3년", () => {
    expect(RETENTION.agentConsentYears).toBe(3);
    expect(readFileSync("app/privacy/page.tsx", "utf8")).toContain("동의를 철회하거나 탈퇴한 날부터 3년");
  });

  it("탈퇴는 계정을 지우기 전에 동의 기록에 철회·탈퇴 시각을 적고 삭제 요청을 대기열에 넣는다", () => {
    const src = readFileSync("lib/account.ts", "utf8");
    const mark = src.indexOf('from("agent_consents").update({ revoked_at');
    const queue = src.indexOf('from("agent_purge_requests").insert');
    const del = src.indexOf("auth.admin.deleteUser");
    expect(mark).toBeGreaterThan(0);
    expect(queue).toBeGreaterThan(mark);
    expect(del).toBeGreaterThan(queue);
  });
});
