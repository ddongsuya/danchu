import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scrubEvent, scrubTokens } from "@/lib/sentry-scrub";
import { crossSiteWrite } from "@/lib/origin";
import robots from "@/app/robots";
import sitemap, { PUBLIC_PATHS } from "@/app/sitemap";

const T = "0123456789abcdef0123456789abcdef0123";

describe("Sentry 기록에서 회신 토큰 지우기", () => {
  it("경로와 쿼리의 토큰을 [token] 으로 바꾼다", () => {
    expect(scrubTokens(`https://danchu.kr/q/${T}`)).toBe("https://danchu.kr/q/[token]");
    expect(scrubTokens(`/api/quote/${T}/join`)).toBe("/api/quote/[token]/join");
    expect(scrubTokens(`/api/files/abc?token=${T}&x=1`)).toBe("/api/files/abc?token=[token]&x=1");
    expect(scrubTokens(`GET /q/${T}?a=1`)).toBe("GET /q/[token]?a=1");
  });
  it("토큰이 없는 주소는 그대로 둔다", () => {
    for (const s of ["/cro/requests", "/api/quotes/123/pdf", "https://danchu.kr/faq?q=1"]) expect(scrubTokens(s)).toBe(s);
  });
  it("이벤트 안쪽 깊은 곳의 문자열도 훑는다", () => {
    const e = scrubEvent({ request: { url: `https://danchu.kr/q/${T}`, headers: { Referer: `https://danchu.kr/q/${T}` } }, transaction: `GET /api/quote/${T}`, breadcrumbs: [{ data: { url: `/api/files/x?token=${T}` } }], spans: [{ description: `POST /api/quote/${T}/upload-url` }] });
    expect(JSON.stringify(e)).not.toContain(T);
  });
  it("서버와 브라우저 초기화 둘 다 지우는 함수를 건다", () => {
    for (const f of ["instrumentation.ts", "instrumentation-client.ts"]) {
      const s = readFileSync(f, "utf8");
      expect(s).toMatch(/beforeSend: \(event\) => scrubEvent\(event\)/);
      expect(s).toMatch(/beforeSendTransaction: \(event\) => scrubEvent\(event\)/);
    }
  });
});

describe("다른 사이트에서 온 변경 요청", () => {
  const hosts = ["danchu.kr"];
  it("읽기와 Origin 없는 요청은 통과", () => {
    expect(crossSiteWrite("GET", "https://evil.example", hosts)).toBe(false);
    expect(crossSiteWrite("POST", null, hosts)).toBe(false);
  });
  it("같은 호스트는 통과, 다른 호스트·하위 도메인·null 출처는 막는다", () => {
    expect(crossSiteWrite("POST", "https://danchu.kr", hosts)).toBe(false);
    expect(crossSiteWrite("POST", "https://DANCHU.kr", hosts)).toBe(false);
    expect(crossSiteWrite("DELETE", "https://evil.example", hosts)).toBe(true);
    expect(crossSiteWrite("PATCH", "https://send.danchu.kr", hosts)).toBe(true);
    expect(crossSiteWrite("POST", "null", hosts)).toBe(true);
  });
  it("proxy 가 /api 변경 요청에 이 검사를 건다", () => {
    expect(readFileSync("proxy.ts", "utf8")).toMatch(/pathname\.startsWith\("\/api\/"\) && crossSiteWrite\(/);
  });
});

describe("검색 엔진 설정", () => {
  it("로그인 후 화면·토큰 회신·API 는 막고, 사이트맵에는 막은 경로가 없다", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    const dis = ([] as string[]).concat(rule.disallow ?? []);
    for (const p of ["/app/", "/cro/", "/admin/", "/q/", "/api/"]) expect(dis).toContain(p);
    for (const p of PUBLIC_PATHS) expect(dis.some((d) => p === d || p.startsWith(d.endsWith("/") ? d : `${d}/`))).toBe(false);
    expect(sitemap().length).toBe(PUBLIC_PATHS.length);
  });
  it("사이트맵의 경로마다 page.tsx 가 있다", () => {
    for (const p of PUBLIC_PATHS) expect(() => statSync(join("app", p, "page.tsx"))).not.toThrow();
  });
});

describe("기관 CRM: 다른 기관 행에 닿지 않는다", () => {
  // 서버는 service role 로 읽고 쓰므로 기관 조건이 유일한 칸막이다. 기관 화면·API 의 CRM 표 접근에는 문장마다 org_id 가 있어야 한다.
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(n)) files.push(p);
    }
  };
  walk("app/cro");
  walk("app/api/cro");
  files.push("lib/crm.ts");
  it("cro_crm_* 표를 읽고 쓰는 문장마다 org_id 조건이 있다", () => {
    const misses: string[] = [];
    let seen = 0;
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      const re = /\.from\((?:"(cro_crm_[a-z_]+)"|t|TABLE\[k\])\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s))) {
        seen++;
        const end = s.indexOf(";", m.index);
        const stmt = s.slice(m.index, end < 0 ? undefined : end);
        // 넣기(insert)는 바로 앞에서 만든 행에 org_id 가 들어 있으면 된다
        const built = stmt.includes(".insert(") && /org_id: orgId/.test(s.slice(Math.max(0, m.index - 2500), m.index));
        if (!built && !/org_id|orgId/.test(stmt)) misses.push(`${f}:${s.slice(0, m.index).split("\n").length}`);
      }
    }
    expect(seen).toBeGreaterThan(30);
    expect(misses).toEqual([]);
  });
});
