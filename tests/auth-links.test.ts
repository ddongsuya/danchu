import { describe, expect, it } from "vitest";
import { authErrorKo, EMAIL_RE, safeNext } from "@/lib/auth-links";

describe("safeNext — 내부 경로만 허용 (오픈 리다이렉트 방지)", () => {
  it("내부 경로는 그대로", () => {
    expect(safeNext("/app/new")).toBe("/app/new");
    expect(safeNext("/app/r/DC-2026-0001?x=1&y=2")).toBe("/app/r/DC-2026-0001?x=1&y=2");
  });
  it("외부 주소·프로토콜 상대 경로·비문자열은 거부", () => {
    expect(safeNext("https://evil.com")).toBe("");
    expect(safeNext("//evil.com")).toBe("");
    expect(safeNext("/\\evil.com")).toBe("");
    expect(safeNext("javascript:alert(1)")).toBe("");
    expect(safeNext(undefined, "/app")).toBe("/app");
    expect(safeNext(123)).toBe("");
  });
});

describe("EMAIL_RE", () => {
  it("기본 형식", () => {
    expect(EMAIL_RE.test("name@company.com")).toBe(true);
    expect(EMAIL_RE.test("no-at.com")).toBe(false);
    expect(EMAIL_RE.test("a b@c.com")).toBe(false);
  });
});

describe("authErrorKo — Supabase 오류를 사용자 문구로", () => {
  it("중복 가입", () => {
    expect(authErrorKo("User already registered")).toMatch(/이미 가입/);
  });
  it("자격 증명 오류", () => {
    expect(authErrorKo("Invalid login credentials")).toMatch(/맞지 않습니다/);
  });
  it("알 수 없는 오류는 일반 문구", () => {
    expect(authErrorKo(undefined)).toMatch(/처리하지 못했습니다/);
  });
});
