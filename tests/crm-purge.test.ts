import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CRM_PURGE_DAYS, planCrmPurge } from "@/lib/crm-purge";
import { cronPart, stepInPart } from "@/lib/cron-parts";

const NOW = new Date("2026-12-15T00:00:00Z").getTime();
const ago = (days: number) => new Date(NOW - days * 864e5).toISOString();

describe("담당자가 모두 떠난 기관의 CRM 자료 (0040)", () => {
  it("처음 보면 시각만 적고, 30일이 지나야 지운다", () => {
    const plan = planCrmPurge(
      [
        { id: "has", members_left_at: null },
        { id: "new-empty", members_left_at: null },
        { id: "29d", members_left_at: ago(29) },
        { id: "30d", members_left_at: ago(30) },
        { id: "back", members_left_at: ago(40) },
      ],
      new Set(["has", "back"]),
      NOW,
    );
    expect(plan).toEqual({ mark: ["new-empty"], clear: ["back"], purge: ["30d"] });
  });
  it("30일은 처리방침·기관 이용 조건의 약속과 같다", () => {
    expect(CRM_PURGE_DAYS).toBe(30);
    expect(readFileSync("app/privacy/page.tsx", "utf8")).toContain("기관 등록을 해지하면 30일 뒤 삭제");
    expect(readFileSync("app/terms/cro/page.tsx", "utf8")).toContain("30일을 둔 뒤 지웁니다");
  });
  it("지우는 표는 모두 org_id 로만 지운다", () => {
    const src = readFileSync("lib/crm-purge.ts", "utf8");
    expect(src).toMatch(/from\(t\)\.delete\(\{ count: "exact" \}\)\.eq\("org_id", orgId\)/);
  });
});

describe("예약 작업 두 묶음", () => {
  it("part 가 없으면 전부, flow 와 upkeep 은 겹치지 않는다", () => {
    expect(cronPart("https://danchu.kr/api/cron/daily")).toBeNull();
    expect(cronPart("https://danchu.kr/api/cron/daily?part=flow")).toBe("flow");
    expect(cronPart("https://danchu.kr/api/cron/daily?part=x")).toBeNull();
    const route = readFileSync("app/api/cron/daily/route.ts", "utf8");
    const names = [...route.matchAll(/await run\("([a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(14);
    expect(route).not.toMatch(/await step\("/);
    for (const n of names) {
      expect(stepInPart(n, null)).toBe(true);
      expect(stepInPart(n, "flow")).not.toBe(stepInPart(n, "upkeep"));
    }
    expect(names.filter((n) => stepInPart(n, "upkeep")).sort()).toEqual(["crm-purge", "crm-reminders", "digest", "early-open-sms", "pending-cleanup", "retention"]);
  });
  it("vercel.json 이 두 묶음을 따로 부른다", () => {
    const v = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(v.crons.map((c) => c.path)).toEqual(["/api/cron/daily?part=flow", "/api/cron/daily?part=upkeep"]);
  });
});
