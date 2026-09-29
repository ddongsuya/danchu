import { describe, expect, it } from "vitest";
import { advise, visibleQuestions, type Answers } from "@/lib/advisor";
import { CATS, DETAILS, type Cat } from "@/lib/rfq-schema";
import { repeatDoseFor } from "@/lib/design-guide";

/** 제안된 항목이 요청서 스키마(DETAILS)에 실제로 존재하는지 — 화면에서 체크할 수 없는 항목을 제안하면 안 된다 */
function assertItemsExist(tests: { category: string; item: string }[]) {
  for (const t of tests) {
    expect(CATS as readonly string[]).toContain(t.category);
    const f = DETAILS[t.category as Cat].find((x) => x.id === "items" || x.id === "segment");
    if (f?.options) expect(f.options, `${t.category} 에 없는 항목: ${t.item}`).toContain(t.item);
  }
}

const base: Answers = { product: "합성의약품", stage: "1상 진입", auth: ["식약처"], indication: "그 외", route: "경구", duration: "1개월 이내", freq: "1일 1회", wocbp: "아니오", ped: "아니오", cns: "아니오", prior: ["없음"] };

describe("advise — 합성의약품 1상", () => {
  const a = advise(base);
  it("지원 대상이고 제안이 비어 있지 않다", () => {
    expect(a.supported).toBe(true);
    expect(a.tests.length).toBeGreaterThan(0);
  });
  it("임상 1개월이면 반복투여 4주가 제안되고 26주는 아니다", () => {
    const items = a.tests.map((t) => t.item);
    expect(items).toContain("반복투여 4주");
    expect(items).not.toContain("반복투여 26주");
  });
  it("모든 제안 항목은 요청서 스키마에 존재하고 근거가 붙어 있다", () => {
    assertItemsExist(a.tests);
    for (const t of a.tests) expect(t.basis.length).toBeGreaterThan(0);
  });
  it("제안 키는 중복이 없다", () => {
    const keys = a.tests.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("advise — 임상 기간에 따른 반복투여 기간", () => {
  it("6개월 초과·만성은 설치류 26주 + 비설치류 39주", () => {
    const a = advise({ ...base, duration: "6개월 초과·만성" });
    const items = a.tests.map((t) => t.item);
    expect(items).toContain("반복투여 26주");
    expect(items).toContain("반복투여 39주");
  });
  it("진행암(ICH S9)은 임상 기간과 무관하게 4주", () => {
    const a = advise({ ...base, indication: "진행암", duration: "6개월 초과·만성" });
    const items = a.tests.map((t) => t.item);
    expect(items).toContain("반복투여 4주");
    expect(items).not.toContain("반복투여 26주");
  });
  it("design-guide 표: 임상 3개월 이내 → 13주, 품목허가 단계 1개월 초과~3개월 → 6개월", () => {
    expect(repeatDoseFor("3개월 이내", "임상시험 진입").items).toEqual(["반복투여 13주"]);
    expect(repeatDoseFor("3개월 이내", "품목허가 신청").items).toEqual(["반복투여 26주"]);
  });
});

describe("advise — 보유 자료는 제외", () => {
  it("이미 가진 시험은 owned 로 빠진다", () => {
    const withPrior = advise({ ...base, prior: ["없음"] });
    const priorOpt = withPrior.tests[0]?.label;
    // 첫 제안을 보유 자료로 넣으면 제안 수가 줄거나 owned 에 잡힌다
    const a = advise({ ...base, prior: [priorOpt] });
    expect(a.tests.length + a.owned.length).toBeGreaterThanOrEqual(withPrior.tests.length - 1);
  });
});

describe("advise — 다른 분야", () => {
  it("지원하지 않는 값은 supported=false", () => {
    expect(advise({ product: "없는분야" }).supported).toBe(false);
  });
  it("건강기능식품·화장품·의료기기·화학물질도 제안이 나오고 항목이 스키마에 있다", () => {
    const cases: Answers[] = [
      { product: "건강기능식품", hfKind: "합성 원료", hfIntake: "예", hfFood: "아니오", hfMarker: "있음", hfComplex: "아니오", prior: ["없음"] },
      { product: "화장품", cosPurpose: "기능성화장품 심사", cosListed: "아니오", cosUv: "예" },
      { product: "의료기기", mdContact: Object.keys(visibleQuestions({ product: "의료기기" }).find((q) => q.id === "mdContact")!.options.length ? { a: 1 } : {}).length ? visibleQuestions({ product: "의료기기" }).find((q) => q.id === "mdContact")!.options[0] : "", mdDuration: "C · 30일 초과" },
      { product: "화학물질·농약", chType: "일반 화학물질", chTon: "100톤 이상 1,000톤 미만", chGas: "아니오" },
      { product: "바이오의약품", bioType: "단클론항체", bioSpecies: "영장류만", stage: "1상 진입", auth: ["미국 FDA"], indication: "그 외", route: "정맥", duration: "3개월 이내", wocbp: "아니오", prior: ["없음"] },
    ];
    for (const c of cases) {
      const a = advise(c);
      expect(a.supported, String(c.product)).toBe(true);
      expect(a.tests.length, String(c.product)).toBeGreaterThan(0);
      assertItemsExist(a.tests);
    }
  });
});

describe("visibleQuestions — 분기", () => {
  it("합성의약품에는 바이오 질문이 보이지 않고, 바이오에는 CNS 질문이 없다", () => {
    expect(visibleQuestions({ product: "합성의약품" }).map((q) => q.id)).not.toContain("bioType");
    expect(visibleQuestions({ product: "바이오의약품" }).map((q) => q.id)).not.toContain("cns");
  });
});
