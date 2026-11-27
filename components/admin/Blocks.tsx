import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 운영자 화면 배치 부품 (시안 v7). 스타일은 components/admin/layout-admin.css.
 * - AdminSection: 묶음 제목 한 줄(제목 · 개수 · 오른쪽 행동)과 짧은 설명, 그 아래 내용
 * - FilterChips: 목록 위 필터. 링크라 URL 에 남는다
 * - AdminTabs: 상세 화면 밑줄 탭 (?tab=)
 */
export function AdminSection({ id, title, count, sub, actions, children }: { id?: string; title: ReactNode; count?: number | string; sub?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const hid = id ? `${id}-h` : undefined;
  return (
    <section className="adm-sec" id={id} aria-labelledby={hid}>
      <div className="adm-sec__head">
        <h2 id={hid}>{title}{count != null && <span className="adm-sec__n tnum">{count}</span>}</h2>
        {actions && <div className="adm-sec__acts">{actions}</div>}
      </div>
      {sub && <p className="adm-sec__sub">{sub}</p>}
      {children}
    </section>
  );
}

export type Chip = { href: string; label: string; n?: number; on: boolean };

export function FilterChips({ items, label }: { items: Chip[]; label: string }) {
  return (
    <nav className="adm-chips" aria-label={label}>
      {items.map((c) => (
        <Link key={c.href} href={c.href} aria-current={c.on ? "true" : undefined}>
          {c.label}{c.n != null && <span className="tnum">{c.n}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function AdminTabs({ items, label }: { items: { href: string; label: string; on: boolean }[]; label: string }) {
  return (
    <nav className="adm-tabs" aria-label={label}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.on ? "page" : undefined} scroll={false}>{t.label}</Link>
      ))}
    </nav>
  );
}
