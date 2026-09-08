import Link from "next/link";

/**
 * 단추 로고 마크 — 흰 원 + 브랜드색 구멍 4개
 * ring: 흰 배경 위(헤더)에서 쓰는 외곽 브랜드 링 (app/icon.svg와 동일)
 * plain: 폭을 CSS가 제어
 */
export function LogoMark({ size = 28, plain = false, ring = false }: { size?: number; plain?: boolean; ring?: boolean }) {
  const props = plain ? {} : { width: size, height: size };
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" {...props}>
      {ring ? (
        <>
          <circle cx="14" cy="14" r="13" fill="var(--brand)" />
          <circle cx="14" cy="14" r="12" fill="#fff" />
        </>
      ) : (
        <circle cx="14" cy="14" r="13" fill="#fff" />
      )}
      <circle cx="10" cy="10" r="1.9" fill="var(--brand)" />
      <circle cx="18" cy="10" r="1.9" fill="var(--brand)" />
      <circle cx="10" cy="18" r="1.9" fill="var(--brand)" />
      <circle cx="18" cy="18" r="1.9" fill="var(--brand)" />
    </svg>
  );
}

export function Logo({
  href = "/",
  size = 28,
  nameSize = 18,
}: {
  href?: string;
  size?: number;
  nameSize?: number;
}) {
  return (
    <Link href={href} className="logo" aria-label="단추 홈">
      <LogoMark size={size} ring />
      <span className="logo__name" style={{ fontSize: nameSize }}>단추</span>
    </Link>
  );
}
