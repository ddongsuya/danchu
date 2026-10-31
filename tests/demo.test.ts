import { describe, expect, it } from "vitest";
import { demoEnabled, isDemoRole } from "@/lib/demo";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

/** 로그인 없이 보는 미리보기는 운영 배포에서 어떤 설정으로도 켜지면 안 된다 */
describe("demoEnabled", () => {
  it("DANCHU_DEMO_LOGIN=1 이고 운영 배포가 아닐 때만 켜진다", () => {
    expect(demoEnabled(env({ DANCHU_DEMO_LOGIN: "1", VERCEL_ENV: "preview" }))).toBe(true);
    expect(demoEnabled(env({ DANCHU_DEMO_LOGIN: "1" }))).toBe(true);
  });
  it("운영 배포(VERCEL_ENV=production)에서는 설정이 있어도 꺼진다", () => {
    expect(demoEnabled(env({ DANCHU_DEMO_LOGIN: "1", VERCEL_ENV: "production" }))).toBe(false);
  });
  it("설정이 없으면 꺼진다", () => {
    expect(demoEnabled(env({ VERCEL_ENV: "preview" }))).toBe(false);
    expect(demoEnabled(env({ DANCHU_DEMO_LOGIN: "0", VERCEL_ENV: "preview" }))).toBe(false);
  });
});

describe("isDemoRole", () => {
  it("세 역할만 받는다", () => {
    expect(isDemoRole("requester")).toBe(true);
    expect(isDemoRole("cro")).toBe(true);
    expect(isDemoRole("admin")).toBe(true);
    expect(isDemoRole("owner")).toBe(false);
    expect(isDemoRole(undefined)).toBe(false);
  });
});
