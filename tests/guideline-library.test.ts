import { describe, expect, it } from "vitest";
import { shortCite } from "@/lib/cite";
import { findDoc, LIBRARY, TOPICS } from "@/lib/guideline-library";
import { ADVISOR_DISCLAIMER } from "@/lib/advisor";
import * as fs from "node:fs";
import * as path from "node:path";

describe("가이드라인 자료실", () => {
  it("문서마다 주제가 있고 짧은 이름이 겹치지 않는다", () => {
    const topics = new Set(TOPICS.map((t) => t.id));
    for (const d of LIBRARY) expect(topics.has(d.topic), d.short).toBe(true);
    expect(new Set(LIBRARY.map((d) => d.short)).size).toBe(LIBRARY.length);
  });

  it("원문 주소는 공식 사이트만 쓴다", () => {
    for (const d of LIBRARY) expect(d.url, d.short).toMatch(/^https:\/\/(database\.ich\.org|www\.ich\.org|www\.law\.go\.kr|www\.oecd\.org)\//);
  });

  it("근거 표기의 짧은 이름이 자료실 문서를 찾는다", () => {
    expect(findDoc(shortCite("ICH M3(R2) §9 · 고시 별표 4").split(" · ")[0])?.short).toBe("ICH M3");
    expect(findDoc(shortCite("식약처 「의약품등의 독성시험기준」"))?.short).toBe("식약처 독성시험기준");
    expect(findDoc(shortCite("ICH S6(R1) 2부 4장"))?.short).toBe("ICH S6");
    expect(findDoc(shortCite("OECD TG 412, 413"))?.short).toBe("OECD TG");
    expect(findDoc(shortCite("비임상시험관리기준"))?.short).toBe("식약처 GLP 기준");
  });

  it("사이트 데이터에 나오는 ICH 문서는 모두 자료실에 있다", () => {
    const src = ["lib/advisor.ts", "lib/design-guide.ts", "lib/presets.ts"].map((f) => fs.readFileSync(path.join(process.cwd(), f), "utf8")).join("\n");
    const ich = new Set([...src.matchAll(/ICH\s+([A-Z]\d+[A-Z]?)/g)].map((m) => `ICH ${m[1]}`));
    const missing = [...ich].filter((s) => !findDoc(s));
    expect(missing).toEqual([]);
    expect(ADVISOR_DISCLAIMER).toBeTruthy();
  });
});
