/**
 * nonclinical-guideline 스킬 참고 문서 생성기(scripts/build-guideline-skill.mjs) 점검.
 * 제안 규칙을 고친 뒤에도 생성기가 돌고, 코드의 규칙 번호가 빠짐없이 참고 문서에 들어가는지 확인한다.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAll } from "../scripts/build-guideline-skill.mjs";

describe("가이드라인 스킬 생성기", () => {
  it("참고 문서 6개를 만들고, advisor.ts의 규칙 번호를 모두 담는다", async () => {
    const { files } = (await buildAll()) as { files: Record<string, string> };
    expect(Object.keys(files)).toHaveLength(6);
    for (const body of Object.values(files)) expect(body.length).toBeGreaterThan(200);

    const src = readFileSync("lib/advisor.ts", "utf8");
    // 접두사(R-A1-, R-F1 등 분류용)는 빼고 완전한 규칙 번호만 본다
    const ids = [...new Set([...src.matchAll(/"(R-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d{2})"/g)].map((m) => m[1]))];
    expect(ids.length).toBeGreaterThan(50);
    const rules = files["04-제안규칙-전체.md"];
    const missing = ids.filter((id) => !rules.includes(`| ${id} |`));
    expect(missing).toEqual([]);
  }, 60_000);
});
