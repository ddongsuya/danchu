import Link from "next/link";
import { CalendarBlank, CaretRight, EnvelopeSimple, Handshake, Phone, Plus, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import { STAGE_LABEL, amountLabel, todayList, weekStrip, type Stage } from "@/lib/crm-deals";
import { hmKst, todayKst, weekdayKo, ymdKst } from "@/lib/crm-shape";
import { SheetButton, TaskCheck } from "./forms";
import { DealForm } from "./deal-ui";
import { MailReview } from "./mail-ui";
import { buildOpts } from "./opts";
import { rowsOf, type CrmCtx } from "./ctx";
import "./crm.css";

const MODE_ICON = { video: VideoCamera, phone: Phone, in_person: Handshake } as const;

/**
 * 오늘 (시안 v5 1번). 숫자 카드 대신 두 목록: 오늘 할 일(할 일·일정·단추 기한, 시간순)과 손이 필요한 안건.
 * 넓은 화면 오른쪽에는 이번 주 일정과 확인할 메일 기록.
 */
export function TodayView({ c, undecided }: { c: CrmCtx; undecided: Parameters<typeof todayList>[0]["invites"] }) {
  const { data, paths, now, me } = c;
  const today = todayKst(now);
  const rows = rowsOf(c);
  const list = todayList({ tasks: data.tasks, events: data.events, rows, invites: undecided, me, now, base: paths.deals });
  const need = rows.filter((r) => r.flag).sort((x, y) => (x.flag!.tone === y.flag!.tone ? y.days - x.days : x.flag!.tone === "due" ? -1 : 1));
  const week = weekStrip({ events: data.events, quotes: data.quotes, deals: data.deals, companies: data.companies, now });
  const review = data.activities.filter((a) => a.needs_review);
  const opts = buildOpts({ ...data, me });
  const d = new Date(`${today}T12:00:00+09:00`);
  const events = list.filter((x) => x.kind === "event").length;
  const tasks = list.filter((x) => x.kind !== "event" && !x.done).length;
  const nowHm = hmKst(new Date(now).toISOString());
  const live = (x: (typeof list)[number]) => {
    if (x.kind !== "event" || !x.time || x.done) return false;
    const e = data.events.find((ev) => `e:${ev.id}` === x.key);
    const end = e?.ends_at ? hmKst(e.ends_at) : `${String(Math.min(23, +x.time.slice(0, 2) + 1)).padStart(2, "0")}${x.time.slice(2)}`;
    return x.time <= nowHm && nowHm < end;
  };
  const noDeals = data.ready && !data.deals.length;
  return (
    <div className="cx cx-t">
      <header className="cx-ph">
        <div>
          <h1>{d.getUTCMonth() + 1}월 {d.getUTCDate()}일 {weekdayKo(today)}요일</h1>
          <p className="cx-ph__sub">일정 <b className="tnum">{events}</b> · 할 일 <b className="tnum">{tasks}</b> · 손이 필요한 안건 <b className="tnum">{need.length}</b></p>
        </div>
        <div className="cx-ph__acts">
          <Link href={`${paths.calendar}?w=${week.from}`} className="b2 bsm"><CalendarBlank size={16} aria-hidden="true" />주간 캘린더</Link>
          <SheetButton className="b1 bsm" title="안건 만들기" label={<><Plus size={16} aria-hidden="true" />안건 만들기</>}><DealForm opts={opts} base={paths.deals} /></SheetButton>
        </div>
      </header>
      {!data.ready && <p className="cx-banner" role="status">CRM 저장소를 준비하는 중이에요. 준비가 끝나면 단추 요청이 안건으로 들어와요.</p>}
      {noDeals && (
        <section className="cx-empty">
          <h2>아직 안건이 없어요</h2>
          <p>단추 요청에 참여하면 안건이 저절로 생겨요. 지금 쓰는 고객 엑셀이 있으면 한 번에 옮길 수 있어요.</p>
          <div className="cx-ph__acts"><Link className="b2" href={paths.import}>엑셀 가져오기</Link></div>
        </section>
      )}
      <div className="cx-today">
        <section className="cx-sec" aria-labelledby="t-todo">
          <div className="cx-sec__h"><h2 id="t-todo">오늘 할 일</h2><span className="cx-muted">일정과 할 일을 시간순으로</span></div>
          {list.length ? (
            <ul className="cx-todo">
              {list.map((x) => {
                const I = x.kind === "event" && x.mode ? MODE_ICON[x.mode as keyof typeof MODE_ICON] ?? CalendarBlank : null;
                return (
                  <li key={x.key} data-live={live(x) ? "1" : "0"} data-done={x.done ? "1" : "0"} data-late={x.overdue ? "1" : "0"}>
                    {x.taskId ? <TaskCheck id={x.taskId} title={x.title} done={x.done} sub={x.sub} /> : (
                      <div className="cx-todo__row">
                        <span className="cx-todo__time tnum">{I && <I size={15} aria-hidden="true" />}{x.time ?? (x.kind === "danchu" ? <span className="cx-d" aria-hidden="true">단</span> : "오늘")}</span>
                        {x.href ? <Link href={x.href} className="cx-todo__t"><b>{x.title}</b><small>{x.sub}</small></Link> : <span className="cx-todo__t"><b>{x.title}</b><small>{x.sub}</small></span>}
                      </div>
                    )}
                    {live(x) ? <span className="cx-now">지금</span> : x.badge ? <span className={`cx-badge${x.overdue ? " cx-badge--late" : ""}`}>{x.badge}</span> : x.done ? <span className="cx-muted">완료</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : <p className="cx-none">오늘 잡힌 일정과 할 일이 없어요. 오른쪽 안건부터 다음 할 일을 잡아 보세요.</p>}
        </section>

        <section className="cx-sec" aria-labelledby="t-need">
          <div className="cx-sec__h"><h2 id="t-need">손이 필요한 안건</h2><Link href={`${paths.deals}?f=need`} className="cx-lk">보드에서 보기</Link></div>
          {need.length ? (
            <ul className="cx-need">
              {need.slice(0, 8).map((r) => (
                <li key={r.deal.id}>
                  <Link href={r.flag!.href.startsWith("/cro/r/") || r.flag!.href.startsWith("/cro/awards") ? r.flag!.href : `${paths.deals}/${r.deal.id}`} className="cx-need__a">
                    <span className="cx-need__t"><b>{r.company ?? (r.danchuNo ?? "")}{r.company || r.danchuNo ? " · " : ""}{r.deal.title}</b>
                      <small><span className={`cx-flag cx-flag--${r.flag!.tone}`}>{r.flag!.label}</span>{STAGE_LABEL[r.deal.stage as Stage]} {r.days}일째 · {r.deal.amount != null ? `예상 ${amountLabel(r.deal.amount)}` : "금액 미정"}</small>
                    </span>
                    <span className="cx-need__go">{r.flag!.action}<CaretRight size={14} aria-hidden="true" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="cx-none">모든 진행 안건에 다음 할 일이 잡혀 있어요.</p>}
        </section>

        <aside className="cx-side" aria-label="이번 주와 메일">
          <section className="cx-box">
            <div className="cx-sec__h"><h2>{week.next ? "다음 주" : "이번 주"}</h2><span className="cx-muted tnum">{+week.from.slice(5, 7)}.{+week.from.slice(8)} ~ {+week.to.slice(5, 7)}.{+week.to.slice(8)}</span></div>
            <ol className="cx-week">
              {week.days.map((w) => (
                <li key={w.date} data-today={w.date === today ? "1" : "0"}>
                  <small>{weekdayKo(w.date)}</small><b className="tnum">{+w.date.slice(8)}</b><span aria-label={`일정 ${w.count}개`}>{"•".repeat(Math.min(3, w.count))}</span>
                </li>
              ))}
            </ol>
            {week.items.length ? (
              <ul className="cx-week__list">
                {week.items.slice(0, 6).map((x, i) => <li key={i}><span className="tnum">{weekdayKo(x.date)}{x.time ? ` ${x.time}` : ""}</span>{x.title}</li>)}
              </ul>
            ) : <p className="cx-muted">이번 주 일정이 없어요.</p>}
          </section>
          {c.mailDomain && (
            <section className="cx-box">
              <div className="cx-sec__h"><h2>확인할 메일 기록</h2><span className="cx-muted tnum">{review.length}건</span></div>
              {review.length ? review.slice(0, 4).map((a) => (
                <article key={a.id} className="cx-mail">
                  <p className="cx-mail__from"><EnvelopeSimple size={15} aria-hidden="true" />{a.mail_from || "보낸 사람 모름"}</p>
                  <p className="cx-mail__s">&quot;{a.title || "제목 없음"}&quot; · 받은 날 {ymdKst(a.occurred_at).slice(5).replace("-", ".")}</p>
                  <MailReview id={a.id} from={a.mail_from} deals={opts.deals} companies={opts.companies} />
                </article>
              )) : <p className="cx-muted">메일 기록 주소로 들어온 메일은 담당자를 찾아 안건에 붙여요. 찾지 못한 메일만 여기 남아요.</p>}
            </section>
          )}
        </aside>
      </div>
      <Link href={paths.log} className="b1 cx-mfab only-narrow">통화 기록 남기기</Link>
    </div>
  );
}
