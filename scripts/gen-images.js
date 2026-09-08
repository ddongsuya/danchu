/**
 * 정적 이미지 생성 — PWA 아이콘 + 링크 미리보기(OG) 썸네일.
 *   node scripts/gen-images.js
 * 로컬(Windows)에서 실행해 결과 PNG를 저장소에 커밋한다. 한글은 시스템 폰트로 그려진다.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT_ICONS = path.join(__dirname, "..", "public", "icons");
const OUT_PUBLIC = path.join(__dirname, "..", "public");
const BRAND = "#A3690F";
const INK = "#1A1919";
const MUTED = "#6F6E6B";
const SURFACE = "#F5F5F4";
const FONT = "Pretendard, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";

/** 단추 마크 — 브랜드 링 + 흰 원 + 구멍 4개 */
function mark(cx, cy, r, { ring = true } = {}) {
  const k = r / 13; // 원본 viewBox(28) 기준 배율
  const dot = 1.9 * k;
  const off = 4 * k;
  const holes = [
    [cx - off, cy - off],
    [cx + off, cy - off],
    [cx - off, cy + off],
    [cx + off, cy + off],
  ];
  return `
    ${ring ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${BRAND}"/>` : ""}
    <circle cx="${cx}" cy="${cy}" r="${ring ? r * (12 / 13) : r}" fill="#fff"/>
    ${holes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${dot}" fill="${BRAND}"/>`).join("")}`;
}

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="512" height="512">
  <rect width="28" height="28" fill="${BRAND}"/>
  <circle cx="14" cy="14" r="11.5" fill="#fff"/>
  <circle cx="10" cy="10" r="1.9" fill="${BRAND}"/><circle cx="18" cy="10" r="1.9" fill="${BRAND}"/>
  <circle cx="10" cy="18" r="1.9" fill="${BRAND}"/><circle cx="18" cy="18" r="1.9" fill="${BRAND}"/>
</svg>`;

/**
 * 링크 미리보기 1200×630 — 로고 + 이름 + 한 줄 설명.
 * 카카오톡·슬랙은 가로로 잘라 보여 주므로 좌우 90px 여백 안에 모든 글자를 넣는다.
 */
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${SURFACE}"/>
  ${mark(158, 138, 68)}
  <g font-family="${FONT}">
    <text x="252" y="128" font-size="40" font-weight="700" fill="${INK}" letter-spacing="-0.8">단추 Danchu</text>
    <text x="252" y="170" font-size="26" font-weight="600" fill="${BRAND}" letter-spacing="1">비임상 시험 견적 플랫폼</text>
    <text x="90" y="330" font-size="60" font-weight="700" fill="${INK}" letter-spacing="-1.6">비임상 시험 견적,</text>
    <text x="90" y="410" font-size="60" font-weight="700" fill="${INK}" letter-spacing="-1.6">한번 요청으로 한눈에 비교</text>
    <text x="90" y="478" font-size="28" fill="${MUTED}">한번 입력하면 참여 CRO에 배포하고, 같은 형식의 비교표로 드립니다.</text>
    <text x="90" y="562" font-size="28" font-weight="600" fill="${BRAND}">danchu.kr</text>
    <text x="1110" y="562" font-size="26" fill="${MUTED}" text-anchor="end">의뢰자 무료 · CDA 지원</text>
  </g>
  <rect x="0" y="606" width="1200" height="24" fill="${BRAND}"/>
</svg>`;

async function main() {
  fs.mkdirSync(OUT_ICONS, { recursive: true });
  for (const size of [192, 512]) {
    await sharp(Buffer.from(iconSvg)).resize(size, size).png().toFile(path.join(OUT_ICONS, `icon-${size}.png`));
  }
  await sharp(Buffer.from(iconSvg)).resize(180, 180).png().toFile(path.join(OUT_ICONS, "apple-touch-icon.png"));
  await sharp(Buffer.from(ogSvg)).png().toFile(path.join(OUT_PUBLIC, "og.png"));
  console.log("생성 완료: icons/icon-192.png, icons/icon-512.png, icons/apple-touch-icon.png, og.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
