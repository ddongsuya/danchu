import { describe, expect, it } from "vitest";
import { dotsOf, funnel, homeTotals, noJoinPastDue, rowLine } from "@/lib/request-story";
import { availOf, differingRows, range, topCategoryShare, unavailableEverywhere, widestItem } from "@/lib/compare-report";
import { noteFor, notesFor } from "@/lib/test-notes";

const md = (d: string) => d.slice(5);

describe("funnel (요청 이야기 합계)", () => {
  it("취소한 안내는 빼고, 참여 안 함과 아직 안 정함은 한 숫자로 묶는다", () => {
    const f = funnel([
      { status: "submitted", joined_at: "x" },
      { status: "draft", joined_at: "x" },
      { status: "sent", joined_at: null, opened_at: "x" },
      { status: "declined", joined_at: null },
      { status: "sent", joined_at: null },
      { status: "sent", joined_at: null, revoked_at: "x" },
    ]);
    expect(f).toEqual({ sent: 5, opened: 4, joined: 2, submitted: 1, rest: 3 });
  });
  it("철회한 기관은 참여에서 빠진다", () => {
    expect(funnel([{ status: "sent", joined_at: "x", withdrawn_at: "y" }]).joined).toBe(0);
  });
  it("점은 제출, 참여, 그 밖 순서다", () => {
    expect(dotsOf({ sent: 4, joined: 2, submitted: 1 })).toEqual(["f", "h", "w", "w"]);
  });
});

describe("홈 요약과 목록 줄", () => {
  const base = { compared_at: null, selected_quote_id: null, outcome: null, started_at: "x" };
  const list = [
    { ...base, status: "distributed", reply_by: "2026-10-20", sent: 4, joined: 0, submitted: 0 },
    { ...base, status: "compared", compared_at: "2026-10-09", reply_by: "2026-10-08", sent: 5, joined: 3, submitted: 3 },
    { ...base, status: "closed", reply_by: "2026-09-01", sent: 3, joined: 3, submitted: 3 },
  ];
  it("진행 중 요청만 합하고, 열린 보고서를 센다", () => {
    const t = homeTotals(list);
    expect(t.scope).toBe("active");
    expect([t.reqs.length, t.sent, t.joined, t.submitted, t.ready.length]).toEqual([2, 9, 3, 3, 1]);
  });
  it("기한이 지났는데 참여가 없으면 빨간 줄", () => {
    expect(noJoinPastDue(list[0], "2026-10-30")).toBe(true);
    expect(rowLine(list[0], "2026-10-30", md)).toEqual({ text: "참여한 기관 없이 회신 기한이 지났어요", late: true });
    expect(rowLine(list[1], "2026-10-30", md).text).toBe("비교 보고서가 열렸어요 · 견적 3건");
  });
});

describe("비교 보고서 분석", () => {
  const rows = [
    { seq: 1, name: "반복투여 4주", category: "일반독성" },
    { seq: 2, name: "복귀돌연변이(Ames, TG 471)", category: "유전독성" },
    { seq: 3, name: "TK(독성동태)", category: "PK" },
  ];
  const cols = [
    { id: "a", name: "A", total: 120, weeks: 6, items: [{ seq: 1, avail: "가능", amount: 100, weeks: 6 }, { seq: 2, avail: "가능", amount: 20, weeks: 3 }, { seq: 3, avail: "불가", amount: null, weeks: null }] },
    { id: "b", name: "B", total: 170, weeks: 20, final: 22, items: [{ seq: 1, avail: "가능", amount: 150, weeks: 20 }, { seq: 2, avail: "가능", amount: 20, weeks: 3 }, { seq: 3, avail: "불가", amount: null, weeks: null }] },
  ];
  it("범위, 다른 답, 모두 불가, 가장 큰 차이", () => {
    expect(range(cols.map((c) => c.total))).toEqual({ min: 120, max: 170 });
    expect(differingRows(cols, rows).map((d) => d.row.seq)).toEqual([1]);
    expect(unavailableEverywhere(cols, rows).map((r) => r.seq)).toEqual([3]);
    expect(widestItem(cols, rows)?.row.seq).toBe(1);
    expect(topCategoryShare(cols[0], rows)).toEqual({ category: "일반독성", share: 100 / 120 });
    expect(availOf(cols[0], 9)).toBe("회신 없음");
  });
  it("기관이 하나면 다른 답이 없다", () => {
    expect(differingRows([cols[0]], rows)).toEqual([]);
  });
});

describe("시험 설명", () => {
  it("항목 이름으로 설명을 찾고 같은 설명은 묶는다", () => {
    expect(noteFor("소핵 in vivo(랫드)")?.key).toBe("mn-vivo");
    expect(noteFor("소핵 in vitro(TG 487)")?.key).toBe("mn-vitro");
    expect(noteFor("용량결정(DRF) 2주")?.key).toBe("drf");
    expect(noteFor("수태능·초기배발생(Seg. I)")?.key).toBe("fertility");
    expect(noteFor("배·태자발생(Seg. II)")?.key).toBe("efd");
    expect(notesFor(["반복투여 4주", "반복투여 13주", "알 수 없는 항목"]).map((n) => [n.key, n.items.length])).toEqual([["repeat", 2]]);
  });
});

import { croTodo, croTotals, replyProgress } from "@/lib/cro-story";

describe("기관 홈과 회신 진행", () => {
  const NOW = Date.parse("2026-10-30T00:00:00Z");
  const open = "2026-11-30T00:00:00Z";
  const it0 = { id: "a", no: "A", substance: "", tags: [], expiresAt: open, cancelled: false, quoteStatus: null };
  const items = [
    { ...it0, id: "u", replyBy: "2026-11-05", stage: "undecided" as const, rfqStatus: "distributed" },
    { ...it0, id: "d", replyBy: "2026-11-01", stage: "draft" as const, rfqStatus: "quoted" },
    { ...it0, id: "s", replyBy: "2026-10-31", stage: "submitted" as const, rfqStatus: "quoted", quoteStatus: "submitted" },
    { ...it0, id: "x", replyBy: "2026-10-01", stage: "declined" as const, rfqStatus: "distributed" },
  ];
  it("진행 중과 흐름 숫자", () => {
    const t = croTotals(items, NOW);
    expect([t.received, t.joined, t.submitted, t.active.length, t.undecided]).toEqual([4, 2, 1, 3, 1]);
  });
  it("지금 할 일은 기한이 가장 가까운 움직일 안내", () => {
    const t = croTodo(items, [{ no: "B", substance: "", days: 30 }], NOW);
    expect(t?.kind === "invite" && t.item.id).toBe("d");
    expect(croTodo([], [{ no: "B", substance: "", days: 30 }], NOW)?.kind).toBe("award");
  });
  it("불가는 금액 없이도 작성한 것으로 센다", () => {
    const rows = [{ seq: 1, name: "a" }, { seq: 2, name: "b" }, { seq: 3, name: "c" }];
    expect(replyProgress(rows, [{ seq: 1, avail: "가능", amount: "100" }, { seq: 2, avail: "불가", amount: "" }, { seq: 3, avail: "가능", amount: "" }])).toEqual({ total: 3, done: 2, left: ["c"] });
  });
});
