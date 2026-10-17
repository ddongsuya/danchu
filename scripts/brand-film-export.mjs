#!/usr/bin/env node
/**
 * 브랜드 필름 출력: 검토용 스틸·콘택트 시트·애니메틱, 그리고 배포용 영상(WebM·MP4).
 * 문구와 타이밍은 lib/brand-film.ts 에서 읽는다(Node 22 type stripping). 여기에는 컷 시각을 정하는 규칙만 둔다.
 *
 * 전제: 검토 경로가 열린 서버가 BRAND_FILM_BASE 에서 돌고 있다.
 *   npx next build && DANCHU_DESIGN_PREVIEW=1 npx next start -p 3200
 *
 * 결정적 캡처: /design-preview/brand-film?bare=1&t=초 로 연 뒤(컴포넌트가 무대 애니메이션을 멈추고 data-ready="1"),
 * 무대의 CSS 애니메이션 currentTime 을 프레임마다 직접 지정하고 스크린샷을 찍는다. 실제 시간에 기대지 않는다.
 *
 * 사용
 *   node scripts/brand-film-export.mjs plan
 *   node scripts/brand-film-export.mjs still <film> <ratio> <theme> <t> <out.png>
 *   node scripts/brand-film-export.mjs clip <film> <ratio> <theme> <from> <to> <out.webm|-> [out.mp4]
 *   node scripts/brand-film-export.mjs poster <film> <ratio> <theme> <out.png>   포스터·썸네일(엔드카드 정지 화면). MP4마다 함께 낸다
 *   node scripts/brand-film-export.mjs review <outDir>          검토 세트 전체(스틸·애니메틱·콘택트 시트·capture-log.json)
 *
 * 환경 변수
 *   BRAND_FILM_BASE  서버 주소. 기본 http://127.0.0.1:3200
 *   FFMPEG_VP8       WebM(VP8) 인코더. 기본 /opt/pw-browsers/ffmpeg-1011/ffmpeg-linux (mjpeg 입력만 읽는다)
 *   FFMPEG_H264      libx264 가 있는 ffmpeg. 있으면 MP4 도 만든다(PNG 프레임 → H.264, BT.709 태그)
 *   PLAYWRIGHT_PATH  playwright 패키지 경로. 기본 /opt/node22/lib/node_modules/playwright
 *   MP4_AUDIO=1      MP4 에 무음 AAC 트랙을 넣는다(음성 트랙을 요구하는 플랫폼용)
 *   REVIEW_CLIPS=0   review 에서 애니메틱 영상을 건너뛴다(스틸·시트·포스터만)
 */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "/opt/node22/lib/node_modules/playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { BRAND_FILMS, FILM_SIZES, cueLine } = await import(pathToFileURL(path.join(ROOT, "lib/brand-film.ts")).href);

const BASE = process.env.BRAND_FILM_BASE || "http://127.0.0.1:3200";
const FFMPEG_VP8 = process.env.FFMPEG_VP8 || "/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux";
const FFMPEG_H264 = process.env.FFMPEG_H264 || "";
const FPS = 30;

/* ── 컷 시각 규칙 ──
   컷 번호는 lib/brand-film.ts 의 장면 구분(필름마다 6컷)을 따른다.
     mark: 1 흩어진 점 · 2 실과 마크 · 3 구멍 속 천 · 4 여밈선 · 5 채우기 · 6 엔드카드
     lab:  1 L1 · 2 L2 · 3 흐린 L3 · 4 웰 위의 마크 · 5 채우기 · 6 엔드카드
   문장 컷(1~3): 문장이 다 보인 마지막 순간. 문구는 end-0.45초부터 ease-out 으로 사라지므로(end-0.3초면 이미 흐리다) end-0.5초.
   컷4: mark 는 여밈선이 수평으로 맞물리고 단춧구멍이 다 열린 순간(level+1.8), lab 은 마크가 다 서고 천이 열리기 직전(wipe-0.05).
   컷5: 단추가 단춧구멍에 채워져 누운 정지 순간(엔드카드 0.4초 전).
   컷6 엔드카드: 필름 끝 0.3초 전(모든 요소가 선 정지 화면). 포스터도 이 시각이다. */
const r2 = (n) => Math.round(n * 100) / 100;
export function cutsOf(spec) {
  const out = spec.cues.map((c) => ({ t: r2(c.end - 0.5), text: cueLine(c.text), lines: c.text.split("\n").length }));
  out.push(spec.id === "mark"
    ? { t: r2(spec.beats.level + 1.8), text: "(문장 없음) 여밈선이 수평으로 맞물림", lines: 0 }
    : { t: r2(spec.beats.wipe - 0.05), text: "(문장 없음) 웰 위의 마크, 천이 열리기 직전", lines: 0 });
  out.push({ t: r2(spec.endcardAt - 0.4), text: "(문장 없음) 단추가 단춧구멍에 채워짐", lines: 0 });
  out.push({ t: r2(spec.durationSec - 0.3), text: `${spec.endcard.lead} ${spec.endcard.promise} ${spec.endcard.line} ${spec.endcard.domain}`, end: true });
  return out.map((c, i) => ({ id: `c${i + 1}`, ...c }));
}
const pickCuts = (film, sel) => {
  const all = cutsOf(BRAND_FILMS[film]);
  if (!sel || sel === "all") return all;
  return sel.map((id) => (id === "end" ? all[all.length - 1] : all.find((c) => c.id === id))).filter(Boolean);
};

/* ── 검토 세트(라운드마다 여기만 고친다) ──
   라운드 2: 컷마다 문장이 다 보인 순간. mark 16:9 라이트·다크 6컷, 4:5 컷2·컷5·엔드카드.
   lab 16:9 라이트 6컷, 4:5 컷4(웰 위의 마크)·컷5(채우기)·엔드카드. 애니메틱은 마크 맞물림~채워짐, 웰→마크 매치컷. */
const REVIEW = {
  stills: [
    { film: "mark", ratio: "16x9", theme: "light", cuts: "all" },
    { film: "mark", ratio: "16x9", theme: "dark", cuts: "all" },
    { film: "mark", ratio: "4x5", theme: "light", cuts: ["c2", "c5", "end"] },
    { film: "lab", ratio: "16x9", theme: "light", cuts: "all" },
    { film: "lab", ratio: "4x5", theme: "light", cuts: ["c4", "c5", "end"] },
  ],
  clips: [
    { name: "mark-animatic", film: "mark", ratio: "16x9", theme: "light", from: 3.0, to: 17.5 },
    { name: "lab-animatic", film: "lab", ratio: "16x9", theme: "light", from: 12.5, to: 19.0 },
  ],
  sheets: [
    { name: "mark-sheet", film: "mark", ratio: "16x9", theme: "light" },
    { name: "mark-dark-sheet", film: "mark", ratio: "16x9", theme: "dark" },
    { name: "lab-sheet", film: "lab", ratio: "16x9", theme: "light" },
  ],
  posters: [],
};

const FILM_LABEL = { mark: "B안 「단추를 채우다」", lab: "C안 「첫 단추」" };
const stillName = (s, c) => `${s.film}-${c.id}-${c.t.toFixed(2)}s-${s.ratio}-${s.theme}${s.variant ? `-${s.variant}` : ""}.png`;
const posterTime = (film) => r2(BRAND_FILMS[film].durationSec - 0.3);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ── 브라우저 ── */
async function openFilm(browser, { film, ratio, theme, t, variant }) {
  const { width, height } = FILM_SIZES[ratio];
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("requestfailed", (r) => errors.push(`requestfailed ${r.url()}`));
  const q = new URLSearchParams({ film, ratio, theme, t: String(t), bare: "1", ...(variant ? { variant } : {}) });
  const url = `${BASE}/design-preview/brand-film?${q}`;
  const res = await page.goto(url, { waitUntil: "load", timeout: 30000 });
  if (!res || res.status() !== 200) throw new Error(`${url} -> ${res && res.status()}`);
  await page.waitForSelector('.bfilm[data-ready="1"]', { timeout: 20000 });
  await page.waitForFunction((th) => document.documentElement.dataset.theme === th, theme, { timeout: 5000 });
  await settle(page);
  return { ctx, page, errors, url };
}

/** 무대의 CSS 키프레임만 멈추고 같은 시각으로 맞춘다(버튼 전환 등 CSSTransition 은 제외) */
const seekTo = (page, sec) =>
  page.evaluate((ms) => {
    const list = document.querySelector(".bfilm").getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation);
    list.forEach((a) => { a.pause(); a.currentTime = ms; });
    return list.length;
  }, sec * 1000);

const settle = (page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

/** 보이는 글자의 글꼴·줄 수·무대 밖 넘침·겹침을 잰다 */
const inspect = (page) =>
  page.evaluate(() => {
    const stageEl = document.querySelector(".bfilm__stage");
    const stage = stageEl.getBoundingClientRect();
    const eff = (el) => { let o = 1; for (let n = el; n && n !== stageEl.parentElement; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; };
    const glyphBox = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
    const textEls = [...stageEl.querySelectorAll(".bfilm__cue, .bfilm__end-stack p, .bfilm-lb__credit")];
    const texts = textEls.map((el) => {
      const cs = getComputedStyle(el);
      const g = glyphBox(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
      return {
        cls: el.className.split(" ").slice(-1)[0],
        text: el.textContent,
        opacity: +eff(el).toFixed(3),
        fontPx: +parseFloat(cs.fontSize).toFixed(1),
        lines: Math.round(el.getBoundingClientRect().height / lh),
        box: [g.left, g.top, g.right, g.bottom].map((v) => Math.round(v)),
        out: g.left < stage.left - 1 || g.right > stage.right + 1 || g.top < stage.top - 1 || g.bottom > stage.bottom + 1,
      };
    }).filter((t) => t.opacity > 0.02);
    const artSel = [".bfilm-mk__plate", ".bfilm-fx__button", ".bfilm-fx__under", ".bfilm-lb__mark", ".bfilm__end-mark"];
    const arts = artSel.flatMap((s) => [...stageEl.querySelectorAll(s)]).map((el) => {
      const r = el.getBoundingClientRect();
      return { cls: el.className.split(" ").slice(-1)[0], opacity: +eff(el).toFixed(3), box: [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v)) };
    }).filter((a) => a.opacity > 0.02);
    const hit = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const overlaps = [];
    texts.forEach((t, i) => {
      arts.forEach((a) => { const px = hit(t.box, a.box); if (px > 0) overlaps.push(`${t.cls} x ${a.cls} ${Math.round(px)}px2`); });
      texts.slice(i + 1).forEach((u) => { const px = hit(t.box, u.box); if (px > 0) overlaps.push(`${t.cls} x ${u.cls} ${Math.round(px)}px2`); });
    });
    const all = textEls.map((e) => e.textContent).join("");
    const fam = getComputedStyle(textEls[0]).fontFamily;
    return {
      stage: [Math.round(stage.width), Math.round(stage.height)],
      theme: document.documentElement.dataset.theme,
      fontFamily: fam,
      fontsCheck: ["500", "700", "800"].every((w) => document.fonts.check(`${w} 64px "Pretendard Variable"`, all)),
      pretendardFacesLoaded: [...document.fonts].filter((f) => f.family.replace(/["']/g, "") === "Pretendard Variable" && f.status === "loaded").length,
      texts,
      arts,
      overlaps,
    };
  });

/* ── 스틸 ── */
async function still(browser, { film, ratio, theme, t, out, variant }) {
  const { ctx, page, errors } = await openFilm(browser, { film, ratio, theme, t, variant });
  await seekTo(page, t);
  await settle(page);
  const m = await inspect(page);
  await page.screenshot({ path: out, type: "png" });
  await ctx.close();
  return { file: out, bytes: fs.statSync(out).size, film, ratio, theme, variant, t, errors, ...m };
}

/* ── 영상(애니메틱·배포본) ── */
function encoder(bin, args) {
  const p = spawn(bin, args, { stdio: ["pipe", "ignore", "pipe"] });
  let err = "";
  p.stderr.on("data", (d) => { err += d; });
  const done = new Promise((r) => p.on("close", (code) => r({ code, err: err.trim().split("\n").slice(-6).join("\n") })));
  const write = (buf) => (p.stdin.write(buf) ? Promise.resolve() : new Promise((r) => p.stdin.once("drain", r)));
  return { write, end: () => { p.stdin.end(); return done; } };
}

async function clip(browser, { film, ratio, theme, from, to, webm, mp4 }) {
  const t0 = Date.now();
  const { ctx, page, errors } = await openFilm(browser, { film, ratio, theme, t: from });
  const n = Math.round((to - from) * FPS);
  const vp8 = webm && encoder(FFMPEG_VP8, ["-hide_banner", "-loglevel", "error", "-y",
    "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "pipe:0",
    "-c:v", "libvpx", "-b:v", "8M", "-crf", "8", "-qmin", "0", "-qmax", "30", "-auto-alt-ref", "0", webm]);
  const audio = process.env.MP4_AUDIO === "1";
  const h264 = mp4 && FFMPEG_H264 && encoder(FFMPEG_H264, ["-hide_banner", "-loglevel", "error", "-y",
    "-f", "image2pipe", "-c:v", "png", "-framerate", String(FPS), "-i", "pipe:0",
    ...(audio ? ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"] : []),
    "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-profile:v", "high", "-level", "4.1",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    ...(audio ? ["-c:a", "aac", "-b:a", "128k", "-shortest"] : ["-an"]),
    "-movflags", "+faststart", mp4]);
  if (mp4 && !FFMPEG_H264) log("FFMPEG_H264 없음: MP4 건너뜀");
  for (let f = 0; f < n; f++) {
    await seekTo(page, from + f / FPS);
    if (vp8) await vp8.write(await page.screenshot({ type: "jpeg", quality: 95 }));
    if (h264) await h264.write(await page.screenshot({ type: "png" }));
    if (f % 60 === 0) log(`${film} frame ${f}/${n}`);
  }
  const r = { film, ratio, theme, from, to, frames: n, fps: FPS, errors };
  if (vp8) { const e = await vp8.end(); r.webm = { file: webm, code: e.code, err: e.err, bytes: fs.existsSync(webm) ? fs.statSync(webm).size : 0 }; }
  if (h264) { const e = await h264.end(); r.mp4 = { file: mp4, code: e.code, err: e.err, bytes: fs.existsSync(mp4) ? fs.statSync(mp4).size : 0 }; }
  await ctx.close();
  r.captureSec = +((Date.now() - t0) / 1000).toFixed(1);
  return r;
}

/* ── 콘택트 시트: 스틸을 그리드로 한 장에. 글꼴은 사이트의 Pretendard 를 그대로 쓴다 ── */
async function sheet(browser, { out, title, sub, items, cols = 3, tile = 600 }) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const cells = items.map((it) => `<figure><img src="data:image/png;base64,${fs.readFileSync(it.file).toString("base64")}" alt=""><figcaption><b>${esc(it.label)}</b><span>${esc(it.caption)}</span></figcaption></figure>`).join("");
  const gap = 24, pad = 40, width = cols * tile + (cols - 1) * gap + pad * 2;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="/fonts/pretendard/pretendard.css"><style>
    :root { --sheet-bg: #e8ece9; --sheet-ink: #202b28; --sheet-muted: #5c6863; --sheet-line: #c9d1cc; }
    * { box-sizing: border-box; }
    body { margin: 0; width: ${width}px; padding: ${pad}px; background: var(--sheet-bg); color: var(--sheet-ink); font-family: "Pretendard Variable", sans-serif; }
    header { display: flex; align-items: baseline; gap: 16px; margin: 0 0 24px; }
    h1 { margin: 0; font-size: 26px; letter-spacing: -0.03em; }
    header p { margin: 0; font-size: 15px; color: var(--sheet-muted); }
    main { display: grid; grid-template-columns: repeat(${cols}, ${tile}px); gap: ${gap + 8}px ${gap}px; }
    figure { margin: 0; }
    img { display: block; width: 100%; height: auto; border: 1px solid var(--sheet-line); }
    figcaption { display: flex; gap: 10px; margin-top: 8px; font-size: 14px; line-height: 1.4; }
    figcaption b { flex: none; font-variant-numeric: tabular-nums; }
    figcaption span { color: var(--sheet-muted); }
  </style></head><body><header><h1>${esc(title)}</h1><p>${esc(sub)}</p></header><main>${cells}</main></body></html>`;
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/fonts/pretendard/pretendard.css`);
  await page.setContent(html, { waitUntil: "load" });
  await settle(page);
  await page.screenshot({ path: out, fullPage: true, type: "png" });
  await ctx.close();
  return { file: out, bytes: fs.statSync(out).size };
}

/* ── 검토 세트 ── */
async function review(outDir) {
  const stillDir = path.join(outDir, "stills");
  fs.mkdirSync(stillDir, { recursive: true });
  const browser = await chromium.launch();
  const report = { base: BASE, startedAt: new Date().toISOString(), stills: [], clips: [], sheets: [] };
  const sheetItems = {};
  try {
    const tS = Date.now();
    for (const s of REVIEW.stills) {
      let cuts = pickCuts(s.film, s.cuts);
      for (const x of s.extra ?? []) {
        const i = cuts.findIndex((c) => c.id === x.after);
        cuts = [...cuts.slice(0, i + 1), x, ...cuts.slice(i + 1)];
      }
      for (const c of cuts) {
        const out = path.join(stillDir, stillName(s, c));
        const r = await still(browser, { ...s, t: c.t, out });
        r.cut = c.id; r.cue = c.text; r.expectLines = c.lines;
        report.stills.push(r);
        log("still", path.basename(out), r.fontsCheck ? "font ok" : "FONT?", r.overlaps.length ? `overlap ${r.overlaps.join("; ")}` : "", r.texts.some((t) => t.out) ? "OUT OF STAGE" : "");
        const key = `${s.film}-${s.ratio}-${s.theme}${s.variant ? `-${s.variant}` : ""}`;
        (sheetItems[key] ??= []).push({ file: out, label: `${c.id.replace("c", "컷")}${c.end ? " 엔드카드" : ""} · ${c.t.toFixed(2)}초`, caption: c.text });
      }
    }
    report.stillsSec = +((Date.now() - tS) / 1000).toFixed(1);

    for (const s of REVIEW.sheets) {
      const key = `${s.film}-${s.ratio}-${s.theme}`;
      const tt = Date.now();
      const r = await sheet(browser, {
        out: path.join(outDir, `${s.name}.png`),
        title: `${FILM_LABEL[s.film]} · ${BRAND_FILMS[s.film].durationSec}초`,
        sub: `${s.ratio.replace("x", ":")} ${s.theme === "dark" ? "다크" : "라이트"} · 컷마다 문장이 다 보인 순간 · 검토용`,
        items: sheetItems[key] ?? [],
        cols: s.cols,
        tile: s.tile,
      });
      r.captureSec = +((Date.now() - tt) / 1000).toFixed(1);
      report.sheets.push(r);
      log("sheet", r.file);
    }

    const posterDir = path.join(outDir, "posters");
    fs.mkdirSync(posterDir, { recursive: true });
    for (const p of REVIEW.posters) {
      const out = path.join(posterDir, `${p.film}-poster-${p.ratio}-${p.theme}.png`);
      report.stills.push(await still(browser, { ...p, t: posterTime(p.film), out }));
      log("poster", path.basename(out));
    }

    for (const c of process.env.REVIEW_CLIPS === "0" ? [] : REVIEW.clips) {
      const r = await clip(browser, { ...c, webm: path.join(outDir, `${c.name}.webm`), mp4: path.join(outDir, `${c.name}.mp4`) });
      report.clips.push(r);
      log("clip", c.name, `${r.captureSec}s`, r.webm?.code, r.mp4?.code);
    }
  } finally {
    await browser.close();
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, "capture-log.json"), JSON.stringify(report, null, 2));
  }
}

/* ── CLI ── */
const [cmd, ...args] = process.argv.slice(2);
if (cmd === "plan") {
  for (const id of Object.keys(BRAND_FILMS)) console.log(id, JSON.stringify(cutsOf(BRAND_FILMS[id]), null, 1));
} else if (cmd === "still") {
  const [film, ratio, theme, t, out] = args;
  const b = await chromium.launch();
  try { console.log(JSON.stringify(await still(b, { film, ratio, theme, t: +t, out }), null, 2)); } finally { await b.close(); }
} else if (cmd === "poster") {
  const [film, ratio, theme, out] = args;
  const b = await chromium.launch();
  try { console.log(JSON.stringify(await still(b, { film, ratio, theme, t: posterTime(film), out }), null, 2)); } finally { await b.close(); }
} else if (cmd === "clip") {
  const [film, ratio, theme, from, to, webm, mp4] = args;
  const b = await chromium.launch();
  try { console.log(JSON.stringify(await clip(b, { film, ratio, theme, from: +from, to: +to, webm: webm === "-" ? "" : webm, mp4 }), null, 2)); } finally { await b.close(); }
} else if (cmd === "review") {
  await review(path.resolve(args[0] || "brand-film-review"));
} else {
  console.log("usage: plan | still <film> <ratio> <theme> <t> <out.png> | poster <film> <ratio> <theme> <out.png> | clip <film> <ratio> <theme> <from> <to> <out.webm|-> [out.mp4] | review <outDir>");
  process.exitCode = 1;
}
