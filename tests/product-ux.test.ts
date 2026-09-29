import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confidentialAccess,
  needsCda,
  remainingInvites,
} from "@/lib/request-policy";
import { quoteSelectable } from "@/lib/quote-policy";
import {
  loadDraft,
  saveDraft,
  clearDraft,
  type Draft,
} from "@/components/app/AppState";
import { filled, validateRequired } from "@/lib/rfq-schema";
afterEach(() => vi.unstubAllGlobals());
describe("기밀과 배포 정책", () => {
  it.each([
    "CDA 필요 (단추 표준 CDA)",
    "자체 CDA 사용",
    "알 수 없는 기밀 등급",
  ])("%s은 체결 확인까지 비공개", (value) => {
    expect(needsCda(value)).toBe(true);
    expect(confidentialAccess(value, null)).toBe(false);
    expect(confidentialAccess(value, "2026-09-30T00:00:00Z")).toBe(true);
  });
  it("일반 요청은 별도 체결 없이 공개", () =>
    expect(confidentialAccess("일반")).toBe(true));
  it("기존 초대와 보충 배포도 총 수에 포함", () => {
    expect(remainingInvites("3곳", 2)).toBe(1);
    expect(remainingInvites("3곳", 4)).toBe(0);
    expect(remainingInvites("5곳", 3)).toBe(2);
    expect(remainingInvites("전체", 20)).toBe(Infinity);
  });
});
describe("기관 선정", () => {
  const confirmed = {
    auto: false,
    pdf_path: "quote.pdf",
    start_date: "2026-10-01",
    valid_until: "2026-10-30",
  };
  it("확인된 정식 견적만 선정", () => {
    expect(quoteSelectable(confirmed, "2026-09-30")).toBe(true);
    for (const patch of [
      { auto: true },
      { pdf_path: null },
      { start_date: null },
      { valid_until: "2026-09-29" },
    ])
      expect(quoteSelectable({ ...confirmed, ...patch }, "2026-09-30")).toBe(
        false,
      );
  });
});
describe("계정별 초안과 복구", () => {
  const draft: Draft = {
    version: 2,
    q: 2,
    phase: "edit",
    updatedAt: "2026-09-30",
    values: { substance: "물질 A" },
    files: [{ name: "자료.pdf", size: 100 }],
  };
  it("다른 계정 초안과 이전 소유자 없는 초안을 읽지 않음", () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k),
      setItem: (k: string, v: string) => map.set(k, v),
      removeItem: (k: string) => map.delete(k),
    });
    expect(saveDraft("account-a", draft)).toBe(true);
    map.set("danchu.app.rfqDraft", JSON.stringify(draft));
    expect(loadDraft("account-b")).toBeNull();
    expect(map.has("danchu.app.rfqDraft")).toBe(false);
    expect(loadDraft("account-a")).toEqual(draft);
    clearDraft("account-a");
    expect(loadDraft("account-a")).toBeNull();
  });
  it("브라우저 저장 실패를 성공으로 표시하지 않음", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(saveDraft("a", draft)).toBe(false);
  });
  it("공백 입력과 잘못된 옵션을 거부", () => {
    expect(filled({ substance: "  " }, "substance")).toBe(false);
    expect(
      validateRequired({
        company: "A",
        name: "B",
        email: "a@b.co",
        croCount: "100곳",
        confid: "일반",
      }),
    ).not.toBe("");
  });
});
