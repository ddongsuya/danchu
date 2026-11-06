import { describe, expect, it } from "vitest";
import { EARLY_DONE_SMS, earlyOpenSms, earlyPhone, parseEarly } from "@/lib/early";
import { daysToPilot, inPrereg, PREREG_EXEMPT_BEFORE, preregActive, preregAllowedPath } from "@/lib/prereg";

const bytes = (s: string) => Array.from(s).reduce((n, c) => n + (c.charCodeAt(0) > 127 ? 2 : 1), 0);

describe("사전예약 입력 (parseEarly)", () => {
  const req = { role: "req", name: "홍길동", phone: "010-1234-5678", email: "A@B.com", orgType: "제약·바이오", kinds: ["Tox", "PK"], timing: "6개월 안", yearly: "3~5건", quoteCount: "2~3곳", agree: true };
  const cro = { role: "cro", name: "김담당", phone: "01098765432", email: "c@d.kr", org: "예시 기관", kinds: ["PD"], glp: "있어요", monthly: "10~30건", agree: true, adAgree: true };

  it("의뢰자: 휴대폰은 숫자만, 이메일은 소문자로 저장한다", () => {
    const r = parseEarly(req);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.phone).toBe("01012345678");
    expect(r.value.email).toBe("a@b.com");
    expect(r.value.org).toBeNull();
    expect(r.value.glp).toBeNull();
    expect(r.value.adAgree).toBe(false);
  });
  it("기관: 기관명·GLP·월 견적서 수가 필요하다", () => {
    expect(parseEarly(cro).ok).toBe(true);
    expect(parseEarly({ ...cro, org: "" }).ok).toBe(false);
    expect(parseEarly({ ...cro, glp: undefined }).ok).toBe(false);
    expect(parseEarly({ ...cro, monthly: "아무거나" }).ok).toBe(false);
  });
  it("이름·휴대폰·동의가 없으면 받지 않는다", () => {
    expect(parseEarly({ ...req, name: " " }).ok).toBe(false);
    expect(parseEarly({ ...req, phone: "02-123-4567" }).ok).toBe(false);
    expect(parseEarly({ ...req, agree: false }).ok).toBe(false);
    expect(parseEarly({ ...req, yearly: null }).ok).toBe(false);
    expect(parseEarly({ ...req, kinds: [] }).ok).toBe(false);
  });
  it("휴대폰 번호 정리", () => {
    expect(earlyPhone("+82 10-1234-5678")).toBe("01012345678");
    expect(earlyPhone("1234")).toBeNull();
  });
});

describe("사전예약 문자", () => {
  it("예약 완료 문자는 장문 한도(2,000바이트) 안이고 사이트 주소로 끝난다", () => {
    expect(bytes(`[단추] ${EARLY_DONE_SMS}`)).toBeLessThanOrEqual(2000);
    expect(EARLY_DONE_SMS.endsWith("danchu.kr")).toBe(true);
  });
  it("시범 운영 문자는 갈래마다 다르다", () => {
    expect(earlyOpenSms("req")).not.toBe(earlyOpenSms("cro"));
    expect(earlyOpenSms("req")).toContain("2027년 12월 31일");
  });
});

describe("사전예약 모드 (inPrereg)", () => {
  const now = new Date("2026-12-01T00:00:00+09:00");
  const after = "2026-11-20T00:00:00Z";
  const env = {} as NodeJS.ProcessEnv;

  it("기준 시각 뒤에 만든 계정만 사전예약 모드", () => {
    expect(inPrereg({ role: "requester", email: "a@b.com", created_at: after }, now, env)).toBe(true);
    expect(inPrereg({ role: "cro", email: "a@b.com", created_at: "2026-10-01T00:00:00Z" }, now, env)).toBe(false);
    expect(inPrereg({ role: "requester", email: "a@b.com", created_at: PREREG_EXEMPT_BEFORE }, now, env)).toBe(true);
  });
  it("운영자, 예외 이메일, 만든 시각을 모르는 계정은 막지 않는다", () => {
    expect(inPrereg({ role: "admin", email: "a@b.com", created_at: after }, now, env)).toBe(false);
    expect(inPrereg({ role: "requester", email: "Test@X.com", created_at: after }, now, { PREREG_EXEMPT_EMAILS: "x@y.com, test@x.com" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(inPrereg({ role: "requester", email: "a@b.com", created_at: null }, now, env)).toBe(false);
  });
  it("시범 운영이 시작되면 모두 열린다", () => {
    const pilot = new Date("2027-06-01T00:00:00+09:00");
    expect(preregActive(pilot)).toBe(false);
    expect(preregActive(new Date("2027-05-31T23:59:59+09:00"))).toBe(true);
    expect(inPrereg({ role: "requester", email: "a@b.com", created_at: after }, pilot, env)).toBe(false);
  });
  it("남은 날은 한국 날짜 기준", () => {
    expect(daysToPilot(new Date("2027-05-31T15:00:00Z"))).toBe(0);
    expect(daysToPilot(new Date("2027-05-31T14:59:00Z"))).toBe(1);
    expect(daysToPilot(new Date("2026-11-06T09:00:00+09:00"))).toBe(207);
  });
  it("열리는 화면", () => {
    expect(preregAllowedPath("/app")).toBe(true);
    expect(preregAllowedPath("/app/profile")).toBe(true);
    expect(preregAllowedPath("/cro/org")).toBe(true);
    expect(preregAllowedPath("/app/new")).toBe(false);
    expect(preregAllowedPath("/cro/quotes")).toBe(false);
  });
});
