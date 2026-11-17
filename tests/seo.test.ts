import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SITE_DESC, SITE_KEYWORDS, SITE_TITLE, SITE_URL, pageMeta, shareMeta } from "@/lib/share-meta";
import { PUBLIC_PATHS } from "@/app/sitemap";

const CORE = ["비임상 CRO", "비임상 시험기관", "독성시험 견적", "비임상 시험 견적 비교"];

describe("검색 메타", () => {
  it("홈 설명에 의뢰자가 검색하는 낱말이 들어간다", () => {
    for (const k of CORE) expect(SITE_DESC).toContain(k);
  });

  it("공통 낱말에 핵심 검색어가 모두 있다", () => {
    for (const k of CORE) expect(SITE_KEYWORDS).toContain(k);
  });

  it("pageMeta 는 제목·설명·주소·검색 낱말·미리보기를 함께 준다", () => {
    const m = pageMeta("독성시험 견적 요청 · 단추", "독성시험 견적을 요청하세요.", "/request/tox", ["GLP 독성시험"]);
    expect(m.title).toBe("독성시험 견적 요청 · 단추");
    expect(m.alternates?.canonical).toBe("/request/tox");
    expect(m.keywords).toContain("GLP 독성시험");
    for (const k of CORE) expect(m.keywords).toContain(k);
    expect(m.openGraph?.url).toBe(`${SITE_URL}/request/tox`);
    expect(m.twitter?.title).toBe("독성시험 견적 요청 · 단추");
  });

  it("페이지 낱말이 공통 낱말과 겹치면 한 번만 남는다", () => {
    const m = pageMeta("비임상 시험 견적 비교 · 단추", "설명", "/about", ["비임상 시험 견적 비교"]);
    const list = m.keywords as string[];
    expect(list.filter((k) => k === "비임상 시험 견적 비교")).toHaveLength(1);
  });

  it("문구 원칙: 과장 표현과 대시를 쓰지 않는다", () => {
    const texts = [SITE_TITLE, SITE_DESC, ...SITE_KEYWORDS];
    const m = shareMeta("제목", SITE_DESC, "/");
    texts.push(m.openGraph?.title as string, m.openGraph?.description as string);
    for (const t of texts) {
      expect(t).not.toMatch(/최고|최상|1위|업계 유일|혁신|차세대|완벽/);
      expect(t).not.toMatch(/[—–]/);
      expect(t).not.toMatch(/순위/);
    }
  });

  it("검색에 올린 공개 페이지는 모두 metadata 를 스스로 준다", () => {
    const root = fileURLToPath(new URL("../app", import.meta.url));
    for (const p of PUBLIC_PATHS) {
      if (p === "/") continue; // 홈은 app/layout.tsx 의 metadata 를 쓴다
      const file = `${root}${p}/page.tsx`;
      expect(existsSync(file), `${p} page.tsx 가 없다`).toBe(true);
      expect(readFileSync(file, "utf8"), `${p} 에 metadata 가 없다`).toMatch(/export const metadata/);
    }
  });
});
