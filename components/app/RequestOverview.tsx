"use client";

import Link from "next/link";
import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { RfqSummary } from "@/lib/data";
import { dotsOf, homeTotals, noJoinPastDue, reportReady, rowLine } from "@/lib/request-story";
import { Orbit } from "@/components/app/Orbit";
import { HowItWorks } from "@/components/app/HowItWorks";
import { md } from "@/lib/format";

export type RequestListItem = Pick<RfqSummary, "id" | "rfq_no" | "status" | "substance" | "categories" | "joined" | "cap" | "submitted" | "sent" | "opened" | "reply_by" | "created_at" | "compared_at" | "selected_quote_id" | "started_at"> & { outcome?: string | null };
const FILTERS = ["전체", "진행 중", "보고서 열림", "종료"] as const;
const DONE = ["closed", "cancelled"];

/**
 * 의뢰자 홈 (2026-10-29 대표 지시). 첫 장면은 랜딩처럼 한 문장 요약(요청 n건 → 기관 n곳 → 참여 → 견적),
 * 그 아래는 지금 할 일과 요청마다 어디까지 왔는지. 숫자는 합계만 보인다 (lib/request-story.ts).
 */
export function RequestOverview({ name, list, today }: { name: string; list: RequestListItem[]; today: string }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");
  const [search, setSearch] = useState("");
  const t = homeTotals(list);
  const late = list.filter((r) => noJoinPastDue(r, today));
  const source =
    filter === "진행 중" ? list.filter((r) => !DONE.includes(r.status)) : filter === "보고서 열림" ? list.filter((r) => reportReady(r)) : filter === "종료" ? list.filter((r) => DONE.includes(r.status)) : list;
  const query = search.trim().toLocaleLowerCase();
  const filtered = source.filter((r) => `${r.rfq_no} ${r.substance} ${r.categories.join(" ")}`.toLocaleLowerCase().includes(query));
  const first = t.ready[0];
  const n = t.reqs.length;
  const rings = t.reqs.slice(0, 5).map((r) => ({ key: r.id, dots: dotsOf(r), late: noJoinPastDue(r, today), tag: r.rfq_no.slice(-4) }));
  const orbitLabel = `요청 ${n}건. 고리 하나가 요청 하나, 점 하나가 기관 하나예요. 채운 점은 견적을 낸 곳, 반 채운 점은 참여한 곳이에요.`;

  return (
    <div className="rs-home">
      <section className="rs-scene" aria-labelledby="home-title">
        <div className={list.length ? "rs-hero" : "rs-hero rs-hero--solo"}>
          <div>
            <p className="rs-k">{name} 님의 견적 요청</p>
            {list.length === 0 ? (
              <h1 id="home-title" className="rs-h1">첫 견적 요청을<br />보내 보세요</h1>
            ) : t.sent === 0 ? (
              <h1 id="home-title" className="rs-h1">요청 {n}건을<br />기관에 보낼<br />준비 중이에요</h1>
            ) : t.scope === "all" ? (
              <h1 id="home-title" className="rs-h1">지금까지 요청 {n}건을<br />기관 <span className="rs-mark">{t.sent}곳</span>에<br />보냈어요</h1>
            ) : (
              <h1 id="home-title" className="rs-h1">요청 {n}건이<br />기관 <span className="rs-mark">{t.sent}곳</span>에<br />전달됐어요</h1>
            )}
            <p className="rs-lead">
              {list.length === 0
                ? "한번의 요청으로 분야가 맞는 여러 기관에 참여 안내가 가요."
                : t.joined === 0
                  ? "아직 참여한 기관은 없어요. 기관의 참여 결정을 기다리고 있어요."
                  : `${t.joined}곳이 참여했고, 견적 ${t.submitted}건이 도착했어요.${t.ready.length ? ` 비교 보고서 ${t.ready.length}건을 지금 볼 수 있어요.` : ""}`}
            </p>
            <div className="rs-acts">
              {first ? (
                <>
                  <Link href={`/app/r/${first.rfq_no}/compare`} className="b1 blg">비교 보고서 보기</Link>
                  <Link href="/app/new" className="b2 blg">새 견적 요청</Link>
                </>
              ) : (
                <Link href="/app/new" className="b1 blg">새 견적 요청</Link>
              )}
            </div>
          </div>
          {list.length > 0 && t.sent > 0 && <Orbit rings={rings} label={orbitLabel} />}
        </div>
        {list.length > 0 && (
          <ol className="rs-flow" aria-label="요청 흐름">
            <li><b className="tnum">{n}<small>건</small></b><span>{t.scope === "active" ? "진행 중인 요청" : "내 요청"}</span></li>
            <li><b className="tnum">{t.sent}<small>곳</small></b><span>전달된 기관</span></li>
            <li><b className="tnum">{t.joined}<small>곳</small></b><span>참여한 기관</span></li>
            <li><b className="tnum">{t.submitted}<small>건</small></b><span>도착한 견적</span></li>
          </ol>
        )}
      </section>

      <HowItWorks role="requester" open={list.length === 0} />

      {late.length > 0 && (
        <section className="rs-block rs-block--tight" aria-labelledby="todo-title">
          <h2 id="todo-title" className="rs-bk">지금 할 일</h2>
          {late.slice(0, 2).map((r) => (
            <Link key={r.id} href={`/app/r/${r.rfq_no}`} className="rs-todo">
              <span>
                <b>{r.substance} 요청에 참여한 기관이 없어요</b>
                <span>회신 기한 {md(r.reply_by)}이 지났어요. 기한을 늘릴지, 마무리할지 정해 주세요.</span>
              </span>
              <span className="rs-todo__go">다음 할 일 보기</span>
            </Link>
          ))}
        </section>
      )}

      {list.length > 0 && (
        <section className="rs-block" aria-labelledby="list-title">
          <p className="rs-bk">내 요청 {list.length}건</p>
          <h2 id="list-title" className="rs-h2">요청마다 어디까지 왔는지</h2>
          <div className="rs-tools">
            <div className="rs-chips" role="group" aria-label="요청 상태 필터">
              {FILTERS.map((f) => (
                <button key={f} type="button" aria-pressed={f === filter} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
            <label className="rs-search">
              <MagnifyingGlass size={18} aria-hidden="true" />
              <span className="sr-only">요청 번호, 물질명, 시험 분야 검색</span>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="요청 번호, 물질명 검색" />
            </label>
          </div>
          <p className="rs-legend" aria-hidden="true">
            <span><i className="rs-dot rs-dot--f" />견적 보냄</span>
            <span><i className="rs-dot rs-dot--h" />참여</span>
            <span><i className="rs-dot rs-dot--w" />아직 참여 전</span>
            <span>점 하나가 기관 하나</span>
          </p>
          <p className="sr-only" role="status">{filtered.length}건의 요청</p>
          {filtered.length === 0 ? (
            <div className="rs-empty">
              <b>일치하는 요청이 없어요</b>
              <span>다른 검색어를 넣거나 필터를 바꿔 보세요.</span>
              <button type="button" className="b2" onClick={() => { setSearch(""); setFilter("전체"); }}>전체 요청 보기</button>
            </div>
          ) : (
            <div className="rs-list">
              {filtered.map((r) => {
                const line = rowLine(r, today, md);
                const ready = reportReady(r);
                const dots = dotsOf(r, 12);
                return (
                  <Link key={r.id} href={ready ? `/app/r/${r.rfq_no}/compare` : `/app/r/${r.rfq_no}`} className="rs-row">
                    <span className="rs-row__no tnum">{r.rfq_no}</span>
                    <span className="rs-row__main">
                      <b>{r.substance}</b>
                      <span className={line.late ? "rs-row__line rs-row__line--late" : "rs-row__line"}>{line.text}</span>
                    </span>
                    <span className="rs-dots" aria-hidden="true">
                      {dots.map((d, i) => <i key={i} className={`rs-dot rs-dot--${d}`} />)}
                      {r.sent > dots.length && <small>+{r.sent - dots.length}</small>}
                    </span>
                    <span className="rs-row__go">{ready ? "보고서 보기" : "진행 보기"}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      <p className="rs-help">
        시험 항목을 정하기 어려우면 <a href="/guide">시험 가이드</a>를 참고하세요.
      </p>
    </div>
  );
}
