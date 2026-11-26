import Link from "next/link";
import { STAGE_LABEL, todayList, weekStrip, type Stage } from "@/lib/crm-deals";
import { dLabel, todayKst, weekdayKo } from "@/lib/crm-shape";
import type { PipeItem } from "@/lib/pipeline";
import { SheetButton, TaskCheck } from "./forms";
import { DealForm } from "./deal-ui";
import { buildOpts } from "./opts";
import { rowsOf, type CrmCtx } from "./ctx";
import "./crm.css";
import "@/components/cro/board.css";

/** 받은 요청에서 오늘 화면 할 일로 올리는 단계 (참여 결정 · 작성 · 선정 뒤 보고). 제출하고 기다리는 것과 끝난 것은 뺀다 */
const REQ_TODO = new Set(["todo", "decide", "work", "won"]);

type Row = { key: string; what: string; where: string; due: string | null; time: string | null; href: string | null; taskId?: string; done: boolean; sub: string };

/** 기한이 시각(참여 결정 기한 등)이면 서울 날짜로 */
const ymdOf = (v: string | null) => (!v ? null : v.length <= 10 ? v : new Date(v).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }));

/** 기한 칸: 7일 안이면 D-n 표시, 지난 것은 "n일 지남", 그 밖에는 월-일 */
function Due({ r, now }: { r: Row; now: number }) {
  if (r.time) return <span className="tnum">{r.time}</span>;
  if (!r.due) return <span className="bd-mut">-</span>;
  const d = dLabel(r.due, now);
  if (d.n < 0) return <span className="bd-pill bd-pill--b tnum">{d.label}</span>;
  if (d.n <= 7) return <span className="bd-pill bd-pill--w tnum">{d.n === 0 ? "D-day" : `D-${d.n}`}</span>;
  return <span className="tnum">{r.due.slice(5)}</span>;
}

/**
 * 오늘 (2026-11-26 시안 v7 c-today). 왼쪽: 할 일 표(받은 요청의 다음 할 일 + 오늘 일정·할 일)와 조치 필요 안건.
 * 오른쪽: 이번 주 일정, 캘린더, 숫자 두 개(진행 중인 요청 · 이번 달 제출). 계산은 lib/crm-deals · lib/pipeline 그대로.
 */
export function TodayView({ c, undecided, reqs = [] }: { c: CrmCtx; undecided: Parameters<typeof todayList>[0]["invites"]; reqs?: PipeItem[] }) {
  const { data, paths, now, me } = c;
  const today = todayKst(now);
  const rows = rowsOf(c);
  // 단추 기한은 받은 요청 줄로 보이므로 CRM 쪽에서는 일정·할 일만 쓴다
  const crm = todayList({ tasks: data.tasks, events: data.events, rows, invites: undecided, me, now, base: paths.deals }).filter((x) => x.kind !== "danchu");
  const todo: Row[] = [
    ...reqs.filter((p) => p.action && REQ_TODO.has(p.group)).map((p) => ({ key: `p:${p.id}`, what: p.next, where: `${p.no} · ${p.tests || p.title}`, due: ymdOf(p.due), time: null, href: p.action!.href, done: false, sub: "" })),
    ...crm.map((x) => ({ key: x.key, what: x.title, where: x.sub, due: x.kind === "task" ? today : null, time: x.time, href: x.href, taskId: x.taskId, done: x.done, sub: x.sub })),
  ].sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? "9999").localeCompare(b.due ?? "9999") || (a.time ?? "").localeCompare(b.time ?? ""));
  // 조치 필요 안건: 받은 요청에서 온 조치(요청 화면·수주 링크)는 위 표에 있으므로 뺀다
  const need = rows
    .filter((r) => r.flag && !r.flag.href.startsWith("/cro/r/") && !r.flag.href.startsWith("/cro/awards"))
    .sort((x, y) => (x.flag!.tone === y.flag!.tone ? y.days - x.days : x.flag!.tone === "due" ? -1 : 1));
  const week = weekStrip({ events: data.events, quotes: data.quotes, deals: data.deals, companies: data.companies, now });
  const weekDays = new Set(week.days.map((w) => w.date));
  const plan = [
    ...week.items.map((x, i) => ({ key: `w${i}`, title: x.title, date: x.date, time: x.time, due: false })),
    ...reqs.filter((p) => (p.tab === "new" || p.tab === "draft") && weekDays.has(p.replyBy)).map((p) => ({ key: `r:${p.id}`, title: `${p.no} 회신 기한`, date: p.replyBy, time: null as string | null, due: true })),
  ].sort((a, b) => `${a.date}${a.time ?? "99"}`.localeCompare(`${b.date}${b.time ?? "99"}`));
  const month = today.slice(0, 7);
  const live = reqs.filter((p) => p.tab === "new" || p.tab === "draft").length;
  const sentThisMonth = reqs.filter((p) => p.submittedOn?.startsWith(month)).length;
  const opts = buildOpts({ ...data, me });
  const d = new Date(`${today}T12:00:00+09:00`);
  const noDeals = data.ready && !data.deals.length;
  return (
    <div className="bd cx-t">
      <div className="bd-hd cx-t__hd">
        <h1>오늘</h1>
        <span className="cx-t__date">{d.getUTCMonth() + 1}월 {d.getUTCDate()}일 {weekdayKo(today)}요일</span>
        <div className="cx-t__acts">
          <Link href={`${paths.log}?new=1`} className="b2 bsm">기록 추가</Link>
          <SheetButton className="b1 bsm" title="안건 만들기" label="안건 만들기"><DealForm opts={opts} base={paths.deals} /></SheetButton>
        </div>
      </div>
      {!data.ready && <p className="cx-banner" role="status">CRM 저장소를 준비하는 중이에요. 준비가 끝나면 단추 요청이 안건으로 들어와요.</p>}
      <div className="bd-split cx-t__split">
        <div className="bd-l">
          <section aria-labelledby="t-todo">
            <h2 id="t-todo" className="cx-t__h">할 일 <span className="tnum">{todo.filter((r) => !r.done).length}건</span></h2>
            {todo.length ? (
              <>
                <table className="bd-tb">
                  <thead><tr><th>할 일</th><th>요청 · 안건</th><th>기한</th><th className="r"><span className="sr-only">열기</span></th></tr></thead>
                  <tbody>
                    {todo.map((r) => (
                      <tr key={r.key} data-done={r.done ? "1" : "0"}>
                        <td className="bd-tt">{r.taskId ? <TaskCheck id={r.taskId} title={r.what} done={r.done} sub="" /> : r.what}</td>
                        <td>{r.where || <span className="bd-mut">-</span>}</td>
                        <td><Due r={r} now={now} /></td>
                        <td className="r">{r.href && <Link href={r.href} className="b2 bsm">열기</Link>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="bd-ls">
                  {todo.map((r) => (
                    <li key={r.key}>
                      {r.href ? (
                        <Link href={r.href}>
                          <span className="bd-ls__t">{r.what}</span>
                          <span className="bd-ls__s">{r.where}</span>
                          <Due r={r} now={now} />
                        </Link>
                      ) : r.taskId ? <div className="cx-t__task"><TaskCheck id={r.taskId} title={r.what} done={r.done} sub={r.sub} /></div> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="cx-none">오늘 할 일이 없어요</p>}
          </section>

          <section aria-labelledby="t-need" className="cx-t__need">
            <h2 id="t-need" className="cx-t__h">조치 필요 안건</h2>
            {noDeals ? (
              <div className="cx-t__empty"><span>아직 안건이 없어요</span><Link className="b2 bsm" href={paths.import}>엑셀 가져오기</Link></div>
            ) : need.length ? (
              <ul className="cx-t__list">
                {need.slice(0, 8).map((r) => (
                  <li key={r.deal.id}>
                    <span className="cx-t__lt"><b>{r.deal.title}</b><small>{[r.company ?? r.danchuNo, `${STAGE_LABEL[r.deal.stage as Stage]} 단계 ${r.days}일째`].filter(Boolean).join(" · ")}</small></span>
                    <span className={`bd-pill ${r.flag!.tone === "due" ? "bd-pill--b" : "bd-pill--w"}`}>{r.flag!.label}</span>
                    <Link href={`${paths.deals}/${r.deal.id}`} className="cx-t__go">열기</Link>
                  </li>
                ))}
              </ul>
            ) : <p className="cx-none">조치가 필요한 안건이 없어요</p>}
          </section>
        </div>

        <aside className="bd-r cx-t__side" aria-labelledby="t-week">
          <section>
            <h2 id="t-week" className="cx-t__h">{week.next ? "다음 주 일정" : "이번 주 일정"}</h2>
            {plan.length ? (
              <ul className="cx-t__list cx-t__plan">
                {plan.slice(0, 6).map((x) => (
                  <li key={x.key}>
                    <span className="cx-t__lt"><b>{x.title}</b><small className="tnum">{x.date.slice(5)} ({weekdayKo(x.date)}){x.time ? ` ${x.time}` : ""}</small></span>
                    {x.due && <span className="bd-pill bd-pill--w">기한</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="cx-none">일정이 없어요</p>}
            <Link href={`${paths.calendar}?w=${week.from}`} className="cx-t__cal">캘린더</Link>
          </section>
          <dl className="cx-t__stats">
            <div><dt>진행 중인 요청</dt><dd className="tnum">{live}</dd></div>
            <div><dt>이번 달 제출</dt><dd className="tnum">{sentThisMonth}</dd></div>
          </dl>
        </aside>
      </div>
      <Link href={`${paths.log}?new=1`} className="b1 cx-mfab only-narrow">통화 기록 남기기</Link>
    </div>
  );
}
