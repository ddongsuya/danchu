"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, MagnifyingGlass, Plus, FileText } from "@phosphor-icons/react";
import type { RfqSummary } from "@/lib/data";
import { statusLabel, statusTone } from "@/lib/status";
import { StatusPill } from "@/components/app/ui";
import { md } from "@/lib/format";

export type RequestListItem = Pick<RfqSummary, "id" | "rfq_no" | "status" | "substance" | "categories" | "invites" | "submitted" | "reply_by" | "created_at">;
const FILTERS = ["전체", "진행 중", "견적 도착", "종료"] as const;

export function RequestOverview({ name, list }: { name: string; list: RequestListItem[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");
  const [search, setSearch] = useState("");
  const ongoing = list.filter((r) => !["closed", "cancelled"].includes(r.status));
  const arrived = list.filter((r) => ["quoted", "compared"].includes(r.status));
  const closed = list.filter((r) => ["closed", "cancelled"].includes(r.status));
  const hot = list.find((r) => r.status === "compared");
  const source = filter === "진행 중" ? ongoing : filter === "견적 도착" ? arrived : filter === "종료" ? closed : list;
  const query = search.trim().toLocaleLowerCase();
  const filtered = source.filter((r) => `${r.rfq_no} ${r.substance} ${r.categories.join(" ")}`.toLocaleLowerCase().includes(query));
  return (
    <div className="request-overview">
      <div className="ph"><div><h1>내 견적 요청</h1><p>{name} 님, 의뢰한 시험의 진행 상황을 확인하세요.</p></div><Link href="/app/new" className="b1"><Plus size={18} aria-hidden="true" /> 새 견적 요청</Link></div>
      <div className="request-summary" aria-label="요청 현황">
        <div><span>진행 중인 요청</span><strong>{ongoing.length}<small>건</small></strong></div>
        <div><span>도착한 견적 요청</span><strong className="request-summary__accent">{arrived.length}<small>건</small></strong></div>
        <div><span>종료·취소된 요청</span><strong>{closed.length}<small>건</small></strong></div>
      </div>
      {hot && <Link href={`/app/r/${hot.rfq_no}/compare`} className="request-attention"><span className="request-attention__icon"><FileText size={21} aria-hidden="true" /></span><div><b>비교표가 준비되었습니다</b><p>{hot.substance} · {hot.submitted}곳의 회신을 확인하세요.</p></div><span>비교표 보기 <ArrowRight size={17} aria-hidden="true" /></span></Link>}
      <section className="request-panel" aria-labelledby="request-list-title">
        <div className="request-panel__heading"><h2 id="request-list-title">요청 목록 <span>{list.length}</span></h2><label className="request-search"><MagnifyingGlass size={18} aria-hidden="true" /><span className="sr-only">요청 번호, 물질명, 시험 분야 검색</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="요청 번호, 물질명 검색" /></label></div>
        <div className="request-filters" role="group" aria-label="요청 상태 필터">{FILTERS.map((f) => <button key={f} type="button" aria-pressed={f === filter} onClick={() => setFilter(f)}>{f}</button>)}</div>
        <p className="sr-only" role="status">{filtered.length}건의 요청</p>
        {list.length === 0 ? <div className="request-empty"><FileText size={42} weight="light" aria-hidden="true" /><h3>첫 번째 연구의 단추를 채워보세요.</h3><p>시험 항목을 입력하면 수행 분야가 맞는 기관에 전달합니다.</p><Link href="/app/new" className="b1">견적 요청하기 <ArrowUpRight size={17} aria-hidden="true" /></Link></div> : filtered.length === 0 ? <div className="request-empty"><MagnifyingGlass size={36} weight="light" aria-hidden="true" /><h3>일치하는 요청이 없습니다</h3><p>다른 검색어를 입력하거나 상태 필터를 변경해 주세요.</p><button type="button" className="b2" onClick={() => { setSearch(""); setFilter("전체"); }}>전체 요청 보기</button></div> : <>
          <div className="request-table-head" aria-hidden="true"><span>시험물질 · 요청 번호</span><span>진행 상태</span><span>기관 회신</span><span>회신 기한</span></div>
          <div className="request-rows">{filtered.map((r) => <Link href={`/app/r/${r.rfq_no}`} key={r.id} className="request-row"><div className="request-row__title"><small>{r.rfq_no}</small><h3>{r.substance}</h3><p>{r.categories.join(" · ")}</p></div><StatusPill tone={statusTone(r.status)}>{statusLabel(r.status)}</StatusPill><div className="request-row__replies"><b>{r.submitted}</b><span> / {r.invites}곳</span></div><div className="request-row__date"><span>{r.reply_by ? md(r.reply_by) : "미정"}</span><ArrowUpRight size={17} aria-hidden="true" /></div></Link>)}</div>
        </>}
      </section>
      <div className="request-help"><span>시험 항목을 정하기 어려우신가요?</span><Link href="/guide">시험 가이드 살펴보기 <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    </div>
  );
}
