import { describe, expect, it } from "vitest";
import { REQUEST_SCHEMA_VERSION, checkRequestValues, createGate, itemsFieldOf, requestSchema } from "@/lib/agent-request";
import type { Values } from "@/lib/rfq-schema";

/*
 * 에이전트 요청서 도구 (2026-11-20 설계안 D1)
 * - 양식은 단추 rfq-schema 그대로, 판은 정의에서 계산
 * - 검사: 필수 칸, 분야에 시험 종류 없음(items_missing), 선택지에 없는 값, 양식에 없는 칸(경고)
 * - 접수 관문: 판을 보낸 새 앱은 엄격, 판 없는 옛 앱은 경고만, 옛 판은 schema_outdated
 */

const base = (extra: Values = {}): Values => ({
  // 프로필에서 채우는 담당자 칸
  company: "테스트제약", name: "홍길동", email: "a@test.local", phone: "010-0000-0000",
  purpose: "허가자료 제출용", intent: "비교 견적", substance: "TST-101", croCount: "3곳", confid: "일반",
  categories: ["일반독성"], "일반독성.items": ["반복투여 4주"], "일반독성.species": ["랫드"],
  agreePrivacy: true, agreeTerms: true, agreeShare: true,
  ...extra,
});

describe("양식", () => {
  it("판은 고정 길이이고 같은 정의면 같다", () => {
    expect(REQUEST_SCHEMA_VERSION).toMatch(/^[0-9a-f]{12}$/);
    expect(requestSchema().schemaVersion).toBe(REQUEST_SCHEMA_VERSION);
  });
  it("분야 15개와 시험 종류 칸을 알려 준다", () => {
    const s = requestSchema();
    expect(s.categories).toHaveLength(15);
    expect(s.categories.find((c) => c.name === "유전독성")?.itemsKey).toBe("유전독성.items");
    expect(s.categories.find((c) => c.name === "생식발생독성")?.itemsKey).toBe("생식발생독성.segment");
    expect(s.categories.find((c) => c.name === "국소내성")?.itemsKey).toBeNull();
    const genotox = s.categories.find((c) => c.name === "유전독성")!.fields.find((f) => f.key === "유전독성.items")!;
    expect(genotox.options).toContain("복귀돌연변이(Ames, TG 471)");
  });
  it("담당자 칸과 파일 칸은 넣지 않는다", () => {
    const keys = requestSchema().fields.map((f) => f.key);
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("coa");
    expect(keys).toContain("route");
    expect(keys).toContain("authority");
  });
  it("돌려준 양식을 고쳐도 원본은 그대로다", () => {
    requestSchema().categories[0].fields.length = 0;
    expect(requestSchema().categories[0].fields.length).toBeGreaterThan(0);
  });
  it("itemsFieldOf: 없는 분야는 null", () => {
    expect(itemsFieldOf("없는 분야")).toBeNull();
  });
});

describe("요청서 검사", () => {
  it("구조화된 본문은 통과하고 회신 표 행을 시험 종류로 만든다", () => {
    const r = checkRequestValues(base());
    expect(r.issues).toEqual([]);
    expect(r.rows.map((x) => x.name)).toEqual(["반복투여 4주"]);
  });
  it("분야만 있고 시험 종류가 없으면 items_missing", () => {
    const r = checkRequestValues(base({ categories: ["일반독성", "유전독성"] }));
    expect(r.issues).toEqual([expect.objectContaining({ key: "유전독성.items", code: "items_missing" })]);
  });
  it("시험 종류 칸이 없는 분야(국소내성)는 막지 않는다", () => {
    const r = checkRequestValues(base({ categories: ["국소내성"], "일반독성.items": undefined }));
    expect(r.issues.filter((i) => i.code === "items_missing")).toEqual([]);
  });
  it("선택지에 없는 값은 bad_option (형태를 물질 칸 선택지처럼 넣은 경우 포함)", () => {
    const r = checkRequestValues(base({ "일반독성.species": ["쥐"], route: "입으로" }));
    expect(r.issues.map((i) => [i.key, i.code])).toEqual([
      ["일반독성.species", "bad_option"],
      ["route", "bad_option"],
    ]);
  });
  it("양식에 없는 칸은 경고로 알리고 정리된 본문에서 뺀다", () => {
    const r = checkRequestValues(base({ priorStudies: "없음" }));
    expect(r.issues).toEqual([]);
    expect(r.warnings).toEqual([expect.objectContaining({ key: "priorStudies", code: "unknown_field" })]);
    expect(r.payload).not.toHaveProperty("priorStudies");
    expect(r.payload).not.toHaveProperty("email");
  });
  it("필수 칸이 빠지면 웹과 같은 문구로 알린다", () => {
    const r = checkRequestValues(base({ substance: "" }));
    expect(r.issues[0]).toMatchObject({ code: "required" });
    expect(r.issues[0].message).toContain("필수 항목");
  });
});

describe("접수 관문", () => {
  const missing = checkRequestValues(base({ categories: ["유전독성"] })).issues;
  it("옛 판이면 schema_outdated", () => {
    expect(createGate("000000000000", [])).toEqual({ kind: "outdated" });
  });
  it("판을 보낸 새 앱은 엄격하게 막는다", () => {
    expect(createGate(REQUEST_SCHEMA_VERSION, missing, false)).toMatchObject({ kind: "reject", error: "items_missing" });
  });
  it("판 없는 옛 앱은 유예(경고만)", () => {
    expect(createGate(undefined, missing, false)).toEqual({ kind: "lenient", codes: ["items_missing"] });
  });
  it("엄격 스위치를 켜면 옛 앱도 막는다", () => {
    expect(createGate(undefined, missing, true)).toMatchObject({ kind: "reject" });
  });
  it("선택지 오류만 있으면 invalid_request", () => {
    const bad = checkRequestValues(base({ route: "입으로" })).issues;
    expect(createGate(REQUEST_SCHEMA_VERSION, bad, false)).toMatchObject({ kind: "reject", error: "invalid_request" });
  });
  it("필수 칸 누락은 관문에서 막지 않는다(웹 처리가 막는다)", () => {
    const req = checkRequestValues(base({ substance: "" })).issues;
    expect(createGate(REQUEST_SCHEMA_VERSION, req, true)).toEqual({ kind: "ok" });
  });
});
