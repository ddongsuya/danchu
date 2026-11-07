import Link from "next/link";
import { CalendarBlank, DownloadSimple, EnvelopeSimple, LockSimple, Phone } from "@phosphor-icons/react/dist/ssr";
import {
  ACT_KIND, CONTACT_ROLE, EVENT_KIND, EVENT_MODE, QUOTE_STAGE, TASK_CAT,
  agoLabel, buildFeed, dLabel, hmKst, isOpenQuote, mdW, personLabel, quoteStage, wonKo, ymdKst,
  type AwardLite, type CrmActivity, type CrmCompany, type CrmContact, type CrmEvent, type CrmQuote, type CrmTask, type FeedItem, type Member, type QuoteTrack,
} from "@/lib/crm-shape";
import {
  ActivityDelete, ActivityForm, CompanyDelete, CompanyForm, ContactForm, EventForm, QuoteLinkForm, QuoteStageForm, SheetButton, TaskActionAdd, TaskCheck, TaskForm,
  type CrmOpts, type Opt,
} from "./forms";
import { qs, type CrmPaths } from "./opts";

export const DETAIL_TABS = [["log", "기록"], ["quotes", "견적"], ["events", "일정"], ["tasks", "할 일"], ["info", "정보"]] as const;
export type DetailTab = (typeof DETAIL_TABS)[number][0];

export type DetailData = {
  company: CrmCompany;
  contacts: CrmContact[];
  quotes: CrmQuote[];
  tracks: QuoteTrack[];
  events: CrmEvent[];
  activities: CrmActivity[];
  tasks: CrmTask[];
  awards: AwardLite[];
  members: Member[];
  loose: Opt[];
};

const FEED_LABEL: Record<FeedItem["kind"], string> = { meeting: "미팅", call: "통화", email: "메일", memo: "메모", quote: "견적", track: "견적", task: "할 일", award: "단추", contract: "단추" };
const dayHead = (ymd: string, today: string) => (ymd === today ? "오늘" : `${+ymd.slice(5, 7)}월 ${+ymd.slice(8, 10)}일`);

/**
 * 고객사 화면 (0038). 담당자를 고르면(?p=) 기록·견적·일정·할 일이 그 사람으로 좁혀진다.
 * 넓은 화면: 담당자·할 일 | 탭(기록·견적·일정·할 일) | 담당자 정보·다음 일정·보낸 견적.
 * 휴대폰: 담당자 칩 → 탭 다섯(정보 포함) → 바닥 버튼 하나 (탭마다 다른 일).
 */
export function CompanyDetail({ d, scope, tab, paths, opts, now = Date.now() }: { d: DetailData; scope: string | null; tab: DetailTab; paths: CrmPaths; opts: CrmOpts; now?: number }) {
  const c = d.company;
  const today = ymdKst(new Date(now));
  const person = scope ? d.contacts.find((x) => x.id === scope) ?? null : null;
  const pid = person?.id ?? null;
  const has = (ids: (string | null)[]) => !pid || ids.includes(pid);

  // 담당자로 좁히기
  const activities = d.activities.filter((a) => has([a.contact_id, ...a.attendee_contacts]));
  const quotes = d.quotes.filter((q) => has([q.contact_id]));
  const events = d.events.filter((e) => has([e.contact_id, ...e.attendee_contacts]));
  const tasks = d.tasks.filter((t) => has([t.contact_id]));
  const awards = d.awards.filter((w) => !pid || (person?.danchu_key && w.danchuKey === person.danchu_key));
  const qIds = new Set(quotes.map((q) => q.id));
  const feed = buildFeed({ activities, quotes, tracks: d.tracks.filter((t) => qIds.has(t.doc_id)), tasks, awards, contacts: d.contacts, members: d.members });

  const upcoming = events.filter((e) => !e.done_at && ymdKst(e.starts_at) >= today).sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  const pastOpen = events.filter((e) => !e.done_at && ymdKst(e.starts_at) < today && e.kind !== "deadline").sort((x, y) => y.starts_at.localeCompare(x.starts_at));
  const openTasks = tasks.filter((t) => !t.done_at).sort((x, y) => (x.due_on ?? "9").localeCompare(y.due_on ?? "9"));
  const doneTasks = tasks.filter((t) => !!t.done_at).sort((x, y) => (y.done_at ?? "").localeCompare(x.done_at ?? ""));
  const sentAll = d.quotes.filter((q) => q.sent_at || q.status === "sent");
  const wonAll = d.quotes.filter((q) => quoteStage(q) === "won");
  const firstAward = [...d.awards].sort((x, y) => x.awarded_at.localeCompare(y.awarded_at))[0] ?? null;
  const cname = new Map(d.contacts.map((x) => [x.id, x.name]));
  const mname = new Map(d.members.map((m) => [m.id, m.name]));
  const base = `${paths.clients}/${c.id}`;
  const href = (p: { p?: string | null; tab?: string | null }) => qs(base, { p: p.p === undefined ? pid : p.p, tab: (p.tab === undefined ? tab : p.tab) === "log" ? null : p.tab === undefined ? tab : p.tab });
  const counts: Record<DetailTab, number | null> = { log: feed.length, quotes: quotes.length + awards.length, events: upcoming.length, tasks: openTasks.length, info: null };
  const mid: DetailTab = tab === "info" ? "log" : tab;
  const newDoc = qs(paths.newDoc, { company: c.id, contact: pid });
  const lastTouchAt = activities[0]?.occurred_at ?? null;

  const meta = [
    c.industry,
    c.first_deal ? "첫 거래 전" : "",
    firstAward ? `단추에서 선정 ${mdW(ymdKst(firstAward.awarded_at))}` : "",
  ].filter(Boolean);

  // ── 탭 내용 ──
  const LogPane = (
    <>
      <div className="crm-compose only-wide">
        <ActivityForm opts={opts} companyId={c.id} preset={{ contact_id: pid }} compact />
      </div>
      {(upcoming.length > 0 || pastOpen.length > 0) && (
        <section className="crm-sec" aria-label="일정">
          {pastOpen.length > 0 && <h3>지난 일정 · 기록을 남겨 주세요</h3>}
          {pastOpen.slice(0, 2).map((e) => <EventLine key={e.id} e={e} paths={paths} cname={cname} mname={mname} today={today} now={now} opts={opts} companyId={c.id} past />)}
          {upcoming.length > 0 && <h3>다가오는 일정</h3>}
          {upcoming.slice(0, 3).map((e) => <EventLine key={e.id} e={e} paths={paths} cname={cname} mname={mname} today={today} now={now} opts={opts} companyId={c.id} />)}
        </section>
      )}
      {feed.length ? (
        <ol className="crm-feed">
          {feed.map((f, i) => {
            const day = ymdKst(f.at);
            const head = i === 0 || ymdKst(feed[i - 1].at) !== day;
            return (
              <li key={`${f.kind}-${f.ref?.id ?? i}-${f.at}`}>
                {head && <h4 className="crm-day">{dayHead(day, today)}</h4>}
                <div className="crm-it" data-k={f.kind}>
                  <span className="crm-it__k">{FEED_LABEL[f.kind]}</span>
                  <div className="crm-it__b">
                    <b>{f.title}</b>
                    {f.body && <p>{f.body}</p>}
                    {(f.sub || f.by) && <small>{[f.sub, f.by ? `${f.by} 남김` : ""].filter(Boolean).join(" · ")}</small>}
                    {f.ref?.type === "activity" && <ActivityDelete id={f.ref.id} />}
                  </div>
                  <time className="crm-it__t tnum">{hmKst(f.at)}</time>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="crm-empty">
          <b>{person ? `${person.name}님과 남긴 기록이 없어요` : "아직 기록이 없어요"}</b>
          미팅·통화·메일을 남기면 날짜순으로 쌓이고, 보낸 견적과 단추 선정도 여기에 같이 보여요.
        </div>
      )}
    </>
  );

  const QuotesPane = (
    <>
      <div className="crm-sec__h">
        <h3>{person ? `${person.name}님에게 보낸 견적` : "이 고객사 견적"}</h3>
        <SheetButton label="견적서 묶기" title="견적서를 이 고객사에 묶기" className="crm-lk"><QuoteLinkForm companyId={c.id} contactId={pid} loose={d.loose} /></SheetButton>
      </div>
      {quotes.length || awards.length ? (
        <ul className="crm-quotes">
          {quotes.map((q) => {
            const st = quoteStage(q);
            const tr = d.tracks.filter((t) => t.doc_id === q.id).slice(0, 3);
            const dl = q.valid_until && isOpenQuote(q) ? dLabel(q.valid_until, now) : null;
            return (
              <li key={q.id}>
                <div className="crm-q__h">
                  <Link href={`${paths.docs}/${q.id}`}><b>{q.title || q.doc_no}</b></Link>
                  <span className={`crm-st crm-st--${st}`}>{QUOTE_STAGE[st]}</span>
                </div>
                <small className="tnum">
                  {[q.doc_no, wonKo(q.supply), q.sent_at ? `${mdW(ymdKst(q.sent_at))} 보냄` : "", q.contact_id ? `${cname.get(q.contact_id) ?? ""} 앞` : "", q.valid_until ? `${mdW(q.valid_until)}까지` : "", st === "won" && q.contract_amount != null ? `계약 ${wonKo(q.contract_amount)}` : "", st === "lost" && q.lost_reason ? `사유 ${q.lost_reason}` : ""].filter(Boolean).join(" · ")}
                  {dl && dl.n <= 7 && dl.n >= 0 && <span className="crm-warn"> {dl.label}</span>}
                </small>
                {tr.length > 0 && (
                  <ul className="crm-track">
                    {tr.map((t) => <li key={t.id}><time className="tnum">{mdW(ymdKst(t.created_at))}</time> {t.stage ? `${QUOTE_STAGE[t.stage] ?? ""}${t.note ? " · " : ""}` : ""}{t.note}{t.created_by && mname.get(t.created_by) ? <span className="crm-mute"> · {mname.get(t.created_by)}</span> : null}</li>)}
                  </ul>
                )}
                <SheetButton label="진행 바꾸기" title="견적 진행" className="crm-lk"><QuoteStageForm quote={q} opts={opts} /></SheetButton>
              </li>
            );
          })}
          {awards.map((w) => (
            <li key={w.id}>
              <div className="crm-q__h"><b>단추 요청 {w.rfqNo}</b><span className="crm-st crm-st--won">{w.contract_reported_at ? "계약 보고" : "선정"}</span></div>
              <small className="tnum">{[w.substance, `선정 금액 ${wonKo(w.quoteAmount)}`, w.contract_reported_at ? `계약 ${wonKo(w.contract_amount)}` : "계약 결과 보고 남음", `${mdW(ymdKst(w.awarded_at))} 선정`].filter(Boolean).join(" · ")}</small>
              <Link className="crm-lk" href={paths.pipe}>견적 진행에서 보기</Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="crm-empty">
          <b>아직 견적이 없어요</b>
          견적서를 만들면 이 고객사{person ? `와 ${person.name}님` : ""}에게 묶여요. 이미 만든 견적서는 "견적서 묶기"로 가져와요.
        </div>
      )}
    </>
  );

  const EventsPane = (
    <>
      {upcoming.length || pastOpen.length ? (
        <section className="crm-sec">
          {pastOpen.length > 0 && <h3>지난 일정 · 기록을 남겨 주세요</h3>}
          {pastOpen.map((e) => <EventLine key={e.id} e={e} paths={paths} cname={cname} mname={mname} today={today} now={now} opts={opts} companyId={c.id} past full />)}
          {upcoming.length > 0 && <h3>다가오는 일정</h3>}
          {upcoming.map((e) => <EventLine key={e.id} e={e} paths={paths} cname={cname} mname={mname} today={today} now={now} opts={opts} companyId={c.id} full />)}
        </section>
      ) : (
        <div className="crm-empty"><b>잡힌 일정이 없어요</b>미팅·통화 약속이나 회신 기한을 잡으면 캘린더에 함께 올라가고, 전날 아침 9시에 알려요.</div>
      )}
      <p className="crm-hint"><Link href={paths.calendar}>캘린더에서 이번 주 전체 보기</Link></p>
    </>
  );

  const TasksPane = (
    <>
      {openTasks.length ? (
        <ul className="crm-tasks">
          {openTasks.map((t) => (
            <li key={t.id}>
              <TaskCheck id={t.id} title={t.title} done={false} sub={taskSub(t, cname, mname, now)} />
              {t.memo && <p className="crm-task__memo">{t.memo}</p>}
              {(t.actions ?? []).length > 0 && (
                <ul className="crm-track">{(t.actions ?? []).map((a) => <li key={a.id}><time className="tnum">{mdW(ymdKst(a.at))}</time> {a.body}</li>)}</ul>
              )}
              <TaskActionAdd taskId={t.id} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="crm-empty"><b>남은 할 일이 없어요</b>기록을 남길 때 "다음 할 일"을 적거나, 할 일을 바로 추가해요.</div>
      )}
      {doneTasks.length > 0 && (
        <details className="crm-done">
          <summary>끝낸 할 일 {doneTasks.length}</summary>
          <ul className="crm-tasks">{doneTasks.slice(0, 30).map((t) => <li key={t.id}><TaskCheck id={t.id} title={t.title} done sub={`${t.done_at ? mdW(ymdKst(t.done_at)) : ""} 끝냄${t.done_by && mname.get(t.done_by) ? ` · ${mname.get(t.done_by)}` : ""}`} /></li>)}</ul>
        </details>
      )}
    </>
  );

  // ── 오른쪽: 담당자(또는 고객사) 정보 ──
  const next = upcoming.find((e) => e.kind === "meeting" || e.kind === "call") ?? upcoming[0] ?? null;
  const Side = (
    <aside className="crm-r" aria-label={person ? `${person.name} 정보` : "고객사 정보"}>
      {person ? (
        <section className="crm-sec">
          <div className="crm-sec__h">
            <h3>{personLabel(person.name, person.title)}</h3>
            <SheetButton label="고치기" title="담당자 고치기" className="crm-lk"><ContactForm companyId={c.id} contact={person} /></SheetButton>
          </div>
          <dl className="crm-dl">
            {(person.dept || person.role) && <div><dt>소속 · 맡은 일</dt><dd>{[person.dept, person.role ? CONTACT_ROLE[person.role] : ""].filter(Boolean).join(" · ")}</dd></div>}
            <div><dt>이메일</dt><dd className="tnum">{person.email ? <a href={`mailto:${person.email}`}>{person.email}</a> : "-"}</dd></div>
            <div><dt>전화</dt><dd className="tnum crm-phones">{person.phone || person.mobile ? [person.phone, person.mobile].filter(Boolean).map((p) => <a key={p} href={`tel:${p}`}>{p}</a>) : "-"}</dd></div>
            <div><dt>마지막 연락</dt><dd>{lastTouchAt ? `${agoLabel(lastTouchAt, now)} · ${ACT_KIND[activities[0].kind] ?? ""}` : "기록 없음"}</dd></div>
            {person.memo && <div><dt>메모</dt><dd className="crm-pre">{person.memo}</dd></div>}
            {person.danchu_key && <div><dt>출처</dt><dd>단추 요청에서 선정된 의뢰자</dd></div>}
          </dl>
        </section>
      ) : (
        <section className="crm-sec">
          <div className="crm-sec__h">
            <h3>고객사 정보</h3>
            <SheetButton label="고치기" title="고객사 고치기" className="crm-lk"><CompanyForm company={c} /></SheetButton>
          </div>
          <dl className="crm-dl">
            {c.aliases.length > 0 && <div><dt>다른 이름</dt><dd>{c.aliases.join(", ")}</dd></div>}
            {c.biz_no && <div><dt>사업자등록번호</dt><dd className="tnum">{c.biz_no}</dd></div>}
            <div><dt>주소</dt><dd>{c.address || "-"}</dd></div>
            {c.website && <div><dt>웹사이트</dt><dd><a href={c.website} target="_blank" rel="noreferrer noopener">{c.website.replace(/^https?:\/\//, "")}</a></dd></div>}
            <div><dt>견적 누적</dt><dd className="tnum">{sentAll.length}건 · {wonKo(sentAll.reduce((s, q) => s + (q.supply || 0), 0))}</dd></div>
            <div><dt>수주</dt><dd className="tnum">{wonAll.length}건{wonAll.length ? ` · 계약 ${wonKo(wonAll.reduce((s, q) => s + (q.contract_amount ?? q.supply ?? 0), 0))}` : ""}{d.awards.length ? ` · 단추 선정 ${d.awards.length}건` : ""}</dd></div>
            {c.memo && <div><dt>메모</dt><dd className="crm-pre">{c.memo}</dd></div>}
          </dl>
        </section>
      )}
      {next && (
        <section className="crm-next-box" aria-label="다음 일정">
          <small>다음 {EVENT_KIND[next.kind]}</small>
          <b className="tnum">{mdW(ymdKst(next.starts_at))}{next.all_day ? "" : ` ${hmKst(next.starts_at)}`}{next.mode ? ` · ${EVENT_MODE[next.mode]}` : ""}</b>
          <span>{next.title}</span>
          <Link href={qs(paths.calendar, { w: ymdKst(next.starts_at), e: next.id })}>캘린더에서 보기</Link>
        </section>
      )}
      {quotes.length > 0 && (
        <section className="crm-sec only-wide">
          <h3>{person ? `${person.name}님에게 보낸 견적 ${quotes.length}` : `견적 ${quotes.length}`}</h3>
          <ul className="crm-mini">
            {quotes.slice(0, 4).map((q) => {
              const st = quoteStage(q);
              return <li key={q.id}><Link href={qs(base, { p: pid, tab: "quotes" })}><b>{q.title || q.doc_no}</b><span className={`crm-st crm-st--${st}`}>{QUOTE_STAGE[st]}</span></Link><small className="tnum">{q.doc_no} · {wonKo(q.supply)}{q.valid_until ? ` · ${mdW(q.valid_until)}까지` : ""}</small></li>;
            })}
          </ul>
        </section>
      )}
      {!person && <div className="crm-danger only-wide"><CompanyDelete id={c.id} back={paths.clients} /></div>}
    </aside>
  );

  // ── 바닥 버튼 (휴대폰) / 머리 버튼 ──
  const dock: Record<DetailTab, React.ReactNode> = {
    log: <SheetButton label="기록 남기기" title={person ? `${person.name}님 기록` : "기록 남기기"} className="b1 bfull"><ActivityForm opts={opts} companyId={c.id} preset={{ contact_id: pid }} /></SheetButton>,
    quotes: <Link href={newDoc} className="b1 bfull">견적서 만들기</Link>,
    events: <SheetButton label="일정 잡기" title="일정 잡기" className="b1 bfull"><EventForm opts={opts} preset={{ company_id: c.id, contact_id: pid }} /></SheetButton>,
    tasks: <SheetButton label="할 일 추가" title="할 일 추가" className="b1 bfull"><TaskForm opts={opts} companyId={c.id} contactId={pid} /></SheetButton>,
    info: <SheetButton label="담당자 추가" title="담당자 추가" className="b1 bfull"><ContactForm companyId={c.id} /></SheetButton>,
  };

  return (
    <div className="crm-d" data-tab={tab}>
      <header className="crm-d__h">
        <Link href={paths.clients} className="crm-back">‹ 고객사</Link>
        <div className="crm-d__t">
          <div>
            <h1>{c.name}</h1>
            <p className="tnum">
              {meta.join(" · ")}{meta.length ? " · " : ""}견적 누적 <b>{sentAll.length}건 {wonKo(sentAll.reduce((s, q) => s + (q.supply || 0), 0))}</b> · 수주 <b>{wonAll.length}건</b>{d.awards.length ? <> · 단추 선정 <b>{d.awards.length}건</b></> : null}
            </p>
          </div>
          <div className="crm-d__acts only-wide">
            <SheetButton label="일정 잡기" title="일정 잡기" className="b2"><EventForm opts={opts} preset={{ company_id: c.id, contact_id: pid }} /></SheetButton>
            <Link href={newDoc} className="b1">견적서 만들기</Link>
          </div>
        </div>
      </header>

      {/* 휴대폰: 담당자 칩 */}
      <nav className="crm-people only-narrow" aria-label="담당자">
        <Link href={href({ p: null })} aria-current={!pid ? "page" : undefined} scroll={false}>전체</Link>
        {d.contacts.map((x) => <Link key={x.id} href={href({ p: x.id })} aria-current={pid === x.id ? "page" : undefined} scroll={false}>{x.name}</Link>)}
      </nav>
      {person && (
        <div className="crm-tiles only-narrow">
          {person.mobile || person.phone ? <a href={`tel:${person.mobile || person.phone}`}><Phone size={18} aria-hidden="true" /><b>전화</b><span className="tnum">{person.mobile || person.phone}</span></a> : <span><Phone size={18} aria-hidden="true" /><b>전화</b><span>없음</span></span>}
          {person.email ? <a href={`mailto:${person.email}`}><EnvelopeSimple size={18} aria-hidden="true" /><b>메일</b><span>{person.email}</span></a> : <span><EnvelopeSimple size={18} aria-hidden="true" /><b>메일</b><span>없음</span></span>}
          {next ? <Link href={qs(paths.calendar, { w: ymdKst(next.starts_at), e: next.id })}><CalendarBlank size={18} aria-hidden="true" /><b>일정</b><span className="tnum">{mdW(ymdKst(next.starts_at))}</span></Link> : <span><CalendarBlank size={18} aria-hidden="true" /><b>일정</b><span>없음</span></span>}
        </div>
      )}

      <div className="crm-d__cols">
        <aside className="crm-l only-wide" aria-label="담당자와 할 일">
          <section className="crm-sec">
            <div className="crm-sec__h">
              <h3>담당자 {d.contacts.length}</h3>
              <SheetButton label="추가" title="담당자 추가" className="crm-lk"><ContactForm companyId={c.id} /></SheetButton>
            </div>
            <nav className="crm-plist" aria-label="담당자 고르기">
              <Link href={href({ p: null })} aria-current={!pid ? "true" : undefined} scroll={false}><b>전체</b><small className="tnum">기록 {d.activities.length} · 견적 {d.quotes.length}</small></Link>
              {d.contacts.map((x) => (
                <Link key={x.id} href={href({ p: x.id })} aria-current={pid === x.id ? "true" : undefined} scroll={false}>
                  <b>{personLabel(x.name, x.title)}</b>
                  <small>{[x.dept, x.role ? CONTACT_ROLE[x.role] : "", x.danchu_key ? "단추" : ""].filter(Boolean).join(" · ") || " "}</small>
                </Link>
              ))}
            </nav>
            {!d.contacts.length && <p className="crm-hint">담당자를 추가하면 기록과 견적을 사람별로 나눠 봐요.</p>}
          </section>
          <section className="crm-sec">
            <div className="crm-sec__h">
              <h3>할 일 {openTasks.length}</h3>
              <SheetButton label="추가" title="할 일 추가" className="crm-lk"><TaskForm opts={opts} companyId={c.id} contactId={pid} /></SheetButton>
            </div>
            {openTasks.length ? (
              <ul className="crm-tasks">{openTasks.slice(0, 6).map((t) => <li key={t.id}><TaskCheck id={t.id} title={t.title} done={false} sub={taskSub(t, cname, mname, now)} /></li>)}</ul>
            ) : <p className="crm-hint">남은 할 일이 없어요.</p>}
            {openTasks.length > 6 && <Link className="crm-lk" href={href({ tab: "tasks" })}>전체 {openTasks.length}개 보기</Link>}
          </section>
        </aside>

        <article className="crm-m" aria-label={`${c.name} ${DETAIL_TABS.find(([k]) => k === mid)?.[1]}`}>
          <nav className="crm-tabs" aria-label="고객사 화면">
            {DETAIL_TABS.map(([k, l]) => (
              <Link key={k} href={href({ tab: k })} aria-current={tab === k ? "page" : undefined} className={k === "info" ? "only-narrow" : undefined} scroll={false}>
                {l}{counts[k] ? <span className="tnum"> {counts[k]}</span> : null}
              </Link>
            ))}
          </nav>
          <div className="crm-m__pane">
            {mid === "log" && LogPane}
            {mid === "quotes" && QuotesPane}
            {mid === "events" && EventsPane}
            {mid === "tasks" && TasksPane}
          </div>
        </article>

        {Side}
      </div>

      <p className="crm-guard only-wide"><LockSimple size={14} aria-hidden="true" /> 우리 기관 담당자만 봐요. 단추는 이 기록을 요청 전달·비교표·노출에 쓰지 않아요.</p>
      <div className="crm-dock only-narrow">{dock[tab]}</div>
    </div>
  );
}

function taskSub(t: CrmTask, cname: Map<string, string>, mname: Map<string, string>, now: number): string {
  const due = t.due_on ? dLabel(t.due_on, now) : null;
  return [
    due ? (due.n < 0 ? `${mdW(t.due_on as string)} 지남` : due.n === 0 ? "오늘까지" : due.n === 1 ? "내일까지" : `${mdW(t.due_on as string)}까지`) : "기한 없음",
    TASK_CAT[t.category] && t.category !== "other" ? TASK_CAT[t.category] : "",
    t.contact_id ? cname.get(t.contact_id) ?? "" : "",
    t.assignee ? mname.get(t.assignee) ?? "" : "",
  ].filter(Boolean).join(" · ");
}

function EventLine({ e, paths, cname, mname, today, now, opts, companyId, past = false, full = false }: {
  e: CrmEvent; paths: CrmPaths; cname: Map<string, string>; mname: Map<string, string>; today: string; now: number; opts: CrmOpts; companyId: string; past?: boolean; full?: boolean;
}) {
  const day = ymdKst(e.starts_at);
  const dl = dLabel(day, now);
  const ours = e.attendee_members.map((id) => mname.get(id)).filter(Boolean);
  const theirs = [...new Set([e.contact_id, ...e.attendee_contacts].filter(Boolean) as string[])].map((id) => cname.get(id)).filter(Boolean);
  const when = `${mdW(day)}${e.all_day ? "" : ` ${hmKst(e.starts_at)}${e.ends_at ? `~${hmKst(e.ends_at)}` : ""}`}`;
  return (
    <div className="crm-ev" data-past={past ? "1" : "0"}>
      <span className="crm-it__k">{EVENT_KIND[e.kind]}</span>
      <div className="crm-it__b">
        <Link href={qs(paths.calendar, { w: day, e: e.id })}><b>{e.title}</b></Link>
        <small className="tnum">{[when, e.mode ? EVENT_MODE[e.mode] : "", e.location, theirs.join(", "), ours.length ? `우리 ${ours.join(", ")}` : ""].filter(Boolean).join(" · ")}</small>
        {full && e.requests && <p>{e.requests}</p>}
        {full && (
          <span className="crm-ev__acts">
            {past || day <= today ? (
              <SheetButton label="기록 남기기" title={`${e.title} 기록`} className="crm-lk">
                <ActivityForm opts={opts} companyId={companyId} preset={{ event_id: e.id, kind: e.kind === "call" ? "call" : "meeting", date: day, time: e.all_day ? undefined : hmKst(e.starts_at), title: e.title, attendee_contacts: theirs.length ? [...new Set([e.contact_id, ...e.attendee_contacts].filter(Boolean) as string[])] : [], attendee_members: e.attendee_members, quote_doc_id: e.quote_doc_id }} />
              </SheetButton>
            ) : null}
            <SheetButton label="고치기" title="일정 고치기" className="crm-lk"><EventForm opts={opts} event={e} /></SheetButton>
            <a className="crm-lk" href={`${paths.ics}?id=${e.id}`}><DownloadSimple size={14} aria-hidden="true" /> 캘린더 파일</a>
          </span>
        )}
      </div>
      <span className={`crm-it__t tnum${!past && dl.n >= 0 && dl.n <= 3 ? " crm-hl" : ""}`}>{past ? "기록 전" : dl.label}</span>
    </div>
  );
}

