import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight, EnvelopeSimple, NotePencil, PencilSimple, Phone } from "@phosphor-icons/react/dist/ssr";
import { STAGE_LABEL, amountLabel, buildTimeline, byDay, closedLabel, type Stage } from "@/lib/crm-deals";
import { CONTACT_ROLE, agoLabel, mdW, personLabel, wonKo, ymdKst } from "@/lib/crm-shape";
import { contactStats, forContact, quoteRows } from "@/lib/crm-analysis";
import { ContactForm, SheetButton } from "./forms";
import { TimelineRow, dayHead } from "./DealView";
import { QuoteTable } from "./quotes-ui";
import { rowsOf, type CrmCtx } from "./ctx";
import "./crm.css";
import "./layout-crm.css";

const SRC: Record<string, string> = { manual: "직접 추가", danchu: "단추 선정", import: "엑셀 가져오기", mail: "메일" };

/**
 * 담당자 화면 (와이어프레임 v7 c-contact). 고객사 담당자 한 명에게 보낸 견적과 결과, 그 사람이 붙은 안건, 주고받은 기록을 한 화면에.
 * 기록은 고객사 화면의 ?p= 와 같은 규칙 (lib/crm-analysis.ts forContact): 그 사람이 상대였거나 참석한 기록, 그 사람 앞 견적서, 맡은 안건의 단계·단추 일.
 */
export function ContactView({ c, companyId, contactId }: { c: CrmCtx; companyId: string; contactId: string }) {
  const { data, paths, now } = c;
  const co = data.companies.find((x) => x.id === companyId);
  const person = data.contacts.find((x) => x.id === contactId && x.company_id === companyId);
  if (!co || !person) notFound();
  const rows = rowsOf(c).filter((r) => r.deal.company_id === co.id);
  const coDeals = rows.map((r) => r.deal);
  const dealIds = new Set(coDeals.map((d) => d.id));
  const coActs = data.activities.filter((a) => a.company_id === co.id || (a.deal_id && dealIds.has(a.deal_id)));
  const coQuotes = data.quotes.filter((q) => q.company_id === co.id || (q.deal_id && dealIds.has(q.deal_id)));
  const only = forContact(person.id, { activities: coActs, quotes: coQuotes, deals: coDeals });
  const s = contactStats({ contacts: [person], deals: coDeals, quotes: coQuotes, activities: coActs, history: data.history, danchu: c.danchu }).get(person.id)!;
  const qIds = new Set(only.quotes.map((q) => q.id));
  const qRows = quoteRows({ quotes: coQuotes, deals: coDeals, history: data.history, danchu: c.danchu, docs: paths.docs })
    .filter((r) => (r.docId ? qIds.has(r.docId) : !!r.dealId && only.dealIds.has(r.dealId)));
  const danchu = only.deals.filter((d) => d.invite_id && c.danchu.has(d.invite_id)).map((d) => ({ dealId: d.id, src: c.danchu.get(d.invite_id as string)!, contacts: d.contact_ids.length }));
  const tl = buildTimeline({
    activities: only.activities, history: data.history.filter((h) => only.dealIds.has(h.deal_id) && h.actor !== "danchu"), quotes: only.quotes,
    tasks: [], contacts: data.contacts, members: data.members, danchu, deals: coDeals,
  }).slice(0, 80);
  const myRows = rows.filter((r) => only.dealIds.has(r.deal.id)).sort((x, y) => (x.deal.status === "open" ? 0 : 1) - (y.deal.status === "open" ? 0 : 1) || (y.deal.closed_at ?? y.deal.updated_at).localeCompare(x.deal.closed_at ?? x.deal.updated_at));
  const openDeal = myRows.find((r) => r.deal.status === "open");
  const name = personLabel(person.name, person.title);
  const sub = [person.dept, person.role ? CONTACT_ROLE[person.role] : ""].filter(Boolean).join(" · ");
  const tel = person.mobile || person.phone;
  return (
    <div className="cx cx-ct">
      <nav className="crumb cx-crumb" aria-label="위치">
        <Link href={paths.clients}>고객사</Link><CaretRight size={12} aria-hidden="true" />
        <Link href={`${paths.clients}/${co.id}?tab=people`}>{co.name}</Link><CaretRight size={12} aria-hidden="true" /><span>{name}</span>
      </nav>
      <header className="cx-dh">
        <div>
          <h1>{name}</h1>
          <p className="cx-dh__sub"><Link href={`${paths.clients}/${co.id}`} className="cx-tlink">{co.name}</Link>{sub && <span>{sub}</span>}</p>
        </div>
        <div className="cx-ph__acts">
          {tel && <a href={`tel:${tel.replace(/[^0-9+]/g, "")}`} className="b2 bsm"><Phone size={16} aria-hidden="true" />전화</a>}
          {person.email && <a href={`mailto:${person.email}`} className="b2 bsm"><EnvelopeSimple size={16} aria-hidden="true" />메일</a>}
          <SheetButton className="b2 bsm" title="담당자 고치기" label={<><PencilSimple size={16} aria-hidden="true" />고치기</>}><ContactForm companyId={co.id} contact={person} /></SheetButton>
          {openDeal && <Link href={`${paths.log}?deal=${openDeal.deal.id}`} className="b1 bsm"><NotePencil size={16} aria-hidden="true" />기록 남기기</Link>}
        </div>
      </header>

      <dl className="cx-stats">
        <div><dt>받은 견적</dt><dd className="tnum">{qRows.filter((r) => r.sentAt).length}건</dd></div>
        <div><dt>진행 중</dt><dd className="tnum">{s.open}건</dd></div>
        <div><dt>수주 · 실패</dt><dd className="tnum">{s.won} · {s.lost}</dd></div>
        <div><dt>계약 금액</dt><dd className="tnum">{s.wonSum ? wonKo(s.wonSum) : "-"}{s.contracted ? <small>{s.contracted}건 계약</small> : null}</dd></div>
      </dl>

      <div className="cx-2col">
        <div className="cx-main">
          <section className="cx-grp" aria-labelledby="ct-qt">
            <div className="cx-grp__h"><h2 id="ct-qt">받은 견적</h2><span className="cx-grp__end tnum">{qRows.length}건</span></div>
            <QuoteTable rows={qRows} people={new Map()} noPerson deals={new Map(coDeals.map((d) => [d.id, [d.title, `${paths.deals}/${d.id}`]]))}
              empty={<>{person.name}님 앞으로 보낸 견적서가 없어요.</>} />
          </section>

          <section className="cx-grp" aria-labelledby="ct-tl">
            <div className="cx-grp__h"><h2 id="ct-tl">주고받은 기록</h2><span className="cx-grp__end tnum">{s.lastAt ? `마지막 연락 ${agoLabel(s.lastAt, now)}` : "연락 기록 없음"}</span></div>
            {tl.length ? (
              <div className="cx-tl cx-tl--compact">
                {byDay(tl).map((g) => (
                  <section key={g.day} aria-label={dayHead(g.day, now)}>
                    <h3 className="cx-tl__day">{dayHead(g.day, now)}</h3>
                    <ol>{g.items.map((x, i) => <TimelineRow key={`${x.at}-${i}`} x={x} clip={240} />)}</ol>
                  </section>
                ))}
              </div>
            ) : <p className="cx-none">{person.name}님과의 기록이 아직 없어요. 안건 화면에서 통화·미팅을 남길 때 이 사람을 고르면 여기에 모여요.</p>}
          </section>
        </div>

        <aside className="cx-aside" aria-label="연락처와 안건">
          <section className="cx-grp" aria-labelledby="ct-info">
            <div className="cx-grp__h"><h2 id="ct-info">연락처</h2></div>
            <dl className="cx-props">
              {person.email && <div><dt>메일</dt><dd><a href={`mailto:${person.email}`} className="cx-lk">{person.email}</a></dd></div>}
              {person.mobile && <div><dt>휴대폰</dt><dd className="tnum">{person.mobile}</dd></div>}
              {person.phone && <div><dt>전화</dt><dd className="tnum">{person.phone}</dd></div>}
              {person.dept && <div><dt>부서</dt><dd>{person.dept}</dd></div>}
              {person.role && <div><dt>역할</dt><dd>{CONTACT_ROLE[person.role]}</dd></div>}
              <div><dt>들어온 곳</dt><dd>{SRC[person.source] ?? "직접 추가"} · {mdW(ymdKst(person.created_at))}</dd></div>
              {person.memo && <div><dt>메모</dt><dd className="cx-pre">{person.memo}</dd></div>}
            </dl>
          </section>
          <section className="cx-grp" aria-labelledby="ct-deals">
            <div className="cx-grp__h"><h2 id="ct-deals">맡은 안건</h2><span className="cx-grp__end tnum">{myRows.length}건</span></div>
            {myRows.length ? (
              <ul className="cx-ctdeals">
                {myRows.map((r) => (
                  <li key={r.deal.id}>
                    <Link href={`${paths.deals}/${r.deal.id}`} className="cx-tlink">{r.deal.title}</Link>
                    <span className="cx-ctdeals__m">
                      {r.deal.status === "open" ? <span className="cx-st">{STAGE_LABEL[r.deal.stage as Stage]}</span> : <span className={`cx-st cx-st--${r.deal.status}`}>{closedLabel(r.deal)}</span>}
                      <span className="tnum">{amountLabel(r.deal.status === "won" ? r.deal.won_amount ?? r.deal.amount : r.deal.amount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="cx-muted cx-small">이 사람이 붙은 안건이 없어요.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
