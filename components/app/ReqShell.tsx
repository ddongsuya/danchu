"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { searchThreads } from "@/lib/req-search";

/**
 * 의뢰자 화면의 ChatGPT 짜임 부품 (2026-11-26 시안 v7). 넓은 화면에서만 보인다 (portal.css .pt--chat).
 * ReqThreads: 사이드바의 진행 중·끝남 요청 목록. ReqTop: 본문 위 얇은 제목 줄. ReqColumn: 본문 가운데 열 폭.
 * 목록은 app/app/layout.tsx 가 listRequestsForUser 로 읽어 넘긴다. 여기서는 데이터를 읽지 않는다.
 */
/** title: 시험 이름 (동물종), 시안 "DC-122 · 4주 반복투여독성 (랫드)". 없으면 시험물질 */
export type ReqThread = { no: string; substance: string; title?: string; categories: string[]; done: boolean; /** 검색 창의 상태 이름 (lib/status statusLabel) */ status?: string; /** 접수일 (YYYY-MM-DD 또는 ISO) */ at?: string };

/** /app/r/DC-2026-0001/... → DC-2026-0001 */
function currentNo(pathname: string): string | null {
  const m = pathname.match(/^\/app\/r\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function Group({ label, items, on }: { label: string; items: ReqThread[]; on: string | null }) {
  if (!items.length) return null;
  return (
    <div className="rq-threads__g">
      <span className="pt__grp">{label}</span>
      {items.map((t) => (
        <Link key={t.no} href={`/app/r/${t.no}`} className="rq-thread" aria-current={t.no === on ? "page" : undefined} title={`${t.no} · ${t.title || t.substance} · ${t.substance}`}>
          <span className="tnum">{t.no}</span>
          <span className="rq-thread__t">{t.title || t.substance}</span>
        </Link>
      ))}
    </div>
  );
}

/** path: 주소 대신 쓸 경로 (디자인 검토 화면 전용) */
export function ReqThreads({ items, path }: { items: ReqThread[]; path?: string }) {
  const pathname = usePathname();
  const on = currentNo(path ?? pathname);
  return (
    <>
      {items.length ? (
        <nav className="rq-threads" aria-label="내 요청">
          <Group label="진행 중" items={items.filter((t) => !t.done)} on={on} />
          <Group label="끝남" items={items.filter((t) => t.done)} on={on} />
        </nav>
      ) : (
        <div className="rq-threads" />
      )}
      <ReqSearch items={items} />
    </>
  );
}

const noop = () => () => {};
const atLabel = (s?: string) => (s ? new Date(s.length === 10 ? s + "T00:00:00+09:00" : s).toLocaleDateString("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }) : "");

/**
 * 요청 검색 창 (시안 r-search). Ctrl K(맥은 Cmd K)나 사이드바의 "요청 검색"으로 연다. 요청 번호 · 시험 이름 · 시험물질로 찾는다.
 * 키보드로 여는 창이라 움직임 없이 바로 뜬다. ↑↓ 로 고르고 Enter 로 연다.
 */
function ReqSearch({ items }: { items: ReqThread[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  // 사이드바(휴대폰에서는 가려진 서랍) 밖, 셸(.pt) 바로 아래에 그린다. 서버 화면에는 없다
  const host = useSyncExternalStore(noop, () => document.querySelector(".pt") ?? document.body, () => null);
  const { open, done } = searchThreads(items, q);
  const flat = [...open, ...done];

  useEffect(() => {
    const show = () => { setQ(""); setSel(0); if (!ref.current?.open) ref.current?.showModal(); };
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); show(); } };
    // 사이드바 "요청 검색"(/app?q=) 링크는 창을 연다 (주소로 직접 오면 예전처럼 목록 검색)
    const onClick = (e: MouseEvent) => { const a = (e.target as Element | null)?.closest?.('a[href="/app?q="]'); if (a && !e.metaKey && !e.ctrlKey) { e.preventDefault(); show(); } };
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("click", onClick, true); };
  }, []);

  const go = (no: string) => { ref.current?.close(); router.push("/app/r/" + no); };
  const row = (t: ReqThread, i: number) => (
    <Link key={t.no} href={"/app/r/" + t.no} className={"rq-srch__h" + (i === sel ? " on" : "")} onClick={() => ref.current?.close()} onMouseEnter={() => setSel(i)}>
      <span><span className="tnum">{t.no}</span> · {t.title || t.substance}</span>
      <small>{[t.status, t.at ? atLabel(t.at) + " 접수" : ""].filter(Boolean).join(" · ")}</small>
    </Link>
  );
  if (!host) return null;
  return createPortal(
    <dialog ref={ref} className="ix-dialog rq-srch" data-instant aria-label="요청 검색" onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
      <div className="rq-srch__q">
        <MagnifyingGlass size={20} aria-hidden="true" />
        <input
          value={q}
          autoFocus
          placeholder="요청 번호 · 시험물질"
          aria-label="요청 검색"
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            else if (e.key === "Enter" && flat[sel]) { e.preventDefault(); go(flat[sel].no); }
          }}
        />
        <button type="button" className="rq-srch__x" aria-label="검색 닫기" onClick={() => ref.current?.close()}><X size={18} aria-hidden="true" /></button>
      </div>
      <div className="rq-srch__r">
        {flat.length === 0 ? (
          q ? (
            <div className="rq-srch__none"><b>&apos;{q}&apos;와 맞는 요청이 없어요</b><button type="button" className="b2 bsm" onClick={() => setQ("")}>검색 지우기</button></div>
          ) : (
            <div className="rq-srch__none"><b>아직 요청이 없어요</b></div>
          )
        ) : (
          <>
            {open.length > 0 && <p className="rq-srch__g">진행 중 · {open.length}</p>}
            {open.map((t, i) => row(t, i))}
            {done.length > 0 && <p className="rq-srch__g">끝남 · {done.length}</p>}
            {done.map((t, i) => row(t, open.length + i))}
          </>
        )}
      </div>
    </dialog>,
    host,
  );
}

/** 하위 경로별 제목. 없는 경로는 요청 제목만 */
const SUB: Record<string, string> = { compare: "비교 보고서", q: "견적", select: "선정", qna: "질의응답", contract: "계약", detail: "상세 조건" };
// 시안 검토판: 홈과 새 요청은 "새 견적 요청", 필요한 시험 찾아보기(?start=advisor)는 그 이름
const PAGE: Record<string, string> = { "/app": "새 견적 요청", "/app/new": "새 견적 요청", "/app/new/done": "요청 접수", "/app/notifications": "알림", "/app/profile": "설정", "/app/profile/notifications": "설정", "/app/profile/company": "설정", "/app/profile/account": "설정", "/app/profile/delete": "회원 탈퇴", "/app/support": "문의하기" };

/** 넓게 보는 화면 (비교·상세). 나머지는 읽기 폭 */
function isWide(pathname: string): boolean {
  return pathname === "/app" || (pathname.startsWith("/app/r/") && !/\/(qna|select)$/.test(pathname));
}

export function ReqTop({ items, path }: { items: ReqThread[]; path?: string }) {
  const real = usePathname();
  const advisor = useSearchParams().get("start") === "advisor";
  const pathname = path ?? real;
  const no = currentNo(pathname);
  if (!no) return <div className="rq-top"><p className="rq-top__t">{pathname === "/app/new" && advisor ? "필요한 시험 찾아보기" : PAGE[pathname] ?? "새 견적 요청"}</p></div>;
  const t = items.find((i) => i.no === no);
  const rest = pathname.slice(`/app/r/${no}`.length).split("/").filter(Boolean);
  const sub = rest.length ? SUB[rest[0]] ?? "" : "";
  const name = <><span className="tnum">{no}</span>{t ? ` · ${t.title || t.substance}` : ""}</>;
  return (
    <div className="rq-top">
      <p className="rq-top__t">
        {sub ? <Link href={`/app/r/${no}`}>{name}</Link> : name}
        {sub && <><span className="rq-top__sep" aria-hidden="true">/</span>{sub}</>}
      </p>
    </div>
  );
}

export function ReqColumn({ children, path }: { children: React.ReactNode; path?: string }) {
  const pathname = usePathname();
  const wide = isWide(path ?? pathname);
  return <div className={wide ? "rq-col rq-col--wide" : "rq-col"}>{children}</div>;
}
