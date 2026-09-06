import Link from "next/link";

/**
 * 단추 로고 마크 — 흰 원 + 브랜드색 구멍 4개
 * plain: 히어로용(폭을 CSS가 제어, 그림자 포함)
 */
export function LogoMark({ size = 28, plain = false }: { size?: number; plain?: boolean }) {
  const props = plain ? {} : { width: size, height: size };
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" {...props}>
      <circle cx="14" cy="14" r="13" fill="#fff" />
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
      <LogoMark size={size} />
      <span className="logo__name" style={{ fontSize: nameSize }}>단추</span>
    </Link>
  );
}
