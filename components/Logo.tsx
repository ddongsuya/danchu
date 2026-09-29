import Link from "next/link";

/** A four-hole button: the same mark on the public site and every workspace. */
export function LogoMark({ size = 32 }: { size?: number; plain?: boolean; ring?: boolean }) {
  return <span className="brand-mark" style={{ width: size, height: size, padding: size * .25, gap: size * .125, borderRadius: size * .3 }} aria-hidden="true"><i /><i /><i /><i /></span>;
}

export function Logo({ href = "/", nameSize = 23 }: { href?: string; size?: number; nameSize?: number }) {
  return <Link href={href} className="wordmark" aria-label="단추 홈" style={{ fontSize: nameSize }}><LogoMark />단추<small>danchu</small></Link>;
}
