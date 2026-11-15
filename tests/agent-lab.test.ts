import { describe, expect, it } from "vitest";
import {
  answerQuestion, askQuestion, comparisonOpen, joinRequest, labEnabled, newLabCase,
  prepareQuote, saveCrmNote, saveRequestDraft, sendRequest, submitQuote, viewFor,
  type RequestDraft,
} from "../lib/agent-lab/domain";
import { createLabSession, resetLabSession, responseFor, runLabTurn } from "../lib/agent-lab/runtime";

const draft: RequestDraft = { title: "혈청 분석 테스트", kind: "other", material: "비공개 검체명", samples: 30, items: ["ALT", "AST", "BUN", "CREA"], deadline: "2026-12-10", note: "참여 후에만 공개할 요청 메모" };
function sentCase() { const state = newLabCase(); saveRequestDraft(state, "requester", draft); sendRequest(state, "requester"); return state; }

describe("dual agent test workflow", () => {
  it("requires an explicit development flag and stays disabled in production", () => {
    expect(labEnabled({ NODE_ENV: "production", DANCHU_AGENT_LAB: "1" })).toBe(false);
    expect(labEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(labEnabled({ NODE_ENV: "development", DANCHU_AGENT_LAB: "1" })).toBe(true);
  });
  it("keeps draft creation separate from request transmission", () => {
    const state = newLabCase(); saveRequestDraft(state, "requester", draft);
    expect(viewFor(state, "requester").draft).toEqual(draft);
    expect(viewFor(state, "cro-a").request).toBeNull();
  });
  it("does not let an institution impersonate the requester", () => {
    const state = newLabCase();
    expect(() => saveRequestDraft(state, "cro-a", draft)).toThrow();
    expect(() => sendRequest(state, "cro-a")).toThrow();
  });
  it("conceals full request fields before participation", () => {
    const state = sentCase();
    const before = JSON.stringify(viewFor(state, "cro-a"));
    expect(before).not.toContain(draft.material);
    expect(before).not.toContain(draft.note);
    joinRequest(state, "cro-a");
    expect(viewFor(state, "cro-a").request).toEqual(draft);
    expect(JSON.stringify(viewFor(state, "cro-b"))).not.toContain(draft.material);
  });
  it("blocks quotation and internal notes before participation", () => {
    const state = sentCase();
    expect(() => prepareQuote(state, "cro-a", "")).toThrow();
    expect(() => saveCrmNote(state, "cro-a", "메모")).toThrow();
    expect(() => askQuestion(state, "cro-a", "질문")).toThrow();
  });
  it("calculates each quote from its own catalogue", () => {
    const state = sentCase(); joinRequest(state, "cro-a"); joinRequest(state, "cro-b");
    expect(prepareQuote(state, "cro-a", "").total).toBe(660000);
    expect(prepareQuote(state, "cro-b", "").total).toBe(600000);
    expect(state.drafts["cro-a"]!.lines[0].amount).toBe(150000);
  });
  it("does not guess unknown prices or permit their submission", () => {
    const state = newLabCase(); saveRequestDraft(state, "requester", { ...draft, items: ["UNKNOWN"] }); sendRequest(state, "requester"); joinRequest(state, "cro-a");
    expect(prepareQuote(state, "cro-a", "").total).toBeNull();
    expect(() => submitQuote(state, "cro-a")).toThrow();
  });
  it("normalizes explicit catalogue labels without guessing unknown tests", () => {
    const state = newLabCase();
    saveRequestDraft(state, "requester", { ...draft, items: ["alt 분석", "AST 검사", "BUN측정", "CREA", "ALT", "ALT 동종효소 분석"] });
    expect(state.draft!.items).toEqual(["ALT", "AST", "BUN", "CREA", "ALT 동종효소 분석"]);
    sendRequest(state, "requester"); joinRequest(state, "cro-a");
    const quote = prepareQuote(state, "cro-a", "");
    expect(quote.lines[0].amount).toBe(150000);
    expect(quote.lines.at(-1)?.unitPrice).toBeNull();
    expect(quote.total).toBeNull();
  });
  it("separates institutional conversations, drafts, and internal notes", () => {
    const state = sentCase(); joinRequest(state, "cro-a");
    prepareQuote(state, "cro-a", "기관 A 초안 전용"); saveCrmNote(state, "cro-a", "내부 비공개 A");
    state.chats["cro-a"].push({ id: "1", from: "agent", text: "기관 A 대화" });
    for (const role of ["requester", "cro-b"] as const) {
      const view = JSON.stringify(viewFor(state, role));
      expect(view).not.toContain("내부 비공개 A"); expect(view).not.toContain("기관 A 초안 전용"); expect(view).not.toContain("기관 A 대화");
    }
  });
  it("shares questions only between their participants", () => {
    const state = sentCase(); joinRequest(state, "cro-a"); joinRequest(state, "cro-b");
    const q = askQuestion(state, "cro-a", "기관 A 전용 질문");
    expect(viewFor(state, "requester").questions).toHaveLength(1);
    expect(viewFor(state, "cro-b").questions).toEqual([]);
    expect(() => answerQuestion(state, "cro-b", q.id, "거짓 답변")).toThrow();
    answerQuestion(state, "requester", q.id, "의뢰자 답변");
    expect(viewFor(state, "cro-a").questions[0].answer).toBe("의뢰자 답변");
  });
  it("blocks submission while an institutional question is unanswered", () => {
    const state = sentCase(); joinRequest(state, "cro-a"); prepareQuote(state, "cro-a", "");
    const q = askQuestion(state, "cro-a", "보관 조건?");
    expect(() => submitQuote(state, "cro-a")).toThrow();
    answerQuestion(state, "requester", q.id, "냉동 검체입니다.");
    submitQuote(state, "cro-a"); expect(state.quotes["cro-a"]).toBeDefined();
  });
  it("opens comparison only after both institutions submit, with no competitor access", () => {
    const state = sentCase(); joinRequest(state, "cro-a"); joinRequest(state, "cro-b");
    prepareQuote(state, "cro-a", ""); submitQuote(state, "cro-a");
    expect(viewFor(state, "requester").comparison).toEqual([]);
    prepareQuote(state, "cro-b", ""); submitQuote(state, "cro-b");
    expect(comparisonOpen(state)).toBe(true);
    expect(viewFor(state, "requester").comparison.map(q => q.total)).toEqual([660000, 600000]);
    expect(viewFor(state, "cro-a").comparison).toEqual([]);
    expect(viewFor(state, "cro-b").comparison).toEqual([]);
  });
  it("rejects duplicate or late changes to submitted records", () => {
    const state = sentCase();
    expect(() => sendRequest(state, "requester")).toThrow();
    expect(() => saveRequestDraft(state, "requester", draft)).toThrow();
    joinRequest(state, "cro-a"); prepareQuote(state, "cro-a", ""); submitQuote(state, "cro-a");
    expect(() => submitQuote(state, "cro-a")).toThrow();
    expect(() => prepareQuote(state, "cro-a", "変更")).toThrow();
  });
  it("rejects invalid calendar dates and unsafe quantities", () => {
    expect(() => saveRequestDraft(newLabCase(), "requester", { ...draft, deadline: "2026-02-30" })).toThrow();
    expect(() => saveRequestDraft(newLabCase(), "requester", { ...draft, samples: -10 })).toThrow();
  });
  it("snapshots cannot mutate the underlying state", () => {
    const state = sentCase(); const view = viewFor(state, "requester");
    view.request!.items!.push("INJECTED"); expect(state.request!.items).not.toContain("INJECTED");
  });
});

describe("test session protection", () => {
  it("keeps cases isolated between browser sessions", () => {
    const a = createLabSession(), b = createLabSession();
    saveRequestDraft(a.state, "requester", draft);
    expect(responseFor(b, "requester").view.draft).toBeNull();
  });
  it("refuses forged approvals before any model request", async () => {
    const session = createLabSession();
    await expect(runLabTurn(session, "requester", { approvalId: "forged", approve: true })).rejects.toThrow("승인 요청");
    expect(session.turns).toBe(0);
  });
  it("refuses concurrent operations and does not reset usage with sample data", async () => {
    const session = createLabSession(); session.busy = true;
    await expect(runLabTurn(session, "requester", { message: "test" })).rejects.toThrow("진행 중");
    expect(() => resetLabSession(session)).toThrow();
    session.busy = false; session.turns = 5; resetLabSession(session);
    expect(session.turns).toBe(5);
  });
});
