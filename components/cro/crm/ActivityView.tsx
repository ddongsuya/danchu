import Link from "next/link";
import { CalendarBlank, CaretDown, Check, EnvelopeSimple, Handshake, MagnifyingGlass, Microphone, NotePencil, Paperclip, Phone, Plus } from "@phosphor-icons/react/dist/ssr";
import { byDay } from "@/lib/crm-deals";
import { FEED_KINDS, FEED_PERIODS, buildFeed, feedCounts, filterFeed, type FeedItem, type FeedKind, type FeedQuery } from "@/lib/crm-feed";
import { dLabel, hmKst, personLabel, ymdKst } from "@/lib/crm-shape";
import { dayHead } from "./DealView";
import { qs } from "./opts";
import type { CrmCtx } from "./ctx";
import "./crm.css";
import "./layout-crm.css";

const ICON = { call: Phone, email: EnvelopeSimple, meeting: Handshake, memo: NotePencil, task: Check, event: CalendarBlank } as const;
/** 한 번에 보이는 줄 수. ponytail: 넘치면 기간·고객사로 좁힌다. 많아지면 쪽 나누기 */
const FEED_MAX = 200;

/**
 * 활동 (와이어프레임 v7 c-activity). 기관 전체의 통화·메일·미팅·메모, 할 일, 일정, 단추 요청 일을 한 목록에.
 * 거르기는 주소(?k= 종류, co= 고객사, p= 담당자, o= 우리 담당, d= 기간, q= 찾기). 줄을 누르면 안건(없으면 고객사)으로 간다.
 * 기록 남기기는 같은 주소의 ?new=1 (안건에서 오면 ?deal=).
 */
export function ActivityView({ c, q }: { c: CrmCtx; q: FeedQuery }) {
  const { data, paths, now, me } = c;
  const all = buildFeed({ ...data, danchu: c.danchu });
  const scoped = filterFeed(all, { ...q, k: "" }, now);
  const counts = feedCounts(scoped);
  const rows = q.k ? scoped.filter((x) => x.kind === q.k) : scoped;
  const shown = rows.slice(0, FEED_MAX);
  const link = (p: Partial<FeedQuery>) => {
    const v = { ...q, ...p };
    return qs(paths.log, { k: v.k || null, co: v.co || null, p: v.p || null, o: v.o || null, d: v.d === "30" ? null : v.d, q: v.q || null });
  };
  const co = q.co ? data.companies.find((x) => x.id === q.co) ?? null : null;
  const coContacts = co ? data.contacts.filter((x) => x.company_id === co.id) : [];
  const person = q.p ? data.contacts.find((x) => x.id === q.p) ?? null : null;
  const mem = new Map(data.members.map((m) => [m.id, m.name]));
  const companies = [...data.companies].sort((x, y) => x.name.localeCompare(y.name, "ko"));
  const open = scoped.filter((x) => (x.kind === "task" || x.kind === "event") && !x.done).length;
  const withFiles = scoped.filter((x) => x.files > 0).length;
  const href = (x: FeedItem) => (x.dealId ? `${paths.deals}/${x.dealId}` : x.companyId ? `${paths.clients}/${x.companyId}` : x.kind === "event" ? paths.calendar : null);
  return (
    <div className="cx cx-act">
      <header className="cx-ph">
        <div>
          <h1>활동</h1>
          <p className="cx-ph__sub">{FEED_PERIODS[q.d]} <b className="tnum">{scoped.length}건</b> · 남은 할 일·일정 <b className="tnum">{open}건</b> · 첨부 <b className="tnum">{withFiles}건</b></p>
        </div>
        <div className="cx-ph__acts">
          <Link href={paths.calendar} className="b2 bsm"><CalendarBlank size={16} aria-hidden="true" />캘린더</Link>
          <Link href={`${paths.log}?new=1`} className="b1 bsm"><Plus size={16} aria-hidden="true" />기록 남기기</Link>
        </div>
      </header>

      <div className="cx-filters">
        <nav className="cx-seg" aria-label="누구 활동">
          <Link href={link({ o: "" })} aria-current={q.o !== me ? "true" : undefined}>전체</Link>
          <Link href={link({ o: me })} aria-current={q.o === me ? "true" : undefined}>내 활동</Link>
        </nav>
        <details className="cx-dd">
          <summary>{co?.name ?? "고객사"}<CaretDown size={14} aria-hidden="true" /></summary>
          <ul className="cx-dd__scroll">
            <li><Link href={link({ co: "", p: "" })}>전체</Link></li>
            {companies.map((x) => <li key={x.id}><Link href={link({ co: x.id, p: "" })} aria-current={q.co === x.id ? "true" : undefined}>{x.name}</Link></li>)}
          </ul>
        </details>
        {co && coContacts.length > 0 && (
          <details className="cx-dd">
            <summary>{person ? personLabel(person.name, person.title) : "담당자"}<CaretDown size={14} aria-hidden="true" /></summary>
            <ul>
              <li><Link href={link({ p: "" })}>전체</Link></li>
              {coContacts.map((x) => <li key={x.id}><Link href={link({ p: x.id })} aria-current={q.p === x.id ? "true" : undefined}>{personLabel(x.name, x.title)}</Link></li>)}
            </ul>
          </details>
        )}
        {q.o && q.o !== me && mem.has(q.o) && <Link className="cx-pill" href={link({ o: "" })} aria-current="true">담당 {mem.get(q.o)}</Link>}
        <details className="cx-dd">
          <summary>{FEED_PERIODS[q.d]}<CaretDown size={14} aria-hidden="true" /></summary>
          <ul>{(Object.keys(FEED_PERIODS) as FeedQuery["d"][]).map((d) => <li key={d}><Link href={link({ d })} aria-current={q.d === d ? "true" : undefined}>{d === "all" ? FEED_PERIODS[d] : `앞뒤 ${FEED_PERIODS[d]}`}</Link></li>)}</ul>
        </details>
        <form className="cx-search" action={paths.log} role="search">
          {(["k", "co", "p", "o"] as const).map((k) => q[k] ? <input key={k} type="hidden" name={k} value={q[k]} /> : null)}
          {q.d !== "30" && <input type="hidden" name="d" value={q.d} />}
          <MagnifyingGlass size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor="act-q">고객사·담당자·내용 찾기</label>
          <input id="act-q" name="q" defaultValue={q.q} placeholder="고객사, 담당자, 내용 찾기" maxLength={60} />
        </form>
      </div>

      <nav className="cx-filters cx-kinds" aria-label="활동 종류">
        <Link className="cx-pill" href={link({ k: "" })} aria-current={!q.k ? "true" : undefined}>전체 <b className="tnum">{scoped.length}</b></Link>
        {(Object.keys(FEED_KINDS) as FeedKind[]).map((k) => (
          <Link key={k} className="cx-pill" href={link({ k })} aria-current={q.k === k ? "true" : undefined}>{FEED_KINDS[k]} <b className="tnum">{counts[k]}</b></Link>
        ))}
      </nav>

      {shown.length ? (
        <div className="cx-grp cx-feedwrap">
          {byDay(shown).map((g) => (
            <section key={g.day} aria-label={dayHead(g.day, now)}>
              <h2 className="cx-tl__day">{dayHead(g.day, now)}{g.day > ymdKst(new Date(now)) && <span className="cx-muted"> · 예정</span>}</h2>
              <ol className="cx-feed">
                {g.items.map((x) => <FeedRow key={x.key} x={x} href={href(x)} owner={x.owner ? mem.get(x.owner) ?? null : null} now={now} />)}
              </ol>
            </section>
          ))}
          {rows.length > FEED_MAX && <p className="cx-cap">최근 {FEED_MAX}건까지 보여요. 기간이나 고객사로 좁혀 주세요.</p>}
        </div>
      ) : all.length ? <p className="cx-none">조건에 맞는 활동이 없어요.</p> : (
        <section className="cx-empty">
          <h2>아직 활동이 없어요</h2>
          <div className="cx-ph__acts"><Link className="b1 bsm" href={`${paths.log}?new=1`}>기록 남기기</Link></div>
        </section>
      )}
      <Link href={`${paths.log}?new=1`} className="b1 cx-mfab only-narrow">기록 남기기</Link>
    </div>
  );
}

function FeedRow({ x, href, owner, now }: { x: FeedItem; href: string | null; owner: string | null; now: number }) {
  const I = x.kind === "danchu" ? null : ICON[x.kind];
  const due = x.kind === "task" && !x.done && x.allDay ? dLabel(ymdKst(x.at), now) : null;
  const inner = (
    <>
      <span className={`cx-ev__dot${x.kind === "danchu" ? " cx-ev__dot--d" : ""}`} aria-hidden="true">{I ? <I size={15} /> : "단"}</span>
      <span className="cx-feed__bd">
        <span className="cx-feed__h">
          <span className="cx-feed__k">{FEED_KINDS[x.kind]}</span>
          {x.company && <b>{x.company}</b>}
          <span className="cx-feed__t">{x.title}</span>
        </span>
        <span className="cx-feed__s">{[x.people.join(", "), x.sub, owner ? `우리 쪽 ${owner}` : ""].filter(Boolean).join(" · ")}</span>
        {x.body && <span className="cx-feed__b">{x.body}</span>}
      </span>
      <span className="cx-feed__end">
        {x.audio && <span className="cx-chip"><Microphone size={12} aria-hidden="true" />녹음</span>}
        {x.files > 0 && <span className="cx-chip tnum" aria-label={`첨부 ${x.files}개`}><Paperclip size={12} aria-hidden="true" />{x.files}</span>}
        {x.done && <span className="cx-chip">끝냄</span>}
        {due && <span className={due.n < 0 ? "cx-flag cx-flag--warn" : "cx-chip"}>{due.label}</span>}
        {!(x.kind === "task" && x.allDay) && <time className="cx-ev__tm tnum" dateTime={x.at}>{x.allDay ? "종일" : hmKst(x.at)}</time>}
      </span>
    </>
  );
  return <li className="cx-feed__row" data-k={x.kind} data-done={x.done ? "1" : "0"}>{href ? <Link href={href} className="cx-feed__a">{inner}</Link> : <div className="cx-feed__a">{inner}</div>}</li>;
}
