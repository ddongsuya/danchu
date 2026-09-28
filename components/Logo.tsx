import Link from "next/link";

/**
 * 단추 워드마크. 그림 마크 없이 글자만 쓴다 (로고 유지 여부는 PRODUCT.md에서 미정).
 * 포털 사이드바 등 옛 호출부와의 호환을 위해 LogoMark는 작은 사각 마크로 남긴다.
 */
export function LogoMark({ size = 20, plain = false }: { size?: number; plain?: boolean; ring?: boolean }) {
  const props = plain ? {} : { width: size, height: size };
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...props}>
      <rect x="1" y="1" width="18" height="18" rx="3" fill="var(--brand)" />
      <rect x="6" y="6" width="8" height="8" rx="1" fill="var(--on-brand)" />
    </svg>
  );
}

export function Logo({ href = "/", nameSize = 20 }: { href?: string; size?: number; nameSize?: number }) {
  return (
    <Link href={href} className="wordmark" aria-label="단추 홈" style={{ fontSize: nameSize }}>
      단추<small>danchu.kr</small>
    </Link>
  );
}
