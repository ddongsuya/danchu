"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 의뢰자 화면의 ChatGPT 짜임 부품 (2026-11-26 시안 v7). 넓은 화면에서만 보인다 (portal.css .pt--chat).
 * ReqThreads: 사이드바의 진행 중·끝남 요청 목록. ReqTop: 본문 위 얇은 제목 줄. ReqColumn: 본문 가운데 열 폭.
 * 목록은 app/app/layout.tsx 가 listRequestsForUser 로 읽어 넘긴다. 여기서는 데이터를 읽지 않는다.
 */
/** title: 시험 이름 (동물종), 시안 "DC-122 · 4주 반복투여독성 (랫드)". 없으면 시험물질 */
export type ReqThread = { no: string; substance: string; title?: string; categories: string[]; done: boolean };

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
  if (!items.length) return <div className="rq-threads" />;
  return (
    <nav className="rq-threads" aria-label="내 요청">
      <Group label="진행 중" items={items.filter((t) => !t.done)} on={on} />
      <Group label="끝남" items={items.filter((t) => t.done)} on={on} />
    </nav>
  );
}

/** 하위 경로별 제목. 없는 경로는 요청 제목만 */
const SUB: Record<string, string> = { compare: "비교 보고서", q: "견적", select: "선정", qna: "질의응답", contract: "계약", detail: "상세 조건" };
const PAGE: Record<string, string> = { "/app": "내 견적 요청", "/app/new": "새 견적 요청", "/app/new/done": "요청 접수", "/app/notifications": "알림", "/app/profile": "프로필", "/app/profile/delete": "계정 삭제", "/app/support": "문의" };

/** 넓게 보는 화면 (비교·상세). 나머지는 읽기 폭 */
function isWide(pathname: string): boolean {
  return pathname === "/app" || (pathname.startsWith("/app/r/") && !/\/(qna|select)$/.test(pathname));
}

export function ReqTop({ items, path }: { items: ReqThread[]; path?: string }) {
  const real = usePathname();
  const pathname = path ?? real;
  const no = currentNo(pathname);
  if (!no) return <div className="rq-top"><p className="rq-top__t">{PAGE[pathname] ?? "내 견적 요청"}</p></div>;
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
