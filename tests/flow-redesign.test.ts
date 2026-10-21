import { describe, expect, it } from "vitest";
import { closedMessage } from "@/lib/quote-load";
import { isPendingToken, newPendingToken } from "@/lib/rfq-pending";
import { cleanFiles, prepareValues } from "@/lib/rfq-create";
import { INVITE_LABEL, STAGES } from "@/lib/status";

describe("안내 순서 (참여 선택형, 2026-10-20 결정)", () => {
  it("최근에 덜 받은 기관부터 같은 순번을 두지 않는다. 안내는 맞는 기관 모두에게, 자리는 먼저 참여한 기관이 얻는다", async () => {
    const mod = await import("@/lib/distribute");
    expect("orderByTurn" in mod).toBe(false);
  });
});

describe("닫힌 회신 안내", () => {
  it("이유마다 다른 문구, 대시 없음", () => {
    const reasons = ["selected", "ended", "compared", "invite_cancelled", "org_suspended"] as const;
    const msgs = reasons.map((r) => closedMessage(r));
    expect(new Set(msgs).size).toBe(reasons.length);
    for (const m of [...msgs, closedMessage(null)]) expect(m).not.toMatch(/[—–]/);
    expect(closedMessage("invite_cancelled")).toContain("취소");
  });
});

describe("보내기 직전 가입", () => {
  it("임시 요청서 토큰은 충분히 길고 URL 에 안전하다", () => {
    const t = newPendingToken();
    expect(isPendingToken(t)).toBe(true);
    expect(t).toMatch(/^[\w-]+$/);
    expect(isPendingToken("short")).toBe(false);
    expect(isPendingToken("../../etc/passwd/aaaaaaaaaaaaaaaaaaaa")).toBe(false);
  });
  it("첨부 목록은 이름·크기가 있는 것만, 길이를 자른다", () => {
    expect(cleanFiles([{ name: "a.pdf", size: 10, type: "application/pdf" }, { name: 3 }, null, "x"])).toEqual([{ name: "a.pdf", size: 10, type: "application/pdf" }]);
    expect(cleanFiles([{ name: "x".repeat(300), size: 1 }])[0].name).toHaveLength(200);
  });
  it("첨부 수와 크기를 서버에서 다시 막는다", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ name: `${i}.pdf`, size: 1, type: "" }));
    expect(prepareValues({ replyBy: "2000-01-01" }, [])).toContain("회신 희망일");
    expect(prepareValues({}, many)).not.toBe("");
  });
});

describe("상태 문구", () => {
  it("취소된 초대와 단계 이름", () => {
    // 초대 상태 이름은 참여 선택형(0023) 이름을 쓴다. 취소 안내 문구는 closedMessage("invite_cancelled")
    expect(INVITE_LABEL.expired).toBe("종료");
    expect(INVITE_LABEL.declined).toBe("불참");
    // 참여 선택형이라 "기관 전달" 대신 "참여 안내"
    expect(STAGES.map((s) => s.label)).toEqual(["접수", "참여 안내", "견적 도착", "비교표 공개", "기관 선택", "계약 진행", "계약 완료"]);
    for (const s of STAGES) expect(`${s.label}${s.desc}`).not.toMatch(/[—–]/);
  });
});

describe("단계 이름은 디자인과 같다", () => {
  it("선정 없이 마친 요청은 계약 완료가 아니라 마무리", async () => {
    const { statusLabel, contractConfirmState } = await import("@/lib/status");
    expect(statusLabel("closed")).toBe("계약 완료");
    expect(statusLabel("closed", "보류")).toBe("마무리");
    expect(statusLabel("cancelled", "취소")).toBe("취소");
    const base = { contract_reported_at: "2026-10-01T00:00:00Z", requester_confirmed_at: null, confirmed_auto: false, requester_disputed_at: null, requester_dispute_note: null };
    expect(contractConfirmState({ ...base, contract_reported_at: null })).toBeNull();
    expect(contractConfirmState(base)?.label).toContain("2026-10-08 자동 확정");
    expect(contractConfirmState({ ...base, requester_disputed_at: "x", requester_dispute_note: "금액이 다름" })?.tone).toBe("warn");
    expect(contractConfirmState({ ...base, requester_disputed_at: "x", requester_dispute_note: "금액이 다름" })?.label).toContain("금액이 다름");
    expect(contractConfirmState({ ...base, requester_disputed_at: "x", requester_dispute_note: "금액이 다름" }, { includeNote: false })?.label).not.toContain("금액이 다름");
    expect(contractConfirmState({ ...base, requester_confirmed_at: "x", confirmed_auto: true })?.label).toContain("자동 확정");
    // 0025: 확인 기한 열이 있으면 그 날짜, 운영자 정리 뒤 확정, 정리된 이의는 다시 대기
    expect(contractConfirmState({ ...base, contract_confirm_due_at: "2026-10-12T00:00:00Z" })?.label).toContain("2026-10-12 자동 확정");
    expect(contractConfirmState({ ...base, contract_confirmed_at: "x", contract_confirmed_via: "operator" })?.label).toContain("운영자 확정");
    expect(contractConfirmState({ ...base, requester_disputed_at: "x", requester_dispute_note: "n", dispute_resolved_at: "y" })?.tone).toBe("sf");
  });
});
