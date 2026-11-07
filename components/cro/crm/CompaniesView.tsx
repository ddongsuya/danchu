import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight, EnvelopeSimple, MagnifyingGlass, PencilSimple, Phone, Plus, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { COMPANY_FILTERS, STAGE_LABEL, STATUS_LABEL, amountLabel, buildTimeline, byDay, companyRows, filterCompanies, nextLabel, type CompanyFilter, type Stage, type Status } from "@/lib/crm-deals";
import { CONTACT_ROLE, agoLabel, duplicatePairs, mdW, todayKst, wonKo, ymdKst } from "@/lib/crm-shape";
import { CompanyDelete, CompanyForm, ContactForm, MergeButton, SheetButton } from "./forms";
import { DealForm } from "./deal-ui";
import { TimelineRow, dayHead } from "./DealView";
import { buildOpts, qs } from "./opts";
import { rowsOf, type CrmCtx } from "./ctx";
import "./crm.css";

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
      </div>
      {rows.length ? (
        <div className="cx-tablewrap">
          <table className="cx-table cx-table--co">
            <thead><tr><th>고객사</th><th>진행 중 안건</th><th>담당자</th><th>마지막 연락</th><th>담당 영업</th><th className="r">누적 계약</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.company.id}>
                  <td><Link href={`${paths.clients}/${r.company.id}`} className="cx-tlink">{r.company.name}</Link>{r.danchu && <span className="cx-d cx-d--s" title="단추에서 온 고객" aria-label="단추에서 온 고객">단</span>}{r.company.industry && <small className="cx-muted"> · {r.company.industry}</small>}</td>
                  <td className="tnum">{r.open ? `${r.open}건 · ${wonKo(r.openSum)}` : <span className="cx-muted">없음</span>}</td>
                  <td>{r.lead ?? <span className="cx-muted">-</span>}{r.contacts > 1 && <span className="cx-muted"> 외 {r.contacts - 1}명</span>}</td>
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
          <p>단추 요청에서 선정되면 의뢰자 회사와 담당자가 저절로 들어와요. 지금 쓰는 고객 엑셀이 있으면 한 번에 옮길 수 있어요.</p>
          <div className="cx-ph__acts"><Link className="b2" href={paths.import}>엑셀 가져오기</Link></div>
        </section>
      )}
    </div>
  );
}

const TL_FILTERS = { all: "전체", email: "메일만", meeting: "미팅만", call: "통화만" } as const;
type TlFilter = keyof typeof TL_FILTERS;

/** 고객사 화면 (시안 v5 5번). 위에 요약, 가운데 안건 표와 회사 전체 기록, 오른쪽 담당자와 회사 정보 */
export function CompanyView({ c, id, t }: { c: CrmCtx; id: string; t?: string }) {
  const { data, paths, now, me } = c;
  const co = data.companies.find((x) => x.id === id);
  if (!co) notFound();
  const tf: TlFilter = t && t in TL_FILTERS ? (t as TlFilter) : "all";
  const row = companyRows({ companies: [co], contacts: data.contacts, deals: data.deals, activities: data.activities, members: data.members, now })[0];
  const rows = rowsOf(c).filter((r) => r.deal.company_id === co.id).sort((x, y) => (x.deal.status === "open" ? 0 : 1) - (y.deal.status === "open" ? 0 : 1) || (y.deal.closed_at ?? y.deal.updated_at).localeCompare(x.deal.closed_at ?? x.deal.updated_at));
  const dealIds = new Set(rows.map((r) => r.deal.id));
  const contacts = data.contacts.filter((x) => x.company_id === co.id);
  const acts = data.activities.filter((a) => (a.company_id === co.id || (a.deal_id && dealIds.has(a.deal_id))) && (tf === "all" || a.kind === tf));
  const danchu = tf === "all" ? rows.filter((r) => r.deal.invite_id && c.danchu.has(r.deal.invite_id)).map((r) => ({ dealId: r.deal.id, src: c.danchu.get(r.deal.invite_id as string)!, contacts: r.deal.contact_ids.length })) : [];
  const tl = buildTimeline({
    activities: acts, history: [], quotes: tf === "all" ? data.quotes.filter((q) => q.company_id === co.id || (q.deal_id && dealIds.has(q.deal_id))) : [],
    tasks: [], contacts: data.contacts, members: data.members, danchu, deals: rows.map((r) => r.deal),
  }).slice(0, 40);
  const opts = buildOpts({ ...data, me });
  const members = data.members.map((m) => ({ id: m.id, name: m.name }));
  const lastWith = (cid: string) => data.activities.filter((a) => a.contact_id === cid || a.attendee_contacts.includes(cid)).sort((x, y) => y.occurred_at.localeCompare(x.occurred_at))[0];
  const SRC = { manual: "직접 추가", danchu: "단추 선정", import: "엑셀 가져오기" } as Record<string, string>;
  return (
    <div className="cx cx-co">
      <nav className="crumb cx-crumb" aria-label="위치"><Link href={paths.clients}>고객사</Link><CaretRight size={12} aria-hidden="true" /><span>{co.name}</span></nav>
      <header className="cx-coh">
        <span className="cx-logo2" aria-hidden="true">{co.name.replace(/^\(?(주|㈜)\)?\s*/, "").slice(0, 1)}</span>
        <div>
          <h1>{co.name}</h1>
          <dl className="cx-kv">
            <div><dt>진행 중</dt><dd className="tnum">{row.open ? `${row.open}건 · ${wonKo(row.openSum)}` : "없음"}</dd></div>
            <div><dt>누적 계약</dt><dd className="tnum">{row.wonSum ? wonKo(row.wonSum) : "-"}</dd></div>
            <div><dt>수주 · 실패</dt><dd className="tnum">{row.won} · {row.lost}</dd></div>
            <div><dt>첫 거래</dt><dd className="tnum">{row.firstOn ? `${row.firstOn.slice(0, 4)}년 ${+row.firstOn.slice(5, 7)}월` : "-"}</dd></div>
            <div><dt>담당 영업</dt><dd>{row.owner ?? "-"}</dd></div>
          </dl>
        </div>
        <div className="cx-ph__acts">
          <SheetButton className="b2 bsm" title="고객사 고치기" label={<><PencilSimple size={16} aria-hidden="true" />고치기</>}>
            <CompanyForm company={co} members={members} />
            <div className="cx-del"><CompanyDelete id={co.id} back={paths.clients} /></div>
          </SheetButton>
          <SheetButton className="b1 bsm" title="안건 만들기" label={<><Plus size={16} aria-hidden="true" />안건 만들기</>}><DealForm opts={opts} base={paths.deals} preset={{ company_id: co.id }} /></SheetButton>
        </div>
      </header>

      <div className="cx-cocols">
        <div className="cx-center">
          <section aria-labelledby="co-deals">
            <div className="cx-sec__h"><h2 id="co-deals">안건</h2><span className="cx-muted tnum">{rows.length}건</span></div>
            {rows.length ? (
              <div className="cx-tablewrap">
                <table className="cx-table cx-table--cd">
                  <thead><tr><th>안건</th><th>단계</th><th>다음 할 일</th><th>담당자</th><th className="r">금액</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.deal.id} data-past={r.deal.status === "open" ? "0" : "1"}>
                        <td><Link href={`${paths.deals}/${r.deal.id}`} className="cx-tlink">{r.deal.title}</Link></td>
                        <td>{r.deal.status === "open" ? <span className="cx-st cx-st--open">{STAGE_LABEL[r.deal.stage as Stage]}</span> : <span className={`cx-st cx-st--${r.deal.status}`}>{STATUS_LABEL[r.deal.status as Status]}{r.deal.lost_reason ? ` · ${r.deal.lost_reason}` : ""}</span>}</td>
                        <td className="tnum">{r.deal.status === "open" ? nextLabel(r.next, now) || <span className="cx-flag cx-flag--warn">다음 할 일 없음</span> : <span className="cx-muted">{r.deal.closed_at ? ymdKst(r.deal.closed_at).slice(0, 7).replace("-", ".") : ""}</span>}</td>
                        <td>{r.contact ?? <span className="cx-muted">-</span>}{r.contactMore ? <span className="cx-muted"> 외 {r.contactMore}명</span> : null}</td>
                        <td className="r tnum">{amountLabel(r.deal.status === "won" ? r.deal.won_amount ?? r.deal.amount : r.deal.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="cx-none">이 고객사의 안건이 없어요. 문의가 오면 &quot;안건 만들기&quot;로 시작해요.</p>}
          </section>

          <section aria-labelledby="co-tl">
            <div className="cx-sec__h">
              <h2 id="co-tl">회사 전체 기록</h2>
              <nav className="cx-inline-tabs" aria-label="기록 종류">
                {(Object.keys(TL_FILTERS) as TlFilter[]).map((k) => <Link key={k} href={qs(`${paths.clients}/${co.id}`, { t: k === "all" ? null : k })} aria-current={tf === k ? "true" : undefined}>{TL_FILTERS[k]}</Link>)}
              </nav>
            </div>
            {tl.length ? (
              <div className="cx-tl cx-tl--compact">
                {byDay(tl).map((g) => (
                  <section key={g.day} aria-label={dayHead(g.day, now)}>
                    <h3 className="cx-tl__day">{dayHead(g.day, now)}</h3>
                    <ol>{g.items.map((x, i) => <TimelineRow key={`${x.at}-${i}`} x={{ ...x, body: x.body && x.body.length > 160 ? `${x.body.slice(0, 160)}…` : x.body }} />)}</ol>
                  </section>
                ))}
              </div>
            ) : <p className="cx-none">{tf === "all" ? "아직 기록이 없어요. 안건 화면에서 통화·미팅·메모를 남기면 여기에도 모여요." : `${TL_FILTERS[tf].replace("만", "")} 기록이 없어요.`}</p>}
          </section>
        </div>

        <aside className="cx-rail" aria-label="담당자와 회사 정보">
          <section className="cx-rail__s">
            <h2 className="cx-rail__h">담당자 {contacts.length}명
              <SheetButton className="cx-lk cx-rail__add" title="담당자 추가" label={<><Plus size={13} aria-hidden="true" />추가</>}><ContactForm companyId={co.id} /></SheetButton>
            </h2>
            {contacts.length ? (
              <ul className="cx-ppl">
                {contacts.map((p) => {
                  const last = lastWith(p.id);
                  return (
                    <li key={p.id}>
                      <span className="cx-av" aria-hidden="true">{p.name.slice(0, 1)}</span>
                      <span className="cx-ppl__x">
                        <SheetButton className="cx-ppl__n" title="담당자 고치기" label={<b>{p.name}{p.title && !p.name.includes(p.title) ? ` ${p.title}` : ""}</b>}><ContactForm companyId={co.id} contact={p} /></SheetButton>
                        <small>{[p.dept, p.role ? CONTACT_ROLE[p.role] : "", p.source === "mail" ? "메일에서 추가됨" : p.danchu_key ? "단추에서 들어옴" : "", last ? (ymdKst(last.occurred_at) === todayKst(now) ? "오늘 연락" : `${mdW(ymdKst(last.occurred_at))} 연락`) : ""].filter(Boolean).join(" · ")}</small>
                      </span>
                      <span className="cx-ppl__ico">
                        {(p.mobile || p.phone) && <a href={`tel:${(p.mobile || p.phone).replace(/[^0-9+]/g, "")}`} className="cx-icon" aria-label={`${p.name}에게 전화`}><Phone size={16} aria-hidden="true" /></a>}
                        {p.email && <a href={`mailto:${p.email}`} className="cx-icon" aria-label={`${p.name}에게 메일`}><EnvelopeSimple size={16} aria-hidden="true" /></a>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="cx-muted cx-small">담당자를 추가하면 안건과 기록에 이름으로 붙어요.</p>}
          </section>
          <section className="cx-rail__s">
            <h2 className="cx-rail__h">회사 정보</h2>
            <dl className="cx-facts">
              {co.industry && <div><dt>업종</dt><dd>{co.industry}</dd></div>}
              {co.biz_no && <div><dt>사업자번호</dt><dd className="tnum">{co.biz_no}</dd></div>}
              {co.aliases.length > 0 && <div><dt>다른 표기</dt><dd>{co.aliases.join(", ")}</dd></div>}
              {co.email_domain && <div><dt>메일 도메인</dt><dd>{co.email_domain}</dd></div>}
              {co.address && <div><dt>주소</dt><dd>{co.address}</dd></div>}
              {co.website && <div><dt>홈페이지</dt><dd><a href={/^https?:\/\//.test(co.website) ? co.website : `https://${co.website}`} target="_blank" rel="noreferrer" className="cx-lk">{co.website.replace(/^https?:\/\//, "")}</a></dd></div>}
              <div><dt>들어온 곳</dt><dd>{SRC[co.source] ?? "직접 추가"} · {mdW(ymdKst(co.created_at))}</dd></div>
              {co.memo && <div><dt>메모</dt><dd className="cx-pre">{co.memo}</dd></div>}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
