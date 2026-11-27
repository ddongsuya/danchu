import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CSS 파일의 중괄호가 맞는지 (2026-11-26). 여러 브랜치를 합칠 때 @media 블록의 닫는 } 가 빠지면
 * 그 뒤 규칙이 전부 무시되는데 빌드·타입 검사는 통과한다. 그걸 여기서 잡는다.
 */
function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return cssFiles(p);
    return name.endsWith(".css") ? [p] : [];
  });
}

/** 주석과 문자열을 빼고 { } 깊이를 센다. 음수가 되는 줄이나 끝 깊이를 돌려준다 */
function braceDepth(css: string): { end: number; negativeAt: number | null } {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  let d = 0;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") d++;
      else if (ch === "}") d--;
      if (d < 0) return { end: d, negativeAt: i + 1 };
    }
  }
  return { end: d, negativeAt: null };
}

describe("CSS 중괄호 짝", () => {
  const files = [...cssFiles(join(process.cwd(), "app")), ...cssFiles(join(process.cwd(), "components"))];
  it("CSS 파일이 있다", () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    it(f.slice(process.cwd().length + 1), () => {
      expect(braceDepth(readFileSync(f, "utf8"))).toEqual({ end: 0, negativeAt: null });
    });
  }
});
