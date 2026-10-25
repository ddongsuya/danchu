// 휴대폰에서 각 메뉴 페이지 첫 제목이 화면 안에 보이는지 점검한다.
// 실행: npx next start -p 3100 & 후  node scripts/check-mobile-heads.mjs http://localhost:3100
// 조건: 아이폰 사파리·카카오톡 인앱 UA, 다크 모드, 동작 줄이기, 작은 화면,
//       바로 열기 / 스크롤 후 새로고침 / 중간에서 메뉴로 이동 / 맨 아래 "다음으로" / 뒤로 가기.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); }
const base = process.argv[2] || "http://localhost:3100";
const PAGES = ["/about", "/how-it-works", "/guide", "/for-cro", "/faq", "/partners"];
const UA = {
  safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  kakao: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0",
};
const SIZES = process.env.QUICK ? [[375, 548]] : [[390, 664], [375, 548], [430, 800]];
let fail = 0;
const check = async (p, tag) => {
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => {
    const h = document.querySelector("main h1");
    if (!h) return { none: true, path: location.pathname };
    const b = h.getBoundingClientRect(), cs = getComputedStyle(h);
    return { path: location.pathname, top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight, y: Math.round(scrollY), op: cs.opacity, vis: cs.visibility };
  });
  const ok = !r.none && r.top >= 56 && r.bottom <= r.vh - 40 && r.op === "1" && r.vis === "visible";
  if (!ok) { fail++; console.log("FAIL", tag, JSON.stringify(r)); }
  return ok;
};
const browser = await pw.webkit.launch();
let n = 0;
for (const [ua, agent] of Object.entries(UA)) for (const [w, h] of SIZES) for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: false, userAgent: agent, colorScheme: scheme, reducedMotion: scheme === "dark" ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  const tag = (s) => `${ua} ${w}x${h} ${scheme} ${s}`;
  for (const path of PAGES) {
    await p.goto(base + path, { waitUntil: "networkidle" }); n++; await check(p, tag(`open ${path}`));
    await p.evaluate(() => scrollTo(0, 1200)); await p.waitForTimeout(400);
    await p.reload({ waitUntil: "networkidle" }); n++; await check(p, tag(`reload ${path}`));
  }
  // 중간에서 메뉴로 이동, 맨 아래 다음으로, 뒤로
  await p.goto(base + "/about", { waitUntil: "networkidle" });
  for (const to of PAGES.slice(1, 5)) {
    await p.evaluate(() => scrollTo(0, 1500)); await p.waitForTimeout(400);
    await p.click("button.menu"); await p.waitForTimeout(350);
    await p.click(`.mnav__links a[href="${to}"]`); n++; await check(p, tag(`menu -> ${to}`));
  }
  await p.goto(base + "/about", { waitUntil: "networkidle" });
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(600);
  if (await p.$("a.nextp")) { await p.click("a.nextp"); n++; await check(p, tag("nextp from /about")); }
  await p.goBack(); n++; await check(p, tag("back"));
  await ctx.close();
}
await browser.close();
console.log(`${n - fail}/${n} 통과`);
process.exit(fail ? 1 : 0);
