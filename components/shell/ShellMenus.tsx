"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Bell, List, X } from "@phosphor-icons/react";
import { useAppMaybe } from "@/components/app/AppState";
import { NotificationLink } from "@/components/NotificationLink";
import { mmdd } from "@/lib/format";
import type { NotificationRow } from "@/lib/data";

/**
 * 셸의 열고 닫는 부품 (시안 검토판 r-drawer · c-drawer · c-bell · a-bell · r-avatar · c-avatar).
 * 팝오버는 브라우저 popover 를 쓴다: 바깥 누르기·Esc 로 닫히고 포커스는 연 단추로 돌아간다.
 */

const hide = (id: string) => document.getElementById(id)?.hidePopover?.();

/**
 * 휴대폰 메뉴 단추. 누르면 사이드바(.pt__side)가 왼쪽에서 서랍으로 열린다 (html[data-drawer]).
 * 주소가 바뀌거나 Esc · 바깥(가림막)을 누르면 닫히고, 닫히면 이 단추로 포커스를 돌려준다.
 */
export function DrawerButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const btn = useRef<HTMLButtonElement>(null);

  // 주소가 바뀌면 닫는다 (그리는 중에 바로 맞춘다)
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    const root = document.documentElement;
    if (!open) {
      if (root.hasAttribute("data-drawer")) {
        root.removeAttribute("data-drawer");
        btn.current?.focus();
      }
      return;
    }
    root.setAttribute("data-drawer", "open");
    // 서랍 자체로 포커스를 옮긴다 (Tab 으로 첫 항목부터 이어진다)
    document.querySelector<HTMLElement>(".pt__side")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => () => document.documentElement.removeAttribute("data-drawer"), []);

  return (
    <>
      <button ref={btn} type="button" className="pt__menu" aria-label={open ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <X size={22} aria-hidden="true" /> : <List size={22} aria-hidden="true" />}
      </button>
      {open && <div className="pt__scrim" aria-hidden="true" onClick={() => setOpen(false)} />}
    </>
  );
}

export type MenuLink = { label: string; href: string };

/** 계정 메뉴 (시안 r-avatar · c-avatar): 이름 · 이메일, 설정 링크들, (기관) 테마, 로그아웃 */
export function AccountMenu({ who, email, org, links, theme, place, variant }: { who: string; email: string; org?: string | null; links: MenuLink[]; theme?: boolean; place: "tr" | "bl"; variant: "avatar" | "row" }) {
  const id = `acct${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const router = useRouter();
  const app = useAppMaybe();
  const [busy, setBusy] = useState(false);
  const initial = who.slice(0, 1);
  return (
    <>
      {variant === "avatar" ? (
        <button type="button" popoverTarget={id} className="pt__avatar pt__baravatar pt__acct" aria-label={`계정 메뉴 · ${who}`}>
          {initial}
        </button>
      ) : (
        <button type="button" popoverTarget={id} className="pt__identity pt__acct" aria-label={`계정 메뉴 · ${who}`}>
          <span className="pt__avatar" aria-hidden="true">{initial}</span>
          <span className="pt__identity-t">
            <b>{who}</b>
            {org}
          </span>
        </button>
      )}
      <div id={id} popover="auto" className={`pt-pop pt-pop--${place}`}>
        <div className="pt-pop__hd">
          <span className="pt__avatar" aria-hidden="true">{initial}</span>
          <span>
            <b>{who}</b>
            <small>{email}</small>
          </span>
        </div>
        <div className="pt-pop__list">
          {links.map((l) =>
            l.href.startsWith("/guide") ? (
              <a key={l.href} href={l.href} className="pt-pop__i">{l.label}</a>
            ) : (
              <Link key={l.href} href={l.href} className="pt-pop__i" onClick={() => hide(id)}>{l.label}</Link>
            ),
          )}
          {theme && app && (
            <label className="pt-pop__i pt-pop__theme">
              테마
              <select value={app.theme} onChange={(e) => app.setTheme(e.target.value as typeof app.theme)} aria-label="테마">
                <option value="system">시스템</option>
                <option value="light">밝게</option>
                <option value="dark">어둡게</option>
              </select>
            </label>
          )}
        </div>
        <div className="pt-pop__sep">
          <button
            type="button"
            className="pt-pop__i"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
              router.push("/login");
              router.refresh();
            }}
          >
            {busy ? "로그아웃하는 중" : "로그아웃"}
          </button>
        </div>
      </div>
    </>
  );
}

/** 위 바의 종 (시안 c-bell · a-bell): 최근 알림 네 개와 전체 보기 */
export function NotiBell({ href, unread, recent }: { href: string; unread: number; recent: NotificationRow[] }) {
  const id = `bell${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <>
      <button type="button" popoverTarget={id} className="pt__baric" aria-label={unread ? `알림 ${unread}건` : "알림"}>
        <Bell size={20} aria-hidden="true" />
        {unread ? <span className="pt__bardot" aria-hidden="true" /> : null}
      </button>
      <div id={id} popover="auto" className="pt-pop pt-pop--tr pt-pop--noti">
        <p className="pt-pop__ttl">알림</p>
        <div className="pt-pop__list">
          {recent.length === 0 && <p className="pt-pop__none">새 알림이 없어요</p>}
          {recent.map((n) => {
            const inner = (
              <>
                <b>{n.title}</b>
                <small className="tnum">{[n.body?.split("\n")[0], mmdd(n.created_at)].filter(Boolean).join(" · ")}</small>
              </>
            );
            return n.href ? (
              <NotificationLink key={n.id} id={n.id} href={n.href} unread={!n.read_at} className="pt-pop__i pt-pop__n" onNavigate={() => hide(id)}>
                {inner}
              </NotificationLink>
            ) : (
              <div key={n.id} className="pt-pop__i pt-pop__n">{inner}</div>
            );
          })}
        </div>
        <div className="pt-pop__sep">
          <Link href={href} className="pt-pop__i" onClick={() => hide(id)}>전체 보기</Link>
        </div>
      </div>
    </>
  );
}
