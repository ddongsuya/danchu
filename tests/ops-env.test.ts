import { describe, expect, it } from "vitest";
import { isProduction, missingProdEnv } from "@/lib/env";
import { likeExact, orValue } from "@/lib/sql";
import { maskEmail } from "@/lib/observe";

const full: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "k",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a",
  RESEND_API_KEY: "re",
  RESEND_FROM: "단추 <hello@danchu.kr>",
  ADMIN_EMAIL: "ops@danchu.kr",
  CRON_SECRET: "s",
  NEXT_PUBLIC_SITE_URL: "https://danchu.kr",
};

describe("운영 환경변수 검사", () => {
  it("운영이 아니면 아무것도 요구하지 않는다", () => {
    expect(missingProdEnv({ NODE_ENV: "development" })).toEqual([]);
    expect(isProduction({ NODE_ENV: "production", DANCHU_DESIGN_PREVIEW: "1" })).toBe(false);
  });
  it("모두 있으면 빈 목록", () => expect(missingProdEnv(full)).toEqual([]));
  it("대체 이름 중 하나만 있어도 된다", () => {
    const { SUPABASE_URL: _u, ...rest } = full;
    expect(missingProdEnv({ ...rest, NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" })).toEqual([]);
    expect(missingProdEnv(rest)).toEqual(["SUPABASE_URL"]);
  });
  it("빈 문자열은 없는 것으로 본다", () => {
    expect(missingProdEnv({ ...full, CRON_SECRET: "  ", ADMIN_EMAIL: "" })).toEqual(["ADMIN_EMAIL", "CRON_SECRET"]);
  });
});

describe("PostgREST 필터 값", () => {
  it("ilike 와일드카드를 이스케이프한다", () => {
    expect(likeExact("a_c%@corp.com")).toBe("a\\_c\\%@corp.com");
  });
  it("or() 안의 값은 따옴표로 감싼다", () => {
    expect(orValue("x,y(z)")).toBe('"x,y(z)"');
    expect(orValue('a"b')).toBe('"a\\"b"');
  });
});

describe("로그 마스킹", () => {
  it("이메일 앞 두 글자와 도메인만 남긴다", () => {
    expect(maskEmail("hello@danchu.kr")).toBe("he***@danchu.kr");
    expect(maskEmail("nope")).toBe("***");
  });
});
