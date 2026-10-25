/**
 * 링크 미리보기(OG) 썸네일 생성 - 첫 화면 궤도가 정렬되는 순간을 그대로 찍는다.
 *   1. npx next build && npx next start -p 3100
 *   2. node scripts/og-orbit.mjs            (public/og-orbit.png, 1200x630)
 * 궤도 CSS(app/site.css)가 바뀌면 다시 실행해 커밋한다. playwright와 sharp가 필요하다.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
const out = process.argv[2] || new URL('../public/og-orbit.png', import.meta.url).pathname;
const tmp = out + '.2x.png';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1200,height:630}, deviceScaleFactor: 2, colorScheme:'light' });
await p.goto('http://localhost:3100/', { waitUntil:'load' });
await p.waitForTimeout(800);
await p.evaluate(() => {
  // 1. 궤도만 남기고 OG 구성으로 재배치
  const lock = document.querySelector('nav .lockup, .lockup');
  const fd = document.querySelector('.fd.fo');
  const lockHtml = lock ? lock.outerHTML : '';
  const root = document.createElement('div');
  root.className = 'a ogc';
  root.innerHTML = `
    <div class="ogl">
      ${lockHtml}
      <h1 class="ogh">비임상 시험 견적<br>단추에 요청하세요.</h1>
      <p class="ogs">한번의 요청으로 여러 기관의 견적서를 받아보세요.</p>
    </div>
    <div class="ogo"></div>`;
  root.querySelector('.ogo').appendChild(fd);
  document.body.innerHTML = '';
  document.body.appendChild(root);
  const st = document.createElement('style');
  st.textContent = `
    html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#F4F4F0}
    .ogc{position:relative;width:1200px;height:630px;background:#F4F4F0;color:#1B1B19;font-family:var(--font-sans)}
    .ogl{position:absolute;left:84px;top:0;height:630px;display:flex;flex-direction:column;justify-content:center;gap:0}
    .ogl .lockup{font-size:34px;margin-bottom:44px}
    .ogh{margin:0;font-size:66px;line-height:1.14;font-weight:700;letter-spacing:-0.035em;word-break:keep-all}
    .ogs{margin:26px 0 0;font-size:27px;line-height:1.4;color:#61615C;letter-spacing:-0.01em}
    .ogo{position:absolute;right:0;top:0;width:560px;height:630px}
    .ogo .fd{position:absolute;inset:0;height:630px;overflow:visible}
    .ogo .orb{transform:scale(1.02)}
  `;
  document.head.appendChild(st);
  // 2. 정렬된 순간(7초 주기의 41%)에 멈춘다. 드리프트는 0으로 두어 축이 수직.
  for (const a of document.getAnimations()) {
    a.pause();
    a.currentTime = (a.animationName === 'oDrift') ? 0 : 2900;
  }
});
await p.waitForTimeout(300);
await p.evaluate(async () => { await document.fonts.ready; });
await p.screenshot({ path: tmp, clip:{x:0,y:0,width:1200,height:630} });
await b.close();
// 2배로 찍어 1200x630으로 줄이면 점과 글자가 또렷하다.
await sharp(tmp).resize(1200, 630).png({ compressionLevel: 9 }).toFile(out);
const fs = await import('node:fs'); fs.unlinkSync(tmp);
console.log('saved', out);
