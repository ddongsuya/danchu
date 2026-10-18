import { describe, expect, it } from "vitest";
import { orderByTurn } from "@/lib/distribute";
import { closedMessage } from "@/lib/quote-load";
import { isPendingToken, newPendingToken } from "@/lib/rfq-pending";
import { cleanFiles, prepareValues } from "@/lib/rfq-create";
import { INVITE_LABEL, STAGES } from "@/lib/status";

describe("전달 순서", () => {
  const orgs = [
    { id: "a", name: "가나 연구소" },
    { id: "b", name: "다라 연구소" },
    { id: "c", name: "마바 연구소" },
  ];
  it("최근 30일에 덜 받은 기관부터, 같으면 마지막으로 받은 지 오래된 기관부터", () => {
    const recent = [
      { cro_org_id: "a", sent_at: "2026-10-10T00:00:00Z" },
      { cro_org_id: "a", sent_at: "2026-10-12T00:00:00Z" },
      { cro_org_id: "b", sent_at: "2026-10-11T00:00:00Z" },
      { cro_org_id: "c", sent_at: "2026-10-01T00:00:00Z" },
    ];
    expect(orderByTurn(orgs, recent).map((o) => o.id)).toEqual(["c", "b", "a"]);
  });
  it("아무도 받지 않았으면 이름 순", () => {
    expect(orderByTurn([...orgs].reverse(), []).map((o) => o.id)).toEqual(["a", "b", "c"]);
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
    expect(INVITE_LABEL.expired).toBe("취소됨");
    expect(STAGES.map((s) => s.label)).toContain("비교표 열림");
    for (const s of STAGES) expect(`${s.label}${s.desc}`).not.toMatch(/[—–]/);
  });
});
