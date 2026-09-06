import Link from "next/link";

/** 28×28 로고: 흰 원 위 브랜드색 구멍 4개 + "단추" */
export function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="12" fill="#fff" />
      <circle cx="10" cy="10" r="1.8" fill="var(--brand)" />
      <circle cx="18" cy="10" r="1.8" fill="var(--brand)" />
      <circle cx="10" cy="18" r="1.8" fill="var(--brand)" />
      <circle cx="18" cy="18" r="1.8" fill="var(--brand)" />
    </svg>
  );
}

export function Logo({ href = "/", sub }: { href?: string; sub?: string }) {
  return (
    <Link href={href} className="logo" aria-label="단추 홈">
      <LogoMark />
      <span className="logo__name">단추</span>
      {sub && (
        <>
          <span className="logo__sep">/</span>
          <span className="logo__sub">{sub}</span>
        </>
      )}
    </Link>
  );
}
