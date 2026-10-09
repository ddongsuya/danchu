import { describe, expect, it } from "vitest";
import { EMAIL_CHANGE_TTL_MS, emailChangeValid, hashEmailChangeToken, newEmailChangeToken } from "@/lib/email-change";
import { buildCsp } from "@/lib/csp";

describe("이메일 변경 토큰", () => {
  it("토큰은 URL 에 안전하고 해시만 비교한다", () => {
    const t = newEmailChangeToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{20,64}$/);
    expect(hashEmailChangeToken(t)).toHaveLength(64);
    expect(hashEmailChangeToken(t)).not.toBe(t);
  });
  it("대기 주소·해시·만료가 모두 맞아야 통과한다", () => {
    const t = newEmailChangeToken();
    const now = Date.now();
    const ok = { pending_email: "a@b.co", pending_email_hash: hashEmailChangeToken(t), pending_email_expires_at: new Date(now + EMAIL_CHANGE_TTL_MS).toISOString() };
    expect(emailChangeValid(ok, t, now)).toBe(true);
    expect(emailChangeValid(ok, newEmailChangeToken(), now)).toBe(false);
    expect(emailChangeValid({ ...ok, pending_email: null }, t, now)).toBe(false);
    expect(emailChangeValid({ ...ok, pending_email_expires_at: new Date(now - 1).toISOString() }, t, now)).toBe(false);
    expect(emailChangeValid(ok, "short", now)).toBe(false);
  });
});

describe("CSP", () => {
  it("운영에서는 eval 을 막고 Supabase·Sentry 연결만 연다", () => {
    const csp = buildCsp({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/" });
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
  });
  it("개발에서는 Next 런타임을 위해 eval 을 허용한다", () => {
    expect(buildCsp({ NODE_ENV: "development" })).toContain("'unsafe-eval'");
  });
});
