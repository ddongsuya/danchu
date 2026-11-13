"use client";

import Link from "next/link";
import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { RfqSummary } from "@/lib/data";
import { TRACK_STAGES, reportReady, terseRow, timelineCounts, timelineEvents, timelineLayout } from "@/lib/request-story";
import { HowItWorks } from "@/components/app/HowItWorks";
import { md } from "@/lib/format";

export type RequestListItem = Pick<RfqSummary, "id" | "rfq_no" | "status" | "substance" | "categories" | "joined" | "cap" | "submitted" | "sent" | "opened" | "reply_by" | "created_at" | "compared_at" | "selected_quote_id" | "started_at"> & { outcome?: string | null };
const FILTERS = ["전체", "진행 중", "보고서 열림", "종료"] as const;
const DONE = ["closed", "cancelled"];

/**
 * 의뢰자 홈 (2026-11-10 대표 선택: 시안 5 "시간축"). 첫 장면은 숫자 제목 하나와 시간축.
 * 시간축의 점 하나가 요청 하나의 가장 가까운 일정이다. 오늘 선 왼쪽의 빨간 점이 할 일.
 * 화면 문구는 사용법을 설명하지 않는다 (범례와 명사형 표기만). 계산은 lib/request-story.ts.
 * 넓은 화면은 가로 축, 좁은 화면은 세로 축 (옆으로 밀지 않는다).
 */
/** 가로 축에서 같은 날 겹친 일정을 아래로 내리는 한 칸의 높이. 일정 하나가 점·이름·상태·요청 번호 네 줄(약 80px)이다 */
const TL_ROW = 84;

export function RequestOverview({ name, list, today }: { name: string; list: RequestListItem[]; today: string }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");
  const [search, setSearch] = useState("");
  const events = timelineEvents(list, today);
  const c = timelineCounts(events, today);
  const lay = timelineLayout(events, today);
  // 가로 축에 올린 일정과, 같은 날에 몰려 축에 올리지 못한 수
  const shown = lay.items.filter((e) => !e.hidden);
  const more = lay.items.length - shown.length;
  const active = list.filter((r) => !DONE.includes(r.status));
  const source =
    filter === "진행 중" ? active : filter === "보고서 열림" ? list.filter((r) => reportReady(r)) : filter === "종료" ? list.filter((r) => DONE.includes(r.status)) : list;
  const query = search.trim().toLocaleLowerCase();
  const filtered = source.filter((r) => `${r.rfq_no} ${r.substance} ${r.categories.join(" ")}`.toLocaleLowerCase().includes(query));
  const firstLate = events.find((e) => e.kind === "late");
  const firstOpen = events.find((e) => e.kind === "open");
  const tools = list.length > 8;
  const short = (d: string) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
  // 세로 축에서 오늘 선이 들어갈 자리
  const todayAt = events.findIndex((e) => e.date > today);

  return (
    <div className="rs-home">
      <section className="tlh" aria-labelledby="home-title">
        <div className="tlh__head">
          <div>
            <p className="rs-k">{name} 님의 견적 요청</p>
            {list.length === 0 ? (
              <h1 id="home-title" className="tlh__h1">첫 견적 요청을 보내 보세요</h1>
            ) : c.todo + c.due === 0 ? (
              <h1 id="home-title" className="tlh__h1">{c.open ? `보고서 ${c.open}건 열림` : active.length ? `진행 중 ${active.length}건` : `끝난 요청 ${list.length}건`}</h1>
            ) : (
              <h1 id="home-title" className="tlh__h1">
                {c.todo > 0 && <span className="tlh__late">할 일 {c.todo}건</span>}
                {c.todo > 0 && c.due > 0 && ", "}
                {c.due > 0 && <>마감 {c.due}건</>}
              </h1>
            )}
          </div>
          {firstLate ? (
            <Link href={firstLate.href} className="b1 blg"><span className="tnum">{firstLate.rfq_no}</span> 기한 변경</Link>
          ) : firstOpen ? (
            <Link href={firstOpen.href} className="b1 blg"><span className="tnum">{firstOpen.rfq_no}</span> 보고서</Link>
          ) : (
            <Link href="/app/new" className="b1 blg">새 견적 요청</Link>
          )}
        </div>

        {events.length > 0 && (
          <>
            <p className="tlh__legend" aria-hidden="true">
              <span><i className="tlh__dot tlh__dot--late" />기한 지남</span>
              <span><i className="tlh__dot" />일정</span>
              <span><i className="tlh__dot tlh__dot--open" />보고서 열림</span>
              {more > 0 && <span className="only-wide tnum">외 {more}건</span>}
            </p>
            {/* 넓은 화면: 가로 축 */}
            <div className="tlh__axis only-wide" role="list" aria-label="요청 일정" style={{ height: `${120 + Math.max(0, ...shown.map((e) => e.row)) * TL_ROW}px` }}>
              {lay.ticks.map((t) => <span key={t.date} className="tlh__tick tnum" style={{ left: `${t.pct}%` }} aria-hidden="true">{short(t.date)}</span>)}
              {shown.filter((e) => e.kind === "late").map((e) => (
                <span key={`s-${e.key}`} className="tlh__span" style={{ left: `${e.pct}%`, width: `${Math.max(0, lay.todayPct - e.pct)}%`, top: `${34 + e.row * TL_ROW}px` }} aria-hidden="true" />
              ))}
              <span className="tlh__today" style={{ left: `${lay.todayPct}%` }}><b className="tnum">오늘 {short(today)}</b></span>
              {shown.map((e) => (
                <Link key={e.key} href={e.href} role="listitem" className={`tlh__ev tlh__ev--${e.kind}`} style={{ left: `${e.pct}%`, top: `${28 + e.row * TL_ROW}px` }}>
                  <i className={`tlh__dot tlh__dot--${e.kind}`} aria-hidden="true" />
                  <b>{e.label}</b>
                  <span>{e.sub}</span>
                  <small className="tnum">{e.rfq_no}</small>
                </Link>
              ))}
            </div>
            {/* 좁은 화면: 세로 축 */}
            <div className="tlh__vax only-narrow" role="list" aria-label="요청 일정">
              {events.map((e, i) => (
                <div key={e.key} role="listitem">
                  {i === todayAt && <p className="tlh__now"><b className="tnum">오늘 {short(today)}</b></p>}
                  <Link href={e.href} className={`tlh__v tlh__v--${e.kind}`}>
                    <time className="tnum" dateTime={e.date}>{short(e.date)}</time>
                    <b>{e.label}</b>
                    <small>{e.sub}</small>
                  </Link>
                </div>
              ))}
              {todayAt < 0 && <p className="tlh__now"><b className="tnum">오늘 {short(today)}</b></p>}
            </div>
          </>
        )}
      </section>

      {list.length === 0 && <HowItWorks role="requester" open />}

      {list.length > 0 && (
        <section className="rs-block tlh__list" aria-labelledby="list-title">
          <h2 id="list-title" className="tlh__h2">내 요청 {list.length}건</h2>
          {tools && (
            <div className="rs-tools">
              <div className="rs-chips" role="group" aria-label="요청 상태 필터">
                {FILTERS.map((f) => (
                  <button key={f} type="button" aria-pressed={f === filter} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
              <label className="rs-search">
                <MagnifyingGlass size={18} aria-hidden="true" />
                <span className="sr-only">요청 번호, 물질명, 시험 분야 검색</span>
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="요청 번호, 물질명" />
              </label>
            </div>
          )}
          <p className="sr-only" role="status">{filtered.length}건의 요청</p>
          {filtered.length === 0 ? (
            <div className="rs-empty">
              <b>조건에 맞는 요청 없음</b>
              <button type="button" className="b2" onClick={() => { setSearch(""); setFilter("전체"); }}>전체 요청</button>
            </div>
          ) : (
            <div className="rs-list">
              {filtered.map((r) => {
                const row = terseRow(r, today, md);
                return (
                  <Link key={r.id} href={row.go === "보고서" ? `/app/r/${r.rfq_no}/compare` : `/app/r/${r.rfq_no}`} className="rs-row tlh__row">
                    <span className="rs-row__no tnum">{r.rfq_no}</span>
                    <span className="rs-row__main">
                      <b>{r.substance}</b>
                      <span className={row.late ? "rs-row__line rs-row__line--late" : "rs-row__line"}>{row.text}</span>
                    </span>
                    <span className="tlh__trk">
                      <span className="tlh__bars" aria-hidden="true">
                        {TRACK_STAGES.map((_, i) => <i key={i} className={i < row.stage || row.done ? "on" : i === row.stage ? (row.late ? "late" : "now") : ""} />)}
                      </span>
                      <small>{row.done ? "끝남" : `${TRACK_STAGES[row.stage]}${row.late ? " 멈춤" : ""}`}</small>
                    </span>
                    <span className="tlh__when tnum">{row.when}</span>
                    <span className="rs-row__go">{row.go}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      <p className="rs-help tlh__help">
        <a href="/guide">시험 가이드</a>
        <a href="/guide/library">가이드라인 자료실</a>
        {(firstLate || firstOpen) && <Link href="/app/new">새 견적 요청</Link>}
      </p>
    </div>
  );
}
