import { describe, expect, it } from "vitest";
import { beforeDeadline, closeRepliesDue, pendingInvites, quoteRevisable, repliesClosed, REVISABLE_LABEL, selectionCaution } from "@/lib/reply-window";

// 2026-10-10 서울 정오
const NOON = new Date("2026-10-10T12:00:00+09:00").getTime();
const AFTER = new Date("2026-10-11T00:00:01+09:00").getTime();

describe("회신 기한과 마감", () => {
  it("기한 당일 자정까지는 기한 전이다", () => {
    expect(beforeDeadline("2026-10-10", NOON)).toBe(true);
    expect(beforeDeadline("2026-10-10", AFTER)).toBe(false);
    expect(beforeDeadline(null, NOON)).toBe(false);
  });
  it("회신 마감(compared_at)·선정·종료면 닫혀 있다", () => {
    expect(repliesClosed({ status: "quoted", compared_at: null })).toBe(false);
    expect(repliesClosed({ status: "compared", compared_at: "2026-10-11T00:00:00Z" })).toBe(true);
    expect(repliesClosed({ status: "selected", compared_at: null })).toBe(true);
    expect(repliesClosed({ status: "cancelled", compared_at: null })).toBe(true);
  });
  it("cron 은 기한이 지난 열린 요청만 마감한다", () => {
    const base = { compared_at: null, reply_by: "2026-10-10", status: "quoted" };
    expect(closeRepliesDue(base, "2026-10-11")).toBe(true);
    expect(closeRepliesDue(base, "2026-10-10")).toBe(false);
    expect(closeRepliesDue({ ...base, compared_at: "2026-10-11T00:00:00Z" }, "2026-10-12")).toBe(false);
    expect(closeRepliesDue({ ...base, status: "selected" }, "2026-10-12")).toBe(false);
    expect(closeRepliesDue({ ...base, reply_by: null }, "2026-10-12")).toBe(false);
  });
});

describe("실시간 비교표", () => {
  const open = { status: "quoted", compared_at: null };
  it("기한 전 열린 요청의 견적은 수정될 수 있다고 표시한다", () => {
    expect(quoteRevisable(open, "2026-10-10", NOON)).toBe(true);
    expect(quoteRevisable(open, "2026-10-10", AFTER)).toBe(false);
    expect(quoteRevisable({ status: "compared", compared_at: "2026-10-09T00:00:00Z" }, "2026-10-10", NOON)).toBe(false);
    expect(quoteRevisable({ status: "selected", compared_at: null }, "2026-10-10", NOON)).toBe(false);
    expect(REVISABLE_LABEL).toBe("기한 전 (수정될 수 있음)");
  });
  it("미회신은 참여한 기관 중 아직 제출하지 않은 곳만 센다 (0023)", () => {
    const J = "2026-10-02T00:00:00Z";
    expect(pendingInvites([
      { status: "sent" }, // 참여 결정 전: 세지 않는다
      { status: "sent", joined_at: J }, // 참여, 작성 전
      { status: "draft", joined_at: J }, // 작성 중
      { status: "submitted", joined_at: J },
      { status: "declined", joined_at: J, withdrawn_at: J }, // 철회
      { status: "declined" }, // 불참
      { status: "expired", joined_at: J },
      { status: "sent", joined_at: J, revoked_at: J }, // 취소
    ])).toBe(2);
    expect(pendingInvites([{ status: "sent" }, { status: "sent" }])).toBe(0);
  });
});

describe("선정 전 확인 단계", () => {
  const rfq = { status: "quoted", compared_at: null, reply_by: "2026-10-10" };
  const invites = [{ status: "submitted", joined_at: "2026-10-02T00:00:00Z" }, { status: "sent", joined_at: "2026-10-02T00:00:00Z" }];
  it("기한 전이거나 미회신 기관이 있으면 확인한다", () => {
    expect(selectionCaution(rfq, invites, NOON)).toEqual({ needed: true, early: true, pending: 1, replyBy: "2026-10-10" });
    expect(selectionCaution(rfq, [{ status: "submitted" }], AFTER)).toEqual({ needed: false, early: false, pending: 0, replyBy: "2026-10-10" });
    expect(selectionCaution(rfq, invites, AFTER).needed).toBe(true);
  });
  it("참여 결정 전 안내만 남았으면 미회신이 아니다", () => {
    expect(selectionCaution(rfq, [{ status: "submitted", joined_at: "2026-10-02T00:00:00Z" }, { status: "sent" }], AFTER)).toEqual({ needed: false, early: false, pending: 0, replyBy: "2026-10-10" });
  });
  it("회신이 마감된 뒤에는 확인하지 않는다", () => {
    expect(selectionCaution({ ...rfq, status: "compared", compared_at: "2026-10-11T00:00:00Z" }, invites, NOON).needed).toBe(false);
  });
});
