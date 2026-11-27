import { describe, expect, it } from "vitest";
import { MAX_TOASTS, TOAST_LONG_MS, TOAST_MS, failureText, toastDuration, toastReducer, type ToastItem } from "@/components/ui/toast-queue";

const t = (id: number, extra: Partial<ToastItem> = {}): ToastItem => ({ id, message: `m${id}`, tone: "status", ...extra });

describe("toastReducer", () => {
  it("adds toasts and keeps only the newest MAX_TOASTS", () => {
    let list: ToastItem[] = [];
    for (let i = 1; i <= MAX_TOASTS + 2; i++) list = toastReducer(list, { type: "add", toast: t(i) });
    expect(list.map((x) => x.id)).toEqual([3, 4, 5]);
  });

  it("marks a toast as leaving without touching others, then removes it", () => {
    const start = [t(1), t(2)];
    const leaving = toastReducer(start, { type: "leave", id: 1 });
    expect(leaving[0].leaving).toBe(true);
    expect(leaving[1].leaving).toBeUndefined();
    expect(start[0].leaving).toBeUndefined();
    expect(toastReducer(leaving, { type: "remove", id: 1 }).map((x) => x.id)).toEqual([2]);
  });

  it("returns the same item when leave is sent twice", () => {
    const once = toastReducer([t(1)], { type: "leave", id: 1 });
    expect(toastReducer(once, { type: "leave", id: 1 })[0]).toBe(once[0]);
  });
});

describe("toastDuration", () => {
  it("is short for a plain result and long for undo or failure", () => {
    expect(toastDuration({ tone: "status" })).toBe(TOAST_MS);
    expect(toastDuration({ tone: "status", action: { label: "실행 취소", onClick: () => {} } })).toBe(TOAST_LONG_MS);
    expect(toastDuration({ tone: "error" })).toBe(TOAST_LONG_MS);
  });
});

describe("failureText", () => {
  it("names timeout and network failures with a recovery step", () => {
    expect(failureText(new DOMException("t", "TimeoutError"), "x")).toContain("30초");
    expect(failureText(new TypeError("Failed to fetch"), "x")).toContain("인터넷 연결");
  });
  it("uses the server message, then the fallback", () => {
    expect(failureText(new Error("권한이 없습니다."), "x")).toBe("권한이 없습니다.");
    expect(failureText("??", "처리하지 못했습니다.")).toBe("처리하지 못했습니다.");
  });
});
