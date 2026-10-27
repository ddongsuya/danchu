// 휴대폰에서 각 메뉴 페이지 첫 제목이 화면 안에 보이는지 점검한다.
// 실행: npx next start -p 3100 & 후  node scripts/check-mobile-heads.mjs http://localhost:3100
// 조건: 아이폰 사파리·카카오톡 인앱 UA, 다크 모드, 동작 줄이기, 작은 화면,
//       바로 열기 / 화면 아래 가장자리 누르기 / 스크롤 후 새로고침 / 중간에서 메뉴로 이동 / 맨 아래 "다음으로" / 뒤로 가기.
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
let n = 0;
// 0.3초와 1.2초에 두 번 본다. 늦게라도 맨 위로 미끄러져 올라오면 1.2초만 보는 점검은 통과해 버린다(2026-10-27 놓친 원인).
const check = async (p, tag) => {
  await p.waitForTimeout(300);
  if (!(await check1(p, tag + " @0.3s"))) return false;
  await p.waitForTimeout(900);
  return check1(p, tag + " @1.2s");
};
const check1 = async (p, tag) => {
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
let browser;
try { browser = await pw.webkit.launch(); } catch { browser = await pw.chromium.launch(); console.log("(webkit 없음, chromium으로 점검)"); }
for (const [ua, agent] of Object.entries(UA)) for (const [w, h] of SIZES) for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: false, userAgent: agent, colorScheme: scheme, reducedMotion: scheme === "dark" ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  const tag = (s) => `${ua} ${w}x${h} ${scheme} ${s}`;
  for (const path of PAGES) {
    await p.goto(base + path, { waitUntil: "networkidle" }); n++; await check(p, tag(`open ${path}`));
    // 화면 아래 가장자리를 누른다 (사파리 아래 도구 막대를 부르거나 엄지가 닿는 자리). 제목이 그대로 있어야 한다.
    // 2026-10-27 운영 기록: "아래로 내려 보세요" 띠가 화면 폭 전체를 덮어, 이 자리를 누르면 0.9화면 내려가 제목이 사라졌다
    for (const x of [24, w - 24]) {
      await p.goto(base + path, { waitUntil: "networkidle" }); await p.waitForTimeout(500);
      await p.touchscreen.tap(x, h - 24); n++; await check(p, tag(`tap bottom x=${x} ${path}`));
    }
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
