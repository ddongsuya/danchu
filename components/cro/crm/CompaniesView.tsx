import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight, EnvelopeSimple, MagnifyingGlass, PencilSimple, Phone, Plus, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { COMPANY_FILTERS, STAGE_LABEL, amountLabel, buildTimeline, byDay, companyRows, filterCompanies, nextLabel, type CompanyFilter, type Stage, closedLabel } from "@/lib/crm-deals";
import { CONTACT_ROLE, agoLabel, duplicatePairs, mdW, personLabel, todayKst, wonKo, ymdKst } from "@/lib/crm-shape";
import { contactStats, forContact, quoteRows } from "@/lib/crm-analysis";
import { QuoteTable } from "./quotes-ui";
import { CompanyDelete, CompanyForm, ContactForm, MergeButton, SheetButton } from "./forms";
import { DealForm } from "./deal-ui";
import { TimelineRow, dayHead } from "./DealView";
import { buildOpts, qs } from "./opts";
import { rowsOf, type CrmCtx } from "./ctx";
import "./crm.css";
import "./layout-crm.css";

export type CompaniesQuery = { f: CompanyFilter; q: string };
export const parseCompaniesQuery = (sp: Record<string, string | undefined>): CompaniesQuery => ({
  f: (sp.f && sp.f in COMPANY_FILTERS ? sp.f : "all") as CompanyFilter,
  q: (sp.q ?? "").slice(0, 60),
});

/** 고객사 목록. 진행 중 안건이 있는 곳부터, 다음은 최근 연락 순 */
export function CompaniesView({ c, q }: { c: CrmCtx; q: CompaniesQuery }) {
  const { data, paths, now } = c;
  const all = companyRows({ companies: data.companies, contacts: data.contacts, deals: data.deals, activities: data.activities, members: data.members, now });
  const rows = filterCompanies(all, q.f, q.q);
  const name = new Map(data.companies.map((x) => [x.id, x.name]));
  const dups = duplicatePairs(data.companies).slice(0, 3);
  const members = data.members.map((m) => ({ id: m.id, name: m.name }));
  const count = (f: CompanyFilter) => filterCompanies(all, f, "").length;
  return (
    <div className="cx">
      <header className="cx-ph">
        <div>
          <h1>고객사</h1>
          <p className="cx-ph__sub"><b className="tnum">{data.companies.length}곳</b> · 담당자 <b className="tnum">{data.contacts.length}명</b> · 진행 중 안건이 있는 곳 <b className="tnum">{all.filter((r) => r.open).length}곳</b></p>
        </div>
        <div className="cx-ph__acts">
          <Link href={paths.import} className="b2 bsm"><UploadSimple size={16} aria-hidden="true" />엑셀 가져오기</Link>
          <SheetButton className="b1 bsm" title="고객사 추가" label={<><Plus size={16} aria-hidden="true" />고객사 추가</>}><CompanyForm members={members} /></SheetButton>
        </div>
      </header>
      {dups.length > 0 && (
        <div className="cx-banner cx-banner--warn" role="status">
          <span>이름이 같아 보이는 고객사가 있어요.</span>
          {dups.map(([a, b]) => <span key={`${a}${b}`} className="cx-dup"><b>{name.get(a)}</b> · <b>{name.get(b)}</b> <MergeButton keep={a} drop={b} label="하나로 합치기" /></span>)}
        </div>
      )}
      <div className="cx-filters">
        <nav className="cx-seg" aria-label="고객사 거르기">
          {(Object.keys(COMPANY_FILTERS) as CompanyFilter[]).map((f) => (
            <Link key={f} href={qs(paths.clients, { f: f === "all" ? null : f, q: q.q })} aria-current={q.f === f ? "true" : undefined}>{COMPANY_FILTERS[f]} <span className="tnum cx-muted">{count(f)}</span></Link>
          ))}
        </nav>
        <form className="cx-search" action={paths.clients} role="search">
          {q.f !== "all" && <input type="hidden" name="f" value={q.f} />}
          <MagnifyingGlass size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor="co-q">고객사·담당자 찾기</label>
          <input id="co-q" name="q" defaultValue={q.q} placeholder="고객사, 담당자 찾기" maxLength={60} />
        </form>
        <span className="cx-count tnum">{rows.length}곳</span>
      </div>
      {rows.length ? (
        <div className="cx-tablewrap">
          <table className="cx-table cx-table--co">
            <thead><tr><th>고객사</th><th>담당자</th><th className="r">진행 중 안건</th><th>마지막 연락</th><th>담당 영업</th><th className="r">누적 계약</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.company.id}>
                  <td><Link href={`${paths.clients}/${r.company.id}`} className="cx-tlink">{r.company.name}</Link>{r.danchu && <span className="cx-d cx-d--s" title="단추에서 온 고객" aria-label="단추에서 온 고객">단</span>}{r.company.industry && <small className="cx-muted"> · {r.company.industry}</small>}</td>
                  <td>{r.lead ?? <span className="cx-muted">-</span>}{r.contacts > 1 && <span className="cx-muted"> 외 {r.contacts - 1}명</span>}</td>
                  <td className="r tnum">{r.open ? `${r.open}건 · ${wonKo(r.openSum)}` : <span className="cx-muted">없음</span>}</td>
                  <td className="tnum">{r.lastAt ? <span className={r.quiet ? "cx-flag cx-flag--warn" : ""}>{agoLabel(r.lastAt, now)}</span> : <span className="cx-muted">기록 없음</span>}</td>
                  <td>{r.owner ?? <span className="cx-muted">-</span>}</td>
                  <td className="r tnum">{r.wonSum ? wonKo(r.wonSum) : <span className="cx-muted">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data.companies.length ? <p className="cx-none">조건에 맞는 고객사가 없어요.</p> : (
        <section className="cx-empty">
          <h2>아직 고객사가 없어요</h2>
          <p>단추 요청에서 선정되면 의뢰자 회사와 담당자가 자동으로 들어와요.</p>
          <div className="cx-ph__acts"><Link className="b2" href={paths.import}>엑셀 가져오기</Link></div>
        </section>
      )}
    </div>
  );
}

const TL_FILTERS = { all: "전체", meeting: "미팅만", call: "통화만" } as const;
type CoTab = "info" | "people" | "quotes" | "acts";
const CO_TABS: [CoTab, string][] = [["info", "개요"], ["people", "담당자"], ["quotes", "견적·계약"], ["acts", "기록"]];
type TlFilter = keyof typeof TL_FILTERS;

/**
 * 고객사 화면 (와이어프레임 v7). 개요(숫자 줄 · 안건 · 최근 기록 | 담당자 · 회사 정보) · 담당자(담당자별 성과) · 기록 세 탭. ?tab=people|acts
 * ?p=<담당자 id> 면 기록을 그 담당자와 주고받은 것(기록·보낸 견적서·그 사람이 붙은 안건의 단계와 단추 일)으로 좁힌다.
 */
export function CompanyView({ c, id, t, p, v }: { c: CrmCtx; id: string; t?: string; p?: string; v?: string }) {
  const { data, paths, now, me } = c;
  const co = data.companies.find((x) => x.id === id);
  if (!co) notFound();
  const tf: TlFilter = t && t in TL_FILTERS ? (t as TlFilter) : "all";
  const row = companyRows({ companies: [co], contacts: data.contacts, deals: data.deals, activities: data.activities, members: data.members, now })[0];
  const rows = rowsOf(c).filter((r) => r.deal.company_id === co.id).sort((x, y) => (x.deal.status === "open" ? 0 : 1) - (y.deal.status === "open" ? 0 : 1) || (y.deal.closed_at ?? y.deal.updated_at).localeCompare(x.deal.closed_at ?? x.deal.updated_at));
  const dealIds = new Set(rows.map((r) => r.deal.id));
  const contacts = data.contacts.filter((x) => x.company_id === co.id);
  const person = p ? contacts.find((x) => x.id === p) ?? null : null;
  const coActs = data.activities.filter((a) => a.company_id === co.id || (a.deal_id && dealIds.has(a.deal_id)));
  const coQuotes = data.quotes.filter((q) => q.company_id === co.id || (q.deal_id && dealIds.has(q.deal_id)));
  const coDeals = rows.map((r) => r.deal);
  const stats = contactStats({ contacts, deals: coDeals, quotes: coQuotes, activities: coActs, history: data.history, danchu: c.danchu });
  // 담당자 한 명을 고르면 그 사람과의 일만, 아니면 회사 전체
  const only = person ? forContact(person.id, { activities: coActs, quotes: coQuotes, deals: coDeals }) : null;
  const tlDeals = only ? only.deals : coDeals;
  const acts = (only ? only.activities : coActs).filter((a) => tf === "all" || a.kind === tf);
  const danchu = tf === "all" ? tlDeals.filter((d) => d.invite_id && c.danchu.has(d.invite_id)).map((d) => ({ dealId: d.id, src: c.danchu.get(d.invite_id as string)!, contacts: d.contact_ids.length })) : [];
  const tl = buildTimeline({
    activities: acts, history: only && tf === "all" ? data.history.filter((h) => only.dealIds.has(h.deal_id) && h.actor !== "danchu") : [], quotes: tf === "all" ? (only ? only.quotes : coQuotes) : [],
    tasks: [], contacts: data.contacts, members: data.members, danchu, deals: coDeals,
  }).slice(0, only ? 80 : 40);
  const tlHref = (k: TlFilter, who: string | null = person?.id ?? null) => qs(`${paths.clients}/${co.id}`, { tab: "acts", t: k === "all" ? null : k, p: who });
  const opts = buildOpts({ ...data, me });
  const members = data.members.map((m) => ({ id: m.id, name: m.name }));
  const lastWith = (cid: string) => data.activities.filter((a) => a.contact_id === cid || a.attendee_contacts.includes(cid)).sort((x, y) => y.occurred_at.localeCompare(x.occurred_at))[0];
  const SRC = { manual: "직접 추가", danchu: "단추 선정", import: "엑셀 가져오기" } as Record<string, string>;
  const tab: CoTab = v === "people" || v === "acts" || v === "quotes" ? v : (t || p) && v !== "info" ? "acts" : "info";
  const qRows = quoteRows({ quotes: coQuotes, deals: coDeals, history: data.history, danchu: c.danchu, docs: paths.docs });
  const people = new Map(contacts.map((x) => [x.id, personLabel(x.name, x.title)]));
  const contactHref = (cid: string) => `${paths.clients}/${co.id}/contacts/${cid}`;
  const tabHref = (k: CoTab) => qs(`${paths.clients}/${co.id}`, { tab: k === "info" ? null : k });
  const recent = tl.slice(0, 5);
  const sub = [co.industry, row.owner ? `담당 영업 ${row.owner}` : ""].filter(Boolean).join(" · ");
  return (
    <div className="cx cx-co">
      <nav className="crumb cx-crumb" aria-label="위치"><Link href={paths.clients}>고객사</Link><CaretRight size={12} aria-hidden="true" /><span>{co.name}</span></nav>
      <header className="cx-dh">
        <div>
          <h1>{co.name}</h1>
          {sub && <p className="cx-dh__sub">{sub}</p>}
        </div>
        <div className="cx-ph__acts">
          <SheetButton className="b2 bsm" title="고객사 고치기" label={<><PencilSimple size={16} aria-hidden="true" />고치기</>}>
            <CompanyForm company={co} members={members} />
            <div className="cx-del"><CompanyDelete id={co.id} back={paths.clients} /></div>
          </SheetButton>
          <SheetButton className="b1 bsm" title="안건 만들기" label={<><Plus size={16} aria-hidden="true" />안건 만들기</>}><DealForm opts={opts} base={paths.deals} preset={{ company_id: co.id }} /></SheetButton>
        </div>
      </header>

      <nav className="cx-tabs2 cx-cotabs" aria-label="고객사 화면">
        {CO_TABS.map(([k, label]) => (
          <Link key={k} href={tabHref(k)} scroll={false} aria-current={tab === k ? "page" : undefined}>
            {label}{k === "people" ? <span className="tnum">{contacts.length}</span> : k === "info" ? <span className="tnum">{rows.length}</span> : k === "quotes" ? <span className="tnum">{qRows.length}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "info" && (
        <>
          <dl className="cx-stats">
            <div><dt>진행 중</dt><dd className="tnum">{row.open ? <>{row.open}건<small>{wonKo(row.openSum)}</small></> : "없음"}</dd></div>
            <div><dt>누적 계약</dt><dd className="tnum">{row.wonSum ? wonKo(row.wonSum) : "-"}</dd></div>
            <div><dt>수주 · 실패</dt><dd className="tnum">{row.won} · {row.lost}</dd></div>
            <div><dt>첫 거래</dt><dd className="tnum">{row.firstOn ? `${row.firstOn.slice(0, 4)}년 ${+row.firstOn.slice(5, 7)}월` : "-"}</dd></div>
          </dl>
          <div className="cx-2col">
            <div className="cx-main">
              <section className="cx-grp" aria-labelledby="co-deals">
                <div className="cx-grp__h"><h2 id="co-deals">안건</h2><span className="cx-grp__end tnum">{rows.length}건</span></div>
                {rows.length ? (
                  <div className="cx-tablewrap cx-tablewrap--flat">
                    <table className="cx-table cx-table--cd">
                      <thead><tr><th>안건</th><th>단계</th><th>다음 할 일</th><th>담당자</th><th className="r">금액</th></tr></thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.deal.id} data-past={r.deal.status === "open" ? "0" : "1"}>
                            <td><Link href={`${paths.deals}/${r.deal.id}`} className="cx-tlink">{r.deal.title}</Link></td>
                            <td>{r.deal.status === "open" ? <span className="cx-st cx-st--open">{STAGE_LABEL[r.deal.stage as Stage]}</span> : <span className={`cx-st cx-st--${r.deal.status}`}>{closedLabel(r.deal)}</span>}</td>
                            <td className="tnum">{r.deal.status === "open" ? nextLabel(r.next, now) || <span className="cx-flag cx-flag--warn">다음 할 일 없음</span> : <span className="cx-muted">{r.deal.closed_at ? ymdKst(r.deal.closed_at).slice(0, 7).replace("-", ".") : ""}</span>}</td>
                            <td>{r.contact ?? <span className="cx-muted">-</span>}{r.contactMore ? <span className="cx-muted"> 외 {r.contactMore}명</span> : null}</td>
                            <td className="r tnum">{amountLabel(r.deal.status === "won" ? r.deal.won_amount ?? r.deal.amount : r.deal.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="cx-none">이 고객사의 안건이 없어요.</p>}
              </section>

              <section className="cx-grp" aria-labelledby="co-recent">
                <div className="cx-grp__h"><h2 id="co-recent">최근 기록</h2><span className="cx-grp__end"><Link href={tabHref("acts")} scroll={false} className="cx-lk">전체 기록</Link></span></div>
                {recent.length ? (
                  <div className="cx-tl cx-tl--compact">
                    {byDay(recent).map((g) => (
                      <section key={g.day} aria-label={dayHead(g.day, now)}>
                        <h3 className="cx-tl__day">{dayHead(g.day, now)}</h3>
                        <ol>{g.items.map((x, i) => <TimelineRow key={`${x.at}-${i}`} x={x} clip={120} />)}</ol>
                      </section>
                    ))}
                  </div>
                ) : <p className="cx-none">아직 기록이 없어요.</p>}
              </section>
            </div>

            <aside className="cx-aside" aria-label="담당자와 회사 정보">
              <section className="cx-grp" aria-labelledby="co-ppl-s">
                <div className="cx-grp__h"><h2 id="co-ppl-s">담당자 <span className="cx-muted tnum cx-small">{contacts.length}명</span></h2>
                  <span className="cx-grp__end"><SheetButton className="cx-lk cx-rail__add" title="담당자 추가" label={<><Plus size={13} aria-hidden="true" />추가</>}><ContactForm companyId={co.id} /></SheetButton></span>
                </div>
                {contacts.length ? (
                  <ul className="cx-ppl">
                    {contacts.map((x) => {
                      const last = lastWith(x.id);
                      return (
                        <li key={x.id}>
                          <span className="cx-av" aria-hidden="true">{x.name.slice(0, 1)}</span>
                          <span className="cx-ppl__x">
                            <b><Link href={contactHref(x.id)} className="cx-tlink">{personLabel(x.name, x.title)}</Link></b>
                            <small>{[x.dept, x.role ? CONTACT_ROLE[x.role] : "", x.danchu_key ? "단추에서 들어옴" : "", last ? (ymdKst(last.occurred_at) === todayKst(now) ? "오늘 연락" : `${mdW(ymdKst(last.occurred_at))} 연락`) : ""].filter(Boolean).join(" · ")}</small>
                          </span>
                          <span className="cx-ppl__ico">
                            {(x.mobile || x.phone) && <a href={`tel:${(x.mobile || x.phone).replace(/[^0-9+]/g, "")}`} className="cx-icon" aria-label={`${x.name}에게 전화`}><Phone size={16} aria-hidden="true" /></a>}
                            {x.email && <a href={`mailto:${x.email}`} className="cx-icon" aria-label={`${x.name}에게 메일`}><EnvelopeSimple size={16} aria-hidden="true" /></a>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="cx-muted cx-small">담당자가 없어요.</p>}
              </section>
              <section className="cx-grp" aria-labelledby="co-info">
                <div className="cx-grp__h"><h2 id="co-info">회사 정보</h2></div>
                <dl className="cx-props">
                  {co.industry && <div><dt>업종</dt><dd>{co.industry}</dd></div>}
                  {co.biz_no && <div><dt>사업자번호</dt><dd className="tnum">{co.biz_no}</dd></div>}
                  {co.aliases.length > 0 && <div><dt>다른 표기</dt><dd>{co.aliases.join(", ")}</dd></div>}
                  {co.email_domain && <div><dt>메일 도메인</dt><dd>{co.email_domain}</dd></div>}
                  {co.address && <div><dt>주소</dt><dd>{co.address}</dd></div>}
                  {co.website && <div><dt>홈페이지</dt><dd><a href={/^https?:\/\//.test(co.website) ? co.website : `https://${co.website}`} target="_blank" rel="noreferrer" className="cx-lk">{co.website.replace(/^https?:\/\//, "")}</a></dd></div>}
                  <div><dt>담당 영업</dt><dd>{row.owner ?? <span className="cx-muted">정하지 않음</span>}</dd></div>
                  <div><dt>들어온 곳</dt><dd>{SRC[co.source] ?? "직접 추가"} · {mdW(ymdKst(co.created_at))}</dd></div>
                  {co.memo && <div><dt>메모</dt><dd className="cx-pre">{co.memo}</dd></div>}
                </dl>
              </section>
            </aside>
          </div>
        </>
      )}

      {tab === "people" && (
        contacts.length ? (
          <div className="cx-tablewrap">
            <table className="cx-table cx-table--ppl">
              <thead><tr><th>담당자</th><th className="r">보낸 견적</th><th className="r">진행</th><th className="r">수주 · 실패</th><th className="r">계약</th><th className="r">계약 금액</th><th>마지막 연락</th><th><span className="sr-only">기록</span></th></tr></thead>
              <tbody>
                {contacts.map((x) => {
                  const s = stats.get(x.id)!;
                  return (
                    <tr key={x.id}>
                      <td><Link href={contactHref(x.id)} className="cx-tlink">{personLabel(x.name, x.title)}</Link>{x.role && <small className="cx-muted"> · {CONTACT_ROLE[x.role]}</small>}{x.dept && <small className="cx-muted cx-cellsub">{x.dept}</small>}</td>
                      <td className="r tnum">{s.quotes ? `${s.quotes}건` : <span className="cx-muted">0</span>}</td>
                      <td className="r tnum">{s.open ? `${s.open}건` : <span className="cx-muted">0</span>}</td>
                      <td className="r tnum">{s.won} · {s.lost}</td>
                      <td className="r tnum">{s.contracted ? `${s.contracted}건` : <span className="cx-muted">0</span>}</td>
                      <td className="r tnum">{s.wonSum ? wonKo(s.wonSum) : <span className="cx-muted">-</span>}</td>
                      <td className="tnum">{s.lastAt ? agoLabel(s.lastAt, now) : <span className="cx-muted">기록 없음</span>}</td>
                      <td className="r"><Link href={tlHref("all", x.id)} scroll={false} className="cx-lk">기록 보기</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <section className="cx-empty">
            <h2>아직 담당자가 없어요</h2>
            <div className="cx-ph__acts"><SheetButton className="b2 bsm" title="담당자 추가" label={<><Plus size={16} aria-hidden="true" />담당자 추가</>}><ContactForm companyId={co.id} /></SheetButton></div>
          </section>
        )
      )}

      {tab === "quotes" && (
        <section className="cx-grp" aria-labelledby="co-qt">
          <div className="cx-grp__h">
            <h2 id="co-qt">보낸 견적과 결과</h2>
            <span className="cx-grp__end tnum">{qRows.length}건 · 선정 {qRows.filter((r) => r.result.tone === "won").length} · 실패 {qRows.filter((r) => r.result.tone === "lost").length}</span>
          </div>
          <QuoteTable rows={qRows} people={people} personHref={contactHref} deals={new Map(coDeals.map((d) => [d.id, [d.title, `${paths.deals}/${d.id}`]]))}
            empty={<>이 고객사에 보낸 견적서가 없어요.</>} />
        </section>
      )}

      {tab === "acts" && (
        <section className="cx-grp" aria-labelledby="co-tl" id="co-tl-s">
          <div className="cx-grp__h">
            <h2 id="co-tl">{person ? `${personLabel(person.name, person.title)} 기록` : "회사 전체 기록"}</h2>
            <nav className="cx-inline-tabs cx-grp__end" aria-label="기록 종류">
              {(Object.keys(TL_FILTERS) as TlFilter[]).map((k) => <Link key={k} href={tlHref(k)} scroll={false} aria-current={tf === k ? "true" : undefined}>{TL_FILTERS[k]}</Link>)}
              {person && contacts.length <= 1 && <Link href={tlHref(tf, null)} scroll={false}>회사 전체로</Link>}
            </nav>
          </div>
          {contacts.length > 1 && (
            <nav className="cx-filters" aria-label="담당자">
              <Link className="cx-pill" href={tlHref(tf, null)} scroll={false} aria-current={!person ? "true" : undefined}>전체</Link>
              {contacts.map((x) => <Link key={x.id} className="cx-pill" href={tlHref(tf, x.id)} scroll={false} aria-current={person?.id === x.id ? "true" : undefined}>{personLabel(x.name, x.title)}</Link>)}
            </nav>
          )}
          {person && <p className="cx-cap">{person.name}님과의 기록, 앞으로 보낸 견적서, 맡은 안건의 단계 변화만 보여요.</p>}
          {tl.length ? (
            <div className="cx-tl cx-tl--compact">
              {byDay(tl).map((g) => (
                <section key={g.day} aria-label={dayHead(g.day, now)}>
                  <h3 className="cx-tl__day">{dayHead(g.day, now)}</h3>
                  <ol>{g.items.map((x, i) => <TimelineRow key={`${x.at}-${i}`} x={x} clip={160} />)}</ol>
                </section>
              ))}
            </div>
          ) : <p className="cx-none">{person && tf === "all" ? `${person.name}님과의 기록이 아직 없어요.` : tf === "all" ? "아직 기록이 없어요." : `${TL_FILTERS[tf].replace("만", "")} 기록이 없어요.`}</p>}
        </section>
      )}
    </div>
  );
}
