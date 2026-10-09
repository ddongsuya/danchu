import { describe, expect, it } from "vitest";
import { anonymizePayload, anonymousEmail, deletionBlockedBy } from "@/lib/account";
import { RETENTION } from "@/lib/retention";

describe("회원 탈퇴 규칙", () => {
  it("운영자는 탈퇴할 수 없다", () => expect(deletionBlockedBy("admin", [])).toBe("admin"));
  it("기관을 선정한 요청이 있으면 막는다", () => {
    expect(deletionBlockedBy("requester", ["closed", "selected"])).toBe("contracting");
    expect(deletionBlockedBy("requester", ["contracting"])).toBe("contracting");
  });
  it("선정 전·종료 요청만 있으면 진행한다", () => {
    expect(deletionBlockedBy("requester", ["received", "compared", "closed", "cancelled"])).toBeNull();
    expect(deletionBlockedBy("cro", [])).toBeNull();
  });
});

describe("요청서 익명화", () => {
  it("담당자 개인정보 키만 지우고 시험 내용은 남긴다", () => {
    const out = anonymizePayload({ company: "회사", name: "홍길동", email: "a@b.co", phone: "010", dept: "개발", substance: "DC-101", categories: ["일반독성"] });
    expect(out).toEqual({ company: "회사", substance: "DC-101", categories: ["일반독성"] });
  });
  it("익명 이메일은 요청별로 다르고 실제 도메인이 아니다", () => {
    const a = anonymousEmail("11111111-2222-3333-4444-555555555555");
    const b = anonymousEmail("99999999-2222-3333-4444-555555555555");
    expect(a).not.toBe(b);
    expect(a.endsWith("@deleted.danchu.kr")).toBe(true);
  });
});

describe("보존기간은 처리방침과 같다", () => {
  it("접속 기록 3개월, 요청 3년", () => {
    expect(RETENTION.accessLogDays).toBe(90);
    expect(RETENTION.requestYears).toBe(3);
  });
});
