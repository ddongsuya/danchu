import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CaretRight, Check, EnvelopeSimple, FileText, Handshake, LockSimple, NotePencil, PencilSimple, Phone, Plus } from "@phosphor-icons/react/dist/ssr";
import { DEAL_KIND, STAGE_LABEL, STATUS_LABEL, amountLabel, buildTimeline, byDay, stageSpans, type Stage, type Status, type TimelineItem } from "@/lib/crm-deals";
import { CONTACT_ROLE, EVENT_MODE, hmKst, mdW, todayKst, wonKo, ymdKst } from "@/lib/crm-shape";
import { ActivityDelete, ContactForm, SheetButton } from "./forms";
import { CloseButtons, Composer, CopyText, DealDelete, DealForm, DoneButton, StageBar } from "./deal-ui";
import { buildOpts } from "./opts";
import { mailAddress, rowsOf, type CrmCtx } from "./ctx";
import "./crm.css";

const KIND_ICON = { meeting: Handshake, call: Phone, email: EnvelopeSimple, memo: NotePencil, stage: ArrowRight, quote: FileText, task: Check } as const;

/** 날짜 머리: "오늘 11.9", "11.6 금" */
export const dayHead = (ymd: string, now: number) => (ymd === todayKst(now) ? `오늘 ${+ymd.slice(5, 7)}.${+ymd.slice(8, 10)}` : mdW(ymd));

/** 타임라인 한 줄 (안건·고객사 화면이 함께 쓴다) */
export function TimelineRow({ x, dealHref }: { x: TimelineItem; dealHref?: string | null }) {
  const I = x.kind === "danchu" ? null : KIND_ICON[x.kind as keyof typeof KIND_ICON] ?? NotePencil;
  return (
    <li className="cx-ev" data-k={x.kind}>
      <span className={`cx-ev__dot${x.kind === "danchu" ? " cx-ev__dot--d" : ""}`} aria-hidden="true">{I ? <I size={15} /> : "단"}</span>
      <div className="cx-ev__bd">
        <p className="cx-ev__h">
          {x.who && <b>{x.who}</b>}{x.who ? " · " : ""}{x.kind === "danchu" ? <b>{x.title}</b> : x.title}
          {x.amount != null && <> · <span className="tnum">{wonKo(x.amount)}</span></>}
          {x.diffNote && <> <span className="cx-diff">{x.diffNote}</span></>}
        </p>
        {x.body && (
          <div className="cx-ev__q">
            <p>{x.body}</p>
            {x.attachments && <small className="cx-muted">첨부 {x.attachments.length} · {x.attachments.join(", ")}</small>}
          </div>
        )}
        {(x.sub || x.viaMail || dealHref) && (
          <p className="cx-ev__src">
            {x.sub}
            {dealHref && <> · <Link href={dealHref} className="cx-lk">안건 열기</Link></>}
          </p>
        )}
        {x.ref?.type === "activity" && !x.viaMail && <span className="cx-ev__del"><ActivityDelete id={x.ref.id} /></span>}
      </div>
      <time className="cx-ev__tm tnum" dateTime={x.at}>{hmKst(x.at)}</time>
    </li>
  );
}

/**
 * 안건 화면 (시안 v5 3번). 위에 단계 막대와 수주·실패, 왼쪽은 안건 정보, 가운데는 다음 할 일 · 기록 남기기 · 타임라인, 오른쪽은 담당자 · 견적서 · 메일 기록 주소 · 파일.
 * 단추에서 온 칸(출처·선정일·요청 번호)은 "단추가 채움"으로 잠근다. 선정 전에는 의뢰자 이름과 연락처를 보이지 않는다.
 */
export type DealTab = "log" | "info" | "people";
export const dealTab = (v?: string): DealTab => (v === "info" || v === "people" ? v : "log");
const DEAL_TABS: [DealTab, string][] = [["log", "기록"], ["info", "안건 정보"], ["people", "담당자·견적서"]];

export function DealView({ c, id, m = "log" }: { c: CrmCtx; id: string; m?: DealTab }) {
  const { data, paths, now, me } = c;
  const rows = rowsOf(c);
  const r = rows.find((x) => x.deal.id === id);
  if (!r) notFound();
  const d = r.deal;
  const src = d.invite_id ? c.danchu.get(d.invite_id) ?? null : null;
  const danchu = d.source === "danchu";
  const company = d.company_id ? data.companies.find((x) => x.id === d.company_id) ?? null : null;
  const mem = new Map(data.members.map((m) => [m.id, m.name]));
  const hist = data.history.filter((h) => h.deal_id === d.id);
  const spans = stageSpans(d, hist, now);
  const acts = data.activities.filter((a) => a.deal_id === d.id && !a.needs_review);
  const quotes = data.quotes.filter((q) => q.deal_id === d.id).sort((x, y) => x.created_at.localeCompare(y.created_at));
  const tasks = data.tasks.filter((t) => t.deal_id === d.id);
  const dealContacts = d.contact_ids.map((cid) => data.contacts.find((x) => x.id === cid)).filter((x): x is NonNullable<typeof x> => !!x);
  const coContacts = company ? data.contacts.filter((x) => x.company_id === company.id) : [];
  const composerContacts = [...dealContacts, ...coContacts.filter((x) => !d.contact_ids.includes(x.id))].map((x) => ({ id: x.id, name: x.title && !x.name.includes(x.title) ? `${x.name} ${x.title}` : x.name }));
  const tl = buildTimeline({ activities: acts, history: hist, quotes, tasks, contacts: data.contacts, members: data.members, danchu: src ? [{ dealId: d.id, src, contacts: dealContacts.length }] : [] });
  const days = byDay(tl);
  const opts = buildOpts({ ...data, me });
  const mail = mailAddress(d.mail_key, c.mailDomain);
  const lastWith = (cid: string) => acts.filter((a) => a.contact_id === cid || a.attendee_contacts.includes(cid)).sort((x, y) => y.occurred_at.localeCompare(x.occurred_at))[0];
  const files = [
    ...acts.flatMap((a) => a.attachments.map((f) => ({ name: f, at: a.occurred_at, from: a.kind === "email" ? "메일" : "기록" }))),
    ...quotes.filter((q) => q.sent_at).map((q) => ({ name: `견적서 ${q.doc_no}`, at: q.sent_at as string, from: "견적서" })),
  ].sort((x, y) => y.at.localeCompare(x.at));
  const latestDoc = quotes.at(-1);
  const sub = [r.company ?? (r.danchuNo ? `단추 요청 ${r.danchuNo}` : ""), d.title].filter(Boolean).join(" · ");
  const next = r.next;
  const nextEvent = next?.kind === "event" ? data.events.find((e) => e.id === next.id) : null;
  const nextTask = next?.kind === "task" ? data.tasks.find((t) => t.id === next.id) : null;
  return (
    <div className="cx cx-deal" data-m={m}>
      <nav className="crumb cx-crumb" aria-label="위치">
        <Link href={paths.deals}>안건</Link><CaretRight size={12} aria-hidden="true" />
        <span>{d.status === "open" ? STAGE_LABEL[d.stage as Stage] : STATUS_LABEL[d.status as Status]}</span>
      </nav>
      <header className="cx-dh">
        <div>
          <h1>{d.title}</h1>
          <p className="cx-dh__sub">
            {company ? <Link href={`${paths.clients}/${company.id}`} className="cx-tlink">{company.name}</Link> : <span>{danchu && r.danchuNo ? "의뢰자는 선정 뒤 보여요" : "고객사 정하지 않음"}</span>}
            {r.contact && <span>{r.contact}{r.contactMore ? ` 외 ${r.contactMore}명` : ""}</span>}
            <span aria-hidden="true">·</span><b className="tnum">{amountLabel(d.status === "won" ? d.won_amount ?? d.amount : d.amount)}</b>
            {d.owner && <><span aria-hidden="true">·</span><span>담당 {mem.get(d.owner) ?? "-"}</span></>}
            {r.danchuNo && <span className="cx-chip"><span className="cx-d" aria-hidden="true">단</span>단추 {r.danchuNo}</span>}
            {d.status !== "open" && <span className={`cx-st cx-st--${d.status}`}>{STATUS_LABEL[d.status as Status]}{d.lost_reason ? ` · ${d.lost_reason}` : ""}</span>}
          </p>
        </div>
        <div className="cx-ph__acts">
          {latestDoc ? (
            <Link href={`${paths.docs}/${latestDoc.id}`} className="b2 bsm"><FileText size={16} aria-hidden="true" />견적서 고치기</Link>
          ) : src && !src.award && src.stage !== "submitted" && d.status === "open" ? (
            <Link href={`/cro/r/${src.inviteId}/reply`} className="b2 bsm"><FileText size={16} aria-hidden="true" />견적서 쓰기</Link>
          ) : (
            <Link href={`${paths.newDoc}?deal=${d.id}`} className="b2 bsm"><FileText size={16} aria-hidden="true" />견적서 만들기</Link>
          )}
          <CloseButtons deal={{ id: d.id, title: d.title, sub, amount: d.amount, status: d.status, danchu }} />
          <SheetButton className="b2 bsm cx-iconbtn" title="안건 고치기" label={<><PencilSimple size={16} aria-hidden="true" /><span className="sr-only">안건 고치기</span></>}>
            <DealForm opts={opts} base={paths.deals} locked={danchu} deal={{ id: d.id, title: d.title, company_id: d.company_id, contact_ids: d.contact_ids, amount: d.amount, kind: d.kind, expected_on: d.expected_on, owner: d.owner, substance: d.substance, submit_to: d.submit_to, report_lang: d.report_lang, memo: d.memo }} />
            {!danchu && <DealDelete id={d.id} back={paths.deals} />}
          </SheetButton>
        </div>
      </header>

      <StageBar dealId={d.id} spans={spans} open={d.status === "open"} />

      <nav className="cx-tabs2 cx-mtabs" aria-label="안건 화면 나누어 보기">
        {DEAL_TABS.map(([k, label]) => <Link key={k} href={k === "log" ? "?" : `?m=${k}`} replace scroll={false} aria-current={m === k ? "page" : undefined}>{label}</Link>)}
      </nav>

      <div className="cx-dealcols">
        <dl className="cx-facts">
          <div><dt>{d.status === "won" ? "계약 금액" : "금액"}</dt><dd className="cx-facts__big tnum">{amountLabel(d.status === "won" ? d.won_amount ?? d.amount : d.amount)}</dd></div>
          {d.status === "won" && d.won_amount != null && d.amount != null && d.won_amount !== d.amount && <div><dt>견적 금액</dt><dd className="tnum">{wonKo(d.amount)}</dd></div>}
          {d.status === "lost" && <div><dt>실패 사유</dt><dd>{d.lost_reason || "기타"}{d.lost_note && <small className="cx-muted cx-facts__note">{d.lost_note}</small>}</dd></div>}
          <div><dt>예상 계약</dt><dd className="tnum">{d.expected_on ? `${d.expected_on.slice(0, 4)}년 ${+d.expected_on.slice(5, 7)}월` : <span className="cx-muted">정하지 않음</span>}</dd></div>
          <div><dt>시험 갈래</dt><dd>{d.kind ? DEAL_KIND[d.kind] : <span className="cx-muted">-</span>}{src?.cats.length ? <span className="cx-muted"> · {src.cats.slice(0, 2).join(", ")}</span> : null}</dd></div>
          {d.substance && <div><dt>대상 물질</dt><dd>{d.substance}</dd></div>}
          {d.submit_to && <div><dt>제출처</dt><dd>{d.submit_to}</dd></div>}
          {d.report_lang && <div><dt>보고서 언어</dt><dd>{d.report_lang}</dd></div>}
          <div><dt>담당 영업</dt><dd>{d.owner ? mem.get(d.owner) ?? "-" : <span className="cx-muted">정하지 않음</span>}</dd></div>
          <div><dt>출처</dt><dd>{danchu ? <>단추 요청 {r.danchuNo}<Lock /></> : d.source === "import" ? "엑셀에서 가져옴" : "직접 받은 문의"}</dd></div>
          {src?.award && <div><dt>선정일</dt><dd className="tnum">{ymdKst(src.award.awardedAt).replaceAll("-", ".")}<Lock /></dd></div>}
          {src?.replyBy && !src.award && d.status === "open" && <div><dt>회신 기한</dt><dd className="tnum">{mdW(src.replyBy.slice(0, 10))}<Lock /></dd></div>}
          {company?.first_deal_on && <div><dt>첫 거래</dt><dd className="tnum">{company.first_deal_on.slice(0, 4)}년 {+company.first_deal_on.slice(5, 7)}월</dd></div>}
          {d.memo && <div><dt>메모</dt><dd className="cx-pre">{d.memo}</dd></div>}
          {danchu && <div><dt>단추 요청</dt><dd><Link href={`/cro/r/${d.invite_id}`} className="cx-lk">요청서 보기</Link></dd></div>}
        </dl>

        <div className="cx-center">
          {d.status === "open" && (
            next ? (
              <div className="cx-next" id="next-band">
                <span className="cx-next__when tnum">
                  {next.at ? <>{next.at === todayKst(now) ? "오늘" : `${["일", "월", "화", "수", "목", "금", "토"][new Date(`${next.at}T12:00:00+09:00`).getUTCDay()]}`}<b>{+next.at.slice(5, 7)}.{next.at.slice(8, 10)}</b>{next.time ?? ""}</> : <b>기한 없음</b>}
                </span>
                <span className="cx-next__t">
                  <b>{next.kind === "event" && next.mode ? `${EVENT_MODE[next.mode]} ` : ""}{next.label}</b>
                  <small>{next.kind === "danchu" ? "단추 요청에서 할 일" : nextEvent ? [nextEvent.location, nextEvent.requests].filter(Boolean).join(" · ") || "일정" : nextTask?.memo || "할 일"}</small>
                </span>
                {next.kind === "danchu" && next.href ? <Link href={next.href} className="b2 bsm">{next.label}</Link>
                  : next.id ? <DoneButton kind={next.kind === "event" ? "events" : "tasks"} id={next.id} /> : null}
              </div>
            ) : (
              <p className="cx-next cx-next--none" id="next-band"><b>다음 할 일이 없어요.</b> 아래 &quot;할 일&quot;에서 날짜를 잡거나, 기록을 남기며 다음 할 일 날짜를 골라요.</p>
            )
          )}
          <Composer dealId={d.id} companyId={d.company_id} contacts={composerContacts} members={opts.members} me={me} startTab={!next && d.status === "open" ? "task" : "memo"} />
          {days.length ? (
            <div className="cx-tl">
              {days.map((g) => (
                <section key={g.day} aria-label={dayHead(g.day, now)}>
                  <h3 className="cx-tl__day">{dayHead(g.day, now)}</h3>
                  <ol>{g.items.map((x, i) => <TimelineRow key={`${x.at}-${i}`} x={x} />)}</ol>
                </section>
              ))}
            </div>
          ) : <p className="cx-none">아직 기록이 없어요. 통화나 미팅을 마치면 위에 한 줄 남겨요.</p>}
        </div>

        <aside className="cx-rail" aria-label="담당자와 견적서">
          <section className="cx-rail__s">
            <h2 className="cx-rail__h">담당자
              {company && <SheetButton className="cx-lk cx-rail__add" title="담당자 추가" label={<><Plus size={13} aria-hidden="true" />추가</>}><ContactForm companyId={company.id} dealId={d.id} /></SheetButton>}
            </h2>
            {dealContacts.length ? (
              <ul className="cx-ppl">
                {dealContacts.map((p, i) => {
                  const last = lastWith(p.id);
                  return (
                    <li key={p.id}>
                      <span className="cx-av" aria-hidden="true">{p.name.slice(0, 1)}</span>
                      <span className="cx-ppl__x">
                        <b>{p.name}{p.title && !p.name.includes(p.title) ? ` ${p.title}` : ""}{i === 0 && dealContacts.length > 1 && <span className="cx-chip">주 담당</span>}</b>
                        <small>{[p.dept, p.role ? CONTACT_ROLE[p.role] : "", last ? `마지막 연락 ${ymdKst(last.occurred_at) === todayKst(now) ? "오늘" : mdW(ymdKst(last.occurred_at))}` : ""].filter(Boolean).join(" · ")}</small>
                      </span>
                      <span className="cx-ppl__ico">
                        {(p.mobile || p.phone) && <a href={`tel:${(p.mobile || p.phone).replace(/[^0-9+]/g, "")}`} className="cx-icon" aria-label={`${p.name}에게 전화`}><Phone size={16} aria-hidden="true" /></a>}
                        {p.email && <a href={`mailto:${p.email}${mail ? `?bcc=${encodeURIComponent(mail)}` : ""}`} className="cx-icon" aria-label={`${p.name}에게 메일`}><EnvelopeSimple size={16} aria-hidden="true" /></a>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="cx-muted cx-small">{danchu && !company ? "의뢰자가 우리 견적을 고르면 고객사와 담당자가 저절로 들어와요." : company ? "이 안건의 담당자를 추가해요." : "고객사를 정하면 담당자를 붙일 수 있어요."}</p>}
          </section>

          <section className="cx-rail__s">
            <h2 className="cx-rail__h">견적서</h2>
            {quotes.length || src?.quote ? (
              <ul className="cx-qv">
                {[...quotes].reverse().map((q, i) => (
                  <li key={q.id} data-cur={i === 0 ? "1" : "0"}>
                    <Link href={`${paths.docs}/${q.id}`}>
                      <span className="cx-qv__v tnum">{quotes.length - i}차</span>
                      <span className="cx-qv__x"><b className="tnum">{wonKo(q.supply)}</b><small>{[q.sent_at ? `${mdW(ymdKst(q.sent_at))} 보냄` : "보내기 전", q.valid_until ? `${+q.valid_until.slice(5, 7)}.${+q.valid_until.slice(8, 10)}까지 유효` : ""].filter(Boolean).join(" · ")}</small></span>
                      <CaretRight size={14} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
                {!quotes.length && src?.quote && (
                  <li data-cur="1">
                    <Link href={`/cro/r/${src.inviteId}/reply`}>
                      <span className="cx-qv__v tnum">{src.quote.revision}차</span>
                      <span className="cx-qv__x"><b className="tnum">{amountLabel(src.quote.total)}</b><small>{src.quote.submittedAt ? `${mdW(ymdKst(src.quote.submittedAt))} 단추에 제출` : "단추에서 쓰는 중"}</small></span>
                      <CaretRight size={14} aria-hidden="true" />
                    </Link>
                  </li>
                )}
              </ul>
            ) : <p className="cx-muted cx-small">아직 견적서가 없어요. 위 &quot;견적서 만들기&quot;로 시작하면 이 안건에 붙어요.</p>}
          </section>

          {mail && (
            <section className="cx-rail__s cx-logbox">
              <h2 className="cx-rail__h">이 안건의 메일 기록 주소</h2>
              <CopyText text={mail} label="메일 기록 주소 복사" />
              <p className="cx-muted cx-small">고객에게 메일을 보낼 때 숨은참조에 넣거나, 받은 메일을 이 주소로 전달하면 타임라인에 붙어요.</p>
            </section>
          )}

          {files.length > 0 && (
            <section className="cx-rail__s">
              <h2 className="cx-rail__h">파일</h2>
              <ul className="cx-files">
                {files.slice(0, 8).map((f, i) => <li key={i}><FileText size={15} aria-hidden="true" /><span>{f.name}</span><small className="cx-muted tnum">{+ymdKst(f.at).slice(5, 7)}.{+ymdKst(f.at).slice(8, 10)} {f.from}</small></li>)}
              </ul>
            </section>
          )}
        </aside>
      </div>
      <Link href={`${paths.log}?deal=${d.id}`} className="b1 cx-mfab only-narrow">기록 남기기</Link>
    </div>
  );
}

function Lock() {
  return <span className="cx-lock"><LockSimple size={11} aria-hidden="true" />단추가 채움</span>;
}

