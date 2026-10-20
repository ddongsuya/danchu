import { describe, expect, it } from "vitest";
import * as replyWindow from "@/lib/reply-window";
import { beforeDeadline, closeRepliesDue, comparisonOpened, pendingInvites, repliesClosed } from "@/lib/reply-window";

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

describe("비교표 공개 (2026-10-20 결정 1)", () => {
  it("비교표가 열리기 전에는 의뢰자에게 견적을 보여 주지 않는다", () => {
    expect(comparisonOpened({ compared_at: null, selected_quote_id: null })).toBe(false);
    expect(comparisonOpened({ compared_at: null })).toBe(false);
  });
  it("열렸거나 이미 선정한 요청만 견적을 보여 준다", () => {
    expect(comparisonOpened({ compared_at: "2026-10-11T00:00:00Z", selected_quote_id: null })).toBe(true);
    // 0025 전 기한 전 선정으로 이미 선정한 요청
    expect(comparisonOpened({ compared_at: null, selected_quote_id: "q-1" })).toBe(true);
  });
  it("기한 전 선정 확인 단계와 '수정될 수 있음' 표시는 없다", () => {
    const mod = replyWindow as Record<string, unknown>;
    expect(mod.selectionCaution).toBeUndefined();
    expect(mod.quoteRevisable).toBeUndefined();
    expect(mod.REVISABLE_LABEL).toBeUndefined();
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
