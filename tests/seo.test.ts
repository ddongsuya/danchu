import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SITE_DESC, SITE_KEYWORDS, SITE_TITLE, SITE_URL, pageMeta, shareMeta } from "@/lib/share-meta";
import { PUBLIC_PATHS } from "@/app/sitemap";
import { FAQ_ITEMS, faqAnswerText } from "@/lib/faq-page";
import { faqPageJsonLd, jsonLdString, siteJsonLd } from "@/lib/structured-data";
import robots from "@/app/robots";

const CORE = ["비임상시험", "GLP 비임상시험", "비임상 CRO", "비임상 시험기관", "독성시험 견적", "비임상 시험 견적 비교"];

describe("검색 메타", () => {
  it("홈 설명(검색 결과 스니펫)에 핵심 검색어가 들어가고 110~130자다", () => {
    for (const k of ["비임상시험", "비임상 CRO", "GLP 비임상시험"]) expect(SITE_DESC).toContain(k);
    expect(SITE_DESC.length).toBeGreaterThanOrEqual(110);
    expect(SITE_DESC.length).toBeLessThanOrEqual(130);
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

/* ── 구조화 데이터(JSON-LD)·llms.txt·robots (2026-11-18) ── */

const appDir = fileURLToPath(new URL("../app", import.meta.url));
const publicDir = fileURLToPath(new URL("../public", import.meta.url));
const BANNED = /최고|최상|1위|업계 유일|혁신|차세대|완벽|순위|추천|컨설팅|[—–]/;

describe("JSON-LD", () => {
  it("홈 스키마: Organization 과 SoftwareApplication 을 한 그래프로 준다", () => {
    const data = siteJsonLd();
    expect(data["@context"]).toBe("https://schema.org");
    const graph = data["@graph"] as Record<string, unknown>[];
    const org = graph.find((n) => n["@type"] === "Organization")!;
    const app = graph.find((n) => n["@type"] === "SoftwareApplication")!;
    expect(org.name).toBe("단추");
    expect(org.alternateName).toBe("Danchu");
    expect(org.url).toBe("https://danchu.kr");
    expect(org.email).toBe("support@danchu.kr");
    expect(org.contactPoint).toMatchObject({ "@type": "ContactPoint", email: "support@danchu.kr", contactType: "customer support" });
    expect(app.url).toBe("https://danchu.kr");
    expect(app.description).toContain("비임상 시험(독성·효력·약동학·개별 분석) 비교 견적 플랫폼");
    expect(app.publisher).toEqual({ "@id": org["@id"] });
  });

  it("사업자 등록 전이라 전화·사업자번호·주소·요금 금액을 넣지 않는다", () => {
    const s = JSON.stringify(siteJsonLd());
    expect(s).not.toMatch(/telephone|taxID|vatID|address|"price"|offers/);
  });

  it("JSON 으로 다시 읽히고, 문자열 안의 < 는 스크립트를 닫지 못하게 바꾼다", () => {
    const s = jsonLdString({ a: "</script><b>" });
    expect(s).not.toContain("<");
    expect(JSON.parse(s)).toEqual({ a: "</script><b>" });
    expect(() => JSON.parse(jsonLdString(siteJsonLd()))).not.toThrow();
    expect(() => JSON.parse(jsonLdString(faqPageJsonLd()))).not.toThrow();
  });

  it("FAQPage 는 화면의 질문 7개와 같은 순서·같은 문장이다", () => {
    expect(FAQ_ITEMS).toHaveLength(7);
    const data = faqPageJsonLd();
    expect(data["@type"]).toBe("FAQPage");
    const qs = data.mainEntity as { "@type": string; name: string; acceptedAnswer: { "@type": string; text: string } }[];
    expect(qs.map((q) => q.name)).toEqual(FAQ_ITEMS.map((f) => f.q));
    qs.forEach((q, i) => {
      expect(q["@type"]).toBe("Question");
      expect(q.acceptedAnswer["@type"]).toBe("Answer");
      expect(q.acceptedAnswer.text).toBe(faqAnswerText(FAQ_ITEMS[i]));
      expect(q.acceptedAnswer.text.startsWith(FAQ_ITEMS[i].lead)).toBe(true);
      for (const p of FAQ_ITEMS[i].points) expect(q.acceptedAnswer.text).toContain(p);
    });
  });

  it("FAQ 화면은 같은 데이터로 그리고, 스키마를 함께 싣는다", () => {
    const src = readFileSync(`${appDir}/faq/page.tsx`, "utf8");
    expect(src).toMatch(/FAQ_ITEMS\.map/);
    expect(src).toMatch(/faqPageJsonLd\(\)/);
    // 질문·답 문장을 화면 파일에 따로 적어 두면 스키마와 어긋날 수 있다
    for (const f of FAQ_ITEMS) expect(src).not.toContain(f.q);
  });

  it("홈 화면이 사이트 스키마를 싣는다", () => {
    expect(readFileSync(`${appDir}/page.tsx`, "utf8")).toMatch(/siteJsonLd\(\)/);
  });

  it("스키마 설명에 과장·순위·대시가 없다", () => {
    const g = siteJsonLd()["@graph"] as Record<string, unknown>[];
    for (const n of g) expect(String(n.description ?? "")).not.toMatch(BANNED);
  });
});

describe("llms.txt", () => {
  const file = `${publicDir}/llms.txt`;
  const read = () => readFileSync(file, "utf8");

  it("public/llms.txt 가 있고 H1 과 요약 인용문으로 시작한다", () => {
    expect(existsSync(file)).toBe(true);
    const lines = read().split("\n");
    expect(lines[0]).toBe("# 단추 (Danchu)");
    expect(read()).toMatch(/\n> .+/);
  });

  it("주요 공개 페이지를 모두 절대 주소로 안내하고, 그 페이지가 실제로 있다", () => {
    const pages = ["/about", "/how-it-works", "/request", "/for-cro", "/guide", "/guide/library", "/faq", "/pricing", "/early"];
    for (const p of pages) {
      expect(read()).toContain(`(https://danchu.kr${p})`);
      expect(existsSync(`${appDir}${p}/page.tsx`), `${p} 페이지가 없다`).toBe(true);
    }
  });

  it("비공개 경로는 안내하지 않는다", () => {
    expect(read()).not.toMatch(/danchu\.kr\/(app|cro|admin|api|q)(\/|\)|$)/m);
  });

  it("사실만 담는다: 일정·기밀·연락처, 요금 금액·과장 없음", () => {
    const t = read();
    expect(t).toContain("2027-06-01");
    expect(t).toContain("2027-12-31");
    expect(t).toContain("2027-05-31");
    expect(t).toContain("support@danchu.kr");
    expect(t).toMatch(/회사명.*연락처/);
    expect(t).not.toMatch(/\d[\d,]*\s*(만\s*)?원|%/);
    expect(t).not.toMatch(BANNED);
  });
});

describe("robots", () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
  const PRIVATE = ["/app/", "/cro/", "/admin/", "/api/", "/q/"];
  const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended"];
  const agents = (rule: (typeof rules)[number]) => (Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent]);
  const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

  /** robots.txt 규칙대로: 이름이 맞는 묶음이 있으면 그것만, 없으면 * 묶음을 따른다. 가장 긴 접두어가 이긴다 */
  function allowed(bot: string, path: string) {
    const rule = rules.find((x) => agents(x).includes(bot)) ?? rules.find((x) => agents(x).includes("*"))!;
    const hit = (ps: string[]) => Math.max(-1, ...ps.filter((p) => path.startsWith(p)).map((p) => p.length));
    return hit(list(rule.allow)) >= hit(list(rule.disallow));
  }

  it("검색엔진과 AI 봇이 공개 페이지와 /llms.txt 에 들어올 수 있다", () => {
    for (const bot of ["Googlebot", "Yeti", "Bingbot", ...AI_BOTS]) {
      for (const p of [...PUBLIC_PATHS, "/llms.txt", "/early"]) expect(allowed(bot, p), `${bot} ${p}`).toBe(true);
    }
  });

  it("AI 봇은 이름으로 따로 적어 두고, 비공개 경로는 모두에게 막는다", () => {
    for (const bot of AI_BOTS) expect(rules.some((x) => agents(x).includes(bot)), bot).toBe(true);
    for (const bot of ["Googlebot", ...AI_BOTS]) {
      for (const p of PRIVATE) expect(allowed(bot, `${p}x`), `${bot} ${p}`).toBe(false);
    }
  });

  it("검색에 올린 페이지는 robots 가 막는 경로와 겹치지 않는다", () => {
    for (const p of PUBLIC_PATHS) expect(allowed("*", p), p).toBe(true);
  });
});

describe("검색엔진 수집용 파일", () => {
  it("public/favicon.ico 가 있고 ICO 형식이다 (네이버 서치어드바이저 404 경고)", () => {
    const f = `${publicDir}/favicon.ico`;
    expect(existsSync(f)).toBe(true);
    const b = readFileSync(f);
    expect([...b.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
  });

  it("Organization 로고 파일이 public 에 있다", () => {
    const org = (siteJsonLd()["@graph"] as Record<string, unknown>[]).find((n) => n["@type"] === "Organization")!;
    const path = String(org.logo).replace(SITE_URL, "");
    expect(existsSync(`${publicDir}${path}`), path).toBe(true);
  });
});
