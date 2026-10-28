import { describe, expect, it } from "vitest";
import { orderFromKeys, orderToKeys, planSchedule, weekMonday, type ScheduleTask } from "@/lib/schedule";

// 숫자는 계산 확인용 임의 값이다. 어느 기관의 실제 기간도 아니다
const pkg: ScheduleTask[] = [
  { id: "prep", name: "조제물분석", weeks: 3 },
  { id: "drf", name: "용량결정", weeks: 5, after: ["prep"], reportWeeks: 2 },
  { id: "val", name: "분석법 검증", weeks: 2, after: ["drf"] },
  { id: "rep", name: "반복투여", weeks: 11, after: ["val"], reportWeeks: 6, translationWeeks: 3 },
  { id: "ames", name: "복귀돌연변이", weeks: 4, after: ["prep"], reportWeeks: 2 },
];

const row = (p: ReturnType<typeof planSchedule>, id: string) => p.rows.find((r) => r.id === id)!;

describe("일정 계산", () => {
  it("앞 단계가 끝난 주에 시작하고, 최종보고서 주는 순서를 반영한다", () => {
    const p = planSchedule(pkg);
    expect([row(p, "drf").start, row(p, "drf").end]).toEqual([3, 8]);
    expect([row(p, "val").start, row(p, "val").end]).toEqual([8, 10]);
    expect([row(p, "rep").start, row(p, "rep").end]).toEqual([10, 21]);
    expect([row(p, "rep:report").start, row(p, "rep:report").end]).toEqual([21, 27]);
    expect([row(p, "rep:translation").start, row(p, "rep:translation").end]).toEqual([27, 30]);
    expect(p.studyEndWeek).toBe(21);
    expect(p.finalWeek).toBe(30);
    // 지금 회신 화면의 "병렬 수행" 값(가장 긴 항목 11주)보다 훨씬 길다
    expect(p.finalWeek).toBeGreaterThan(Math.max(...pkg.map((t) => t.weeks ?? 0)));
  });

  it("최종보고서를 정하는 경로만 표시한다", () => {
    const p = planSchedule(pkg);
    const crit = p.rows.filter((r) => r.critical).map((r) => r.id).sort();
    expect(crit).toEqual(["drf", "prep", "rep", "rep:report", "rep:translation", "val"].sort());
    expect(row(p, "ames").critical).toBe(false);
    expect(row(p, "drf:report").critical).toBe(false);
  });

  it("앞 단계가 없으면 0주에 병렬로 시작한다", () => {
    const p = planSchedule([{ id: "a", name: "A", weeks: 4 }, { id: "b", name: "B", weeks: 6 }]);
    expect(row(p, "a").start).toBe(0);
    expect(row(p, "b").start).toBe(0);
    expect(p.finalWeek).toBe(6);
  });

  it("고정 시작 주는 앞 단계보다 우선한다", () => {
    const p = planSchedule([{ id: "a", name: "A", weeks: 4 }, { id: "b", name: "B", weeks: 2, after: ["a"], fixedStart: 1 }]);
    expect(row(p, "b").start).toBe(1);
  });

  it("주수가 빈 단계는 그리지 않고 알린다. 그 단계를 앞 단계로 둔 행은 없는 앞 단계로 본다", () => {
    const p = planSchedule([{ id: "a", name: "A", weeks: null }, { id: "b", name: "B", weeks: 3, after: ["a"] }]);
    expect(p.incomplete).toEqual(["a"]);
    expect(p.unknownAfter).toEqual([{ id: "b", after: "a" }]);
    expect(row(p, "b").start).toBe(0);
  });

  it("서로를 앞 단계로 적으면 순환으로 알리고 계산은 멈추지 않는다", () => {
    const p = planSchedule([{ id: "a", name: "A", weeks: 2, after: ["b"] }, { id: "b", name: "B", weeks: 3, after: ["a"] }]);
    expect(p.cycles.sort()).toEqual(["a", "b"]);
    expect(p.finalWeek).toBe(3);
  });

  it("그릴 행이 없으면 최종보고서 주가 없다", () => {
    expect(planSchedule([]).finalWeek).toBeNull();
  });
});

describe("기관별 순서 학습", () => {
  const thisReq = [
    { seq: 1, key: "조제물분석::조제물분석" },
    { seq: 2, key: "일반독성::용량결정(DRF) 4주" },
    { seq: 3, key: "일반독성::반복투여 13주" },
  ];
  it("행 번호 순서를 항목 키로 바꿔 저장한다", () => {
    expect(orderToKeys(thisReq, { 2: [1], 3: [2, 9] })).toEqual({
      "일반독성::용량결정(DRF) 4주": ["조제물분석::조제물분석"],
      "일반독성::반복투여 13주": ["일반독성::용량결정(DRF) 4주"],
    });
  });
  it("다음 요청서에서는 그 요청서의 행 번호로 되돌리고, 없는 앞 단계는 버린다", () => {
    const learned = orderToKeys(thisReq, { 2: [1], 3: [2] });
    const nextReq = [
      { seq: 1, key: "일반독성::반복투여 13주" },
      { seq: 2, key: "일반독성::용량결정(DRF) 4주" },
    ];
    expect(orderFromKeys(nextReq, learned)).toEqual({ 1: [2] });
  });
});

describe("주차 → 달력", () => {
  it("착수일이 속한 주의 월요일에서 주를 더한다", () => {
    expect(weekMonday("2026-11-04", 0)).toBe("2026-11-02");
    expect(weekMonday("2026-11-04", 9)).toBe("2027-01-04");
    expect(weekMonday("잘못된 날짜", 1)).toBeNull();
  });
});
