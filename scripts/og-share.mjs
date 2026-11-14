/**
 * 링크 미리보기(OG) 이미지 생성: 로고 + "비임상 시험 비교 견적표" (public/og-share.png, 1200x630)
 *   node scripts/og-share.mjs
 * 서버 없이 public/ 을 잠깐 띄워 scripts/og-share/og-share.html 을 2배로 찍고 1200x630으로 줄인다.
 * 로고 SVG는 /mnt/project-files/danchu-logo-export 와 같은 components/Logo.tsx 경로(WORDMARK·MARK_PATH)다.
 * 이미지를 바꾸면 파일 이름과 lib/share-meta.ts SHARE_IMAGE 도 바꾼다(카카오 캐시).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const out = path.join(root, 'public/og-share.png');
const logo = fs.readFileSync(path.join(root, 'scripts/og-share/danchu-logo-ink.svg'), 'utf8');
const html = fs.readFileSync(path.join(root, 'scripts/og-share/og-share.html'), 'utf8').replace('__LOGO__', logo);
const types = { '.css': 'text/css', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  if (req.url === '/' ) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
  const file = path.join(root, 'public', decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(path.join(root, 'public')) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
try {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await p.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await p.evaluate(async () => { await document.fonts.ready; });
  const tmp = out + '.2x.png';
  await p.screenshot({ path: tmp });
  // 2배로 찍은 뒤 줄여야 글자가 또렷하다. 줄이기는 같은 브라우저에서 캔버스로 한다(sharp 의존 없음).
  const data = fs.readFileSync(tmp).toString('base64');
  fs.unlinkSync(tmp);
  const small = await p.evaluate(async (src) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, 1200, 630);
    return c.toDataURL('image/png').split(',')[1];
  }, data);
  fs.writeFileSync(out, Buffer.from(small, 'base64'));
  await b.close();
  console.log('saved', out);
} catch (e) {
  console.error('og-share 생성 실패:', e);
  process.exitCode = 1;
} finally {
  server.close();
}
