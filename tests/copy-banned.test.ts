import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 화면 문구 금지어 (2026-11-27). 홍보·안심 문장과 권유형("~해보세요"), 느낌표가 다시 들어오지 않게 막는다.
 * 주인 지시: "의뢰자는 무료로 이용해요 이런 문구 좀 쓰지 말라고 … 시중에 나와있는 웹사이트나 웹앱들의 사용 문구 기준으로".
 * 새 금지어는 BANNED 배열에 한 줄 추가한다. 줄 단위 근사라 주석 줄(//, *, {/*)은 건너뛴다.
 */
const BANNED: { name: string; re: RegExp }[] = [
  { name: "무료로 이용", re: /무료로 이용/ },
  { name: "무료로 참여", re: /무료로 참여/ },
  { name: "해보세요", re: /해\s?보세요/ },
  { name: "부담 없이", re: /부담\s?없이/ },
  { name: "간편하게", re: /간편하게/ },
  { name: "손쉽게", re: /손쉽게/ },
  { name: "한눈에", re: /한눈에/ },
  { name: "쉽고 빠르", re: /쉽고 빠르/ },
  { name: "걱정 마", re: /걱정 마/ },
  { name: "안심하", re: /안심하/ },
  { name: "한국어 문장 끝 느낌표", re: /[가-힣]!(["'`<\s]|$)/ },
];

const ROOT = join(__dirname, "..");
const EXCLUDED_DIRS = ["app/terms", "app/privacy", "app/design-preview"];
const SCAN: { dir: string; ext: string }[] = [
  { dir: "app", ext: ".tsx" },
  { dir: "components", ext: ".tsx" },
  { dir: "lib", ext: ".ts" },
];

function files(dir: string, ext: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    const rel = relative(ROOT, p).split(sep).join("/");
    if (EXCLUDED_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`))) return [];
    if (statSync(p).isDirectory()) return files(p, ext);
    return p.endsWith(ext) && !/\.test\.tsx?$/.test(p) ? [p] : [];
  });
}

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\s*\/\*)/.test(line);

function hits(path: string): string[] {
  const rel = relative(ROOT, path).split(sep).join("/");
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .flatMap((line, i) =>
      isComment(line) ? [] : BANNED.filter((b) => b.re.test(line)).map((b) => `${rel}:${i + 1} [${b.name}] ${line.trim().slice(0, 120)}`),
    );
}

describe("화면 문구 금지어", () => {
  const targets = [...SCAN.flatMap(({ dir, ext }) => files(join(ROOT, dir), ext)), join(ROOT, "public", "llms.txt")];

  it("검사할 파일을 찾는다", () => {
    expect(targets.length).toBeGreaterThan(100);
  });

  it("app·components·lib·llms.txt에 금지어가 없다", () => {
    expect(targets.flatMap(hits)).toEqual([]);
  });
});
