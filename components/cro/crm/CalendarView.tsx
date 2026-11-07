import Link from "next/link";
import { CaretLeft, CaretRight, DownloadSimple, LockSimple } from "@phosphor-icons/react/dist/ssr";
import {
  EVENT_KIND, EVENT_MODE, addDaysYmd, hmKst, mdW, mondayOf, weekdayKo, wonKo, ymdKst,
  type AgendaItem, type CrmEvent, type CrmQuote,
} from "@/lib/crm-shape";
import { ActivityForm, EventForm, SheetButton, type CrmOpts } from "./forms";
import { qs, type CrmPaths } from "./opts";

export type CalView = "week" | "month";
const H0 = 8;
const H1 = 21; // 08:00 ~ 21:00
const PX = 48; // 한 시간 높이
const KIND_LABEL: Record<AgendaItem["kind"], string> = { meeting: "미팅", call: "통화", deadline: "기한", other: "기타", task: "할 일", quote: "유효기간", danchu: "단추" };

/** 주 제목: 그 주 목요일이 속한 달의 몇째 주 (예: 11월 2주) */
export function weekTitle(monday: string): string {
  const thu = addDaysYmd(monday, 3);
  return `${+thu.slice(5, 7)}월 ${Math.ceil(+thu.slice(8, 10) / 7)}주`;
}
/** 화면에 보일 날짜 범위 */
export function calRange(view: CalView, anchor: string): { from: string; to: string } {
  if (view === "week") { const m = mondayOf(anchor); return { from: m, to: addDaysYmd(m, 6) }; }
  const first = `${anchor.slice(0, 7)}-01`;
  const last = addDaysYmd(`${addDaysYmd(first, 40).slice(0, 7)}-01`, -1);
  return { from: mondayOf(first), to: addDaysYmd(mondayOf(last), 6) };
}
const mins = (hm: string) => +hm.slice(0, 2) * 60 + +hm.slice(3, 5);

/** 같은 날 겹치는 일정은 옆으로 나눈다 */
function lanes(list: AgendaItem[]): Map<string, { lane: number; of: number }> {
  const out = new Map<string, { lane: number; of: number }>();
  const ends: number[] = [];
  const sorted = [...list].sort((a, b) => (a.start as string).localeCompare(b.start as string));
  for (const it of sorted) {
    const s = mins(it.start as string);
    const e = it.end ? Math.max(mins(it.end), s + 30) : s + 60;
    let lane = ends.findIndex((x) => x <= s);
    if (lane < 0) { lane = ends.length; ends.push(e); } else ends[lane] = e;
    out.set(it.key, { lane, of: 0 });
  }
  for (const v of out.values()) v.of = ends.length;
  return out;
}

/**
 * 캘린더 (0038). 미팅·통화는 시간 칸에, 할 일 기한·견적 유효기간·단추 요청 기한은 종일 칸에 저절로 올라온다.
 * 넓은 화면: 주(시간 칸) 또는 월 + 오른쪽 일정 상세. 휴대폰: 날짜 줄 → 그날 목록 → 일정 상세(?e=) 한 화면씩.
 */
export function CalendarView({ view, anchor, day, items, sel, mine, paths, opts, companies, quotes, now = Date.now() }: {
  view: CalView; anchor: string; day: string; items: AgendaItem[]; sel: CrmEvent | null; mine: boolean; paths: CrmPaths; opts: CrmOpts;
  companies: Map<string, string>; quotes: Map<string, CrmQuote>; now?: number;
}) {
  const today = ymdKst(new Date(now));
  const { from, to } = calRange(view, anchor);
  const days: string[] = [];
  for (let d = from; d <= to; d = addDaysYmd(d, 1)) days.push(d);
  const shown = mine ? items.filter((x) => x.mine) : items;
  const byDay = new Map<string, AgendaItem[]>();
  for (const it of shown) byDay.set(it.date, [...(byDay.get(it.date) ?? []), it]);
  const link = (p: Record<string, string | null | undefined>) => qs(paths.calendar, { v: view === "week" ? null : view, w: anchor, mine: mine ? "1" : null, ...p });
  const prev = view === "week" ? addDaysYmd(anchor, -7) : `${addDaysYmd(`${anchor.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
  const next = view === "week" ? addDaysYmd(anchor, 7) : `${addDaysYmd(`${anchor.slice(0, 7)}-01`, 40).slice(0, 7)}-01`;
  const title = view === "week" ? weekTitle(mondayOf(anchor)) : `${+anchor.slice(0, 4)}년 ${+anchor.slice(5, 7)}월`;
  const inWeek = view === "week" ? shown : shown.filter((x) => x.date >= mondayOf(anchor) && x.date <= addDaysYmd(mondayOf(anchor), 6));
  const count = (k: AgendaItem["kind"][]) => inWeek.filter((x) => k.includes(x.kind)).length;
  const summary = [`미팅 ${count(["meeting"])}`, `통화 ${count(["call"])}`, `기한 ${count(["deadline", "task", "quote", "danchu"])}`].join(" · ");
  const itemHref = (it: AgendaItem) => (it.eventId ? link({ e: it.eventId, d: it.date }) : it.href ?? link({ d: it.date }));
  const dayItems = (byDay.get(day) ?? []).sort((a, b) => (a.start ?? "99").localeCompare(b.start ?? "99"));

  const add = (cls: string) => <SheetButton label="일정 잡기" title="일정 잡기" className={cls}><EventForm opts={opts} preset={{ date: day >= today ? day : today }} /></SheetButton>;

  return (
    <div className={`cal${sel ? " cal--sel" : ""}`} data-view={view}>
      <header className="cal__h">
        <div>
          <h1>{title}</h1>
          <p className="tnum">{summary}{mine ? " · 내 일정만" : ""}</p>
        </div>
        <div className="cal__ctl">
          <Link href={qs(paths.calendar, { v: view === "week" ? null : view, mine: mine ? "1" : null })} className="b2 bsm">오늘</Link>
          <span className="cal__nav">
            <Link href={link({ w: prev })} aria-label={view === "week" ? "지난주" : "지난달"} className="b2 bsm"><CaretLeft size={16} aria-hidden="true" /></Link>
            <Link href={link({ w: next })} aria-label={view === "week" ? "다음 주" : "다음 달"} className="b2 bsm"><CaretRight size={16} aria-hidden="true" /></Link>
          </span>
          <nav className="cal__seg" aria-label="보기">
            <Link href={qs(paths.calendar, { w: anchor, mine: mine ? "1" : null })} aria-current={view === "week" ? "page" : undefined}>주</Link>
            <Link href={qs(paths.calendar, { v: "month", w: anchor, mine: mine ? "1" : null })} aria-current={view === "month" ? "page" : undefined}>월</Link>
          </nav>
          <Link href={qs(paths.calendar, { v: view === "week" ? null : view, w: anchor, mine: mine ? null : "1" })} className="b2 bsm" aria-pressed={mine}>내 일정만</Link>
          <span className="only-wide">{add(sel ? "b2 bsm" : "b1 bsm")}</span>
        </div>
      </header>

      <div className="cal__body">
        <div className="cal__main">
          {/* 넓은 화면 */}
          {view === "week" ? (
            <div className="cal-wk only-wide" aria-label={`${title} 일정`}>
              <div className="cal-wk__row cal-wk__days">
                <span aria-hidden="true" />
                {days.map((d) => (
                  <span key={d} className="cal-wk__dh" data-today={d === today ? "1" : "0"}>
                    <small>{weekdayKo(d)}</small><b className="tnum">{+d.slice(8, 10)}</b>
                  </span>
                ))}
              </div>
              <div className="cal-wk__row cal-wk__all">
                <span className="cal-wk__lab">종일</span>
                {days.map((d) => (
                  <div key={d} className="cal-wk__ac">
                    {(byDay.get(d) ?? []).filter((x) => !x.start).map((it) => (
                      <Link key={it.key} href={itemHref(it)} className="cal-chip" data-k={it.kind} data-done={it.done ? "1" : "0"} title={`${KIND_LABEL[it.kind]} · ${it.title}`}>
                        {KIND_LABEL[it.kind]} · {it.title}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
              <div className="cal-wk__row cal-wk__grid" style={{ height: (H1 - H0) * PX }}>
                <div className="cal-wk__hours" aria-hidden="true">
                  {Array.from({ length: H1 - H0 }, (_, i) => <span key={i} style={{ top: i * PX }}>{String(H0 + i).padStart(2, "0")}</span>)}
                </div>
                {days.map((d) => {
                  const timed = (byDay.get(d) ?? []).filter((x) => x.start);
                  const ln = lanes(timed);
                  return (
                    <div key={d} className="cal-wk__col" data-today={d === today ? "1" : "0"} aria-label={`${mdW(d)} ${timed.length ? `일정 ${timed.length}개` : "일정 없음"}`}>
                      {timed.map((it) => {
                        const s = Math.min(Math.max(mins(it.start as string), H0 * 60), H1 * 60 - 30);
                        const e = Math.min(it.end ? Math.max(mins(it.end), s + 30) : s + 60, H1 * 60);
                        const l = ln.get(it.key) ?? { lane: 0, of: 1 };
                        const hpx = Math.max(((e - s) / 60) * PX - 2, 22);
                        return (
                          <Link key={it.key} href={itemHref(it)} className="cal-ev" data-k={it.kind} data-done={it.done ? "1" : "0"} data-size={hpx < 40 ? "s" : hpx < 80 ? "m" : "l"} aria-current={sel?.id === it.eventId ? "true" : undefined}
                            style={{ top: ((s - H0 * 60) / 60) * PX, height: hpx, left: `calc(${(l.lane / l.of) * 100}% + 2px)`, width: `calc(${100 / l.of}% - 4px)` }}>
                            <b>{it.title}</b>
                            <small className="tnum">{it.start}{it.end ? `~${it.end}` : ""}{it.sub ? ` · ${it.sub}` : ""}</small>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="cal-mo only-wide" aria-label={`${title} 일정`}>
              {["월", "화", "수", "목", "금", "토", "일"].map((w) => <span key={w} className="cal-mo__wd">{w}</span>)}
              {days.map((d) => {
                const list = byDay.get(d) ?? [];
                return (
                  <div key={d} className="cal-mo__c" data-out={d.slice(0, 7) !== anchor.slice(0, 7) ? "1" : "0"} data-today={d === today ? "1" : "0"}>
                    <Link href={qs(paths.calendar, { w: d, mine: mine ? "1" : null })} className="cal-mo__n tnum" aria-label={`${mdW(d)} 주 보기`}>{+d.slice(8, 10)}</Link>
                    {list.slice(0, 3).map((it) => (
                      <Link key={it.key} href={itemHref(it)} className="cal-chip" data-k={it.kind} data-done={it.done ? "1" : "0"}>{it.start ? <span className="tnum">{it.start} </span> : null}{it.title}</Link>
                    ))}
                    {list.length > 3 && <Link href={qs(paths.calendar, { w: d, mine: mine ? "1" : null })} className="cal-mo__more">+{list.length - 3}</Link>}
                  </div>
                );
              })}
            </div>
          )}

          {/* 휴대폰: 날짜 줄 → 그날 목록 */}
          <div className="cal-m only-narrow">
            {view === "week" ? (
              <nav className="cal-strip" aria-label="날짜">
                {days.map((d) => (
                  <Link key={d} href={link({ d })} aria-current={d === day ? "date" : undefined} data-today={d === today ? "1" : "0"} scroll={false}>
                    <small>{weekdayKo(d)}</small><b className="tnum">{+d.slice(8, 10)}</b><i data-on={(byDay.get(d) ?? []).length ? "1" : "0"} aria-hidden="true" />
                  </Link>
                ))}
              </nav>
            ) : (
              <nav className="cal-strip cal-strip--mo" aria-label="날짜">
                {days.map((d) => (
                  <Link key={d} href={link({ d })} aria-current={d === day ? "date" : undefined} data-today={d === today ? "1" : "0"} data-out={d.slice(0, 7) !== anchor.slice(0, 7) ? "1" : "0"} scroll={false}>
                    <b className="tnum">{+d.slice(8, 10)}</b><i data-on={(byDay.get(d) ?? []).length ? "1" : "0"} aria-hidden="true" />
                  </Link>
                ))}
              </nav>
            )}
            <h2 className="cal-m__d tnum">{mdW(day)}{day === today ? " · 오늘" : ""}</h2>
            {dayItems.length ? (
              <ul className="cal-list">
                {dayItems.map((it) => (
                  <li key={it.key}>
                    <Link href={itemHref(it)} data-k={it.kind} data-done={it.done ? "1" : "0"}>
                      <time className="tnum">{it.start ?? KIND_LABEL[it.kind]}</time>
                      <span><b>{it.title}</b><small>{it.sub}</small></span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="crm-hint">이날은 잡힌 일정이 없어요.</p>}
          </div>
        </div>

        <aside className="cal__side" aria-label={sel ? "일정 상세" : "이번 주 기한"}>
          {sel ? (
            <EventDetail e={sel} paths={paths} opts={opts} companies={companies} quotes={quotes} back={link({ d: ymdKst(sel.starts_at) })} today={today} />
          ) : (
            <div className="only-wide">
              <h2 className="cal-side__h">이번 주 기한</h2>
              {inWeek.filter((x) => !x.start && !x.done).length ? (
                <ul className="cal-list">
                  {inWeek.filter((x) => !x.start && !x.done).map((it) => (
                    <li key={it.key}><Link href={itemHref(it)} data-k={it.kind}><time className="tnum">{mdW(it.date)}</time><span><b>{it.title}</b><small>{it.sub}</small></span></Link></li>
                  ))}
                </ul>
              ) : <p className="crm-hint">이번 주에 다가오는 기한이 없어요.</p>}
              <p className="crm-hint">할 일 기한, 보낸 견적의 유효기간, 단추 요청의 참여·회신 기한이 저절로 올라와요. 일정을 누르면 여기에 자세히 보여요.</p>
            </div>
          )}
        </aside>
      </div>

      <p className="crm-guard only-wide"><LockSimple size={14} aria-hidden="true" /> 단추 요청은 선정 전이면 회사 이름 없이 요청 번호로만 보여요.</p>
      {!sel && <div className="crm-dock only-narrow">{add("b1 bfull")}</div>}
    </div>
  );
}

function EventDetail({ e, paths, opts, companies, quotes, back, today }: { e: CrmEvent; paths: CrmPaths; opts: CrmOpts; companies: Map<string, string>; quotes: Map<string, CrmQuote>; back: string; today: string }) {
  const day = ymdKst(e.starts_at);
  const cname = new Map(opts.contacts.map((c) => [c.id, c.name]));
  const mname = new Map(opts.members.map((m) => [m.id, m.name]));
  const theirs = [...new Set([e.contact_id, ...e.attendee_contacts].filter(Boolean) as string[])];
  const q = e.quote_doc_id ? quotes.get(e.quote_doc_id) : null;
  const canLog = !!e.company_id && !e.done_at && day <= today;
  return (
    <article className="cal-det">
      <Link href={back} className="crm-back only-narrow">‹ 목록</Link>
      <small className="tnum">{[EVENT_KIND[e.kind], e.mode ? EVENT_MODE[e.mode] : "", `${mdW(day)}${e.all_day ? " 하루 종일" : ` ${hmKst(e.starts_at)}${e.ends_at ? `~${hmKst(e.ends_at)}` : ""}`}`].filter(Boolean).join(" · ")}</small>
      <h2>{e.title}</h2>
      <dl className="crm-dl">
        {e.location && <div><dt>{e.mode === "video" ? "회의 링크" : e.mode === "phone" ? "연락처" : "장소"}</dt><dd>{/^https?:\/\//.test(e.location) ? <a href={e.location} target="_blank" rel="noreferrer noopener">{e.location}</a> : e.location}</dd></div>}
        {e.company_id && <div><dt>고객사</dt><dd><Link href={`${paths.clients}/${e.company_id}`}>{companies.get(e.company_id) ?? "고객사"}</Link></dd></div>}
        {theirs.length > 0 && <div><dt>고객사 참석</dt><dd className="crm-names">{theirs.map((id) => <span key={id}>{cname.get(id) ?? "담당자"}</span>)}</dd></div>}
        {e.attendee_members.length > 0 && <div><dt>우리 참석</dt><dd className="crm-names">{e.attendee_members.map((id) => <span key={id}>{mname.get(id) ?? "담당자"}</span>)}</dd></div>}
        {e.attendees_extra && <div><dt>그 밖의 참석</dt><dd>{e.attendees_extra}</dd></div>}
        {e.requests && <div><dt>요청사항</dt><dd className="crm-pre">{e.requests}</dd></div>}
        {q && <div><dt>관련 견적</dt><dd className="tnum"><Link href={`${paths.docs}/${q.id}`}>{q.doc_no} {q.title}</Link> · {wonKo(q.supply)}</dd></div>}
        <div><dt>알림</dt><dd>{!e.remind ? "알림 끔" : e.reminded_at ? "전날 아침 알림 보냄" : "전날 아침 9시 메일·앱 알림"}</dd></div>
        {e.done_at && <div><dt>기록</dt><dd>이 일정의 기록을 남겼어요{e.company_id ? <> · <Link href={`${paths.clients}/${e.company_id}`}>고객사에서 보기</Link></> : null}</dd></div>}
      </dl>
      <div className="cal-det__acts">
        {canLog && e.company_id && (
          <SheetButton label={e.kind === "call" ? "통화 기록 남기기" : "미팅 기록 남기기"} title={`${e.title} 기록`} className="b1">
            <ActivityForm opts={opts} companyId={e.company_id} preset={{ event_id: e.id, kind: e.kind === "call" ? "call" : "meeting", date: day, time: e.all_day ? undefined : hmKst(e.starts_at), title: e.title, attendee_contacts: theirs, attendee_members: e.attendee_members, quote_doc_id: e.quote_doc_id }} />
          </SheetButton>
        )}
        <SheetButton label="고치기" title="일정 고치기" className="b2"><EventForm opts={opts} event={e} /></SheetButton>
        <a href={`${paths.ics}?id=${e.id}`} className="b2"><DownloadSimple size={16} aria-hidden="true" /> 캘린더 파일</a>
      </div>
      <p className="crm-hint">캘린더 파일을 열면 구글·아웃룩·애플 캘린더에 이 일정이 들어가요.</p>
    </article>
  );
}
