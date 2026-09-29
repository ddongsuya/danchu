/**
 * 정적 이미지 생성 — PWA 아이콘 + 링크 미리보기(OG) 썸네일.
 *   node scripts/gen-images.js
 * 결과 PNG를 저장소에 커밋한다. OG 글자는 share-card.svg에 윤곽선으로 저장해 시스템 폰트에 의존하지 않는다.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT_ICONS = path.join(__dirname, "..", "public", "icons");
const OUT_PUBLIC = path.join(__dirname, "..", "public");
const BRAND = "#2A55A5";
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="512" height="512">
  <rect width="28" height="28" fill="${BRAND}"/>
  <circle cx="14" cy="14" r="11.5" fill="#fff"/>
  <circle cx="10" cy="10" r="1.9" fill="${BRAND}"/><circle cx="18" cy="10" r="1.9" fill="${BRAND}"/>
  <circle cx="10" cy="18" r="1.9" fill="${BRAND}"/><circle cx="18" cy="18" r="1.9" fill="${BRAND}"/>
</svg>`;

/**
 * 링크 미리보기 1200×630 — 로고 + 이름 + 한 줄 설명.
 * 좌우 72px 이상 여백을 두고 작은 공유 카드에서도 제목을 읽기 쉽게 한다.
 */
const ogSvg = fs.readFileSync(path.join(__dirname, "share-card.svg"), "utf8");

async function main() {
  fs.mkdirSync(OUT_ICONS, { recursive: true });
  for (const size of [192, 512]) {
    await sharp(Buffer.from(iconSvg)).resize(size, size).png().toFile(path.join(OUT_ICONS, `icon-${size}.png`));
  }
  await sharp(Buffer.from(iconSvg)).resize(180, 180).png().toFile(path.join(OUT_ICONS, "apple-touch-icon.png"));
  for (const name of ["og.png", "og-workspace-v2.png"]) {
    await sharp(Buffer.from(ogSvg)).png().toFile(path.join(OUT_PUBLIC, name));
  }
  console.log("생성 완료: icons/icon-192.png, icons/icon-512.png, icons/apple-touch-icon.png, og.png, og-workspace-v2.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
