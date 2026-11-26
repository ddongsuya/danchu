import Link from "next/link";
import { CaretDown, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { FORECAST_MIN_CLOSED, STAGE_LABEL, buildForecast, buildReport, type ForecastBucket, closedLabel } from "@/lib/crm-deals";
import { personLabel, todayKst, wonKo, ymdKst } from "@/lib/crm-shape";
import { buildQuoteFunnel, type PerfRow } from "@/lib/crm-analysis";
import { qs } from "./opts";
import type { CrmCtx } from "./ctx";
import "./crm.css";
import "./layout-crm.css";

export const PERIODS = { m1: "이번 달", m3: "최근 3개월", m6: "최근 6개월", y: "올해" } as const;
type Period = keyof typeof PERIODS;
const TABS = { p: "파이프라인", q: "견적 성과", w: "수주·실패", f: "매출 예측", a: "활동" } as const;
type Tab = keyof typeof TABS;
export type ReportsQuery = { tab: Tab; p: Period; owner: string };

export function parseReportsQuery(sp: Record<string, string | undefined>): ReportsQuery {
  return {
    tab: sp.tab && sp.tab in TABS ? (sp.tab as Tab) : "p",
    p: sp.p && sp.p in PERIODS ? (sp.p as Period) : "m6",
    owner: sp.owner && /^[0-9a-f-]{36}$/.test(sp.owner) ? sp.owner : "",
  };
}

/** 기간 → [시작, 끝] (KST 날짜) */
export function periodRange(p: Period, now = Date.now()): [string, string] {
  const t = todayKst(now);
  const first = `${t.slice(0, 7)}-01`;
  if (p === "m1") return [first, t];
  if (p === "y") return [`${t.slice(0, 4)}-01-01`, t];
  const months = p === "m3" ? 2 : 5;
  const d = new Date(`${first}T12:00:00+09:00`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return [ymdKst(d), t];
}
const ym = (ymd: string) => `${ymd.slice(0, 4)}년 ${+ymd.slice(5, 7)}월`;

/**
 * 보고서 (시안 v5 7번, v7). 파이프라인(단계별로 넘어간 안건 · 단계에 머문 날) · 견적 성과(보낸 견적 → 선정 → 계약, 고객사·담당자별) ·
 * 수주·실패(수주율 · 수주 이유 · 실패 사유 · 출처별) · 매출 예측(진행 중 안건을 계약 예상 달로) · 활동(사람별 기록 수).
 * CRM 숫자는 기관 안에서만 본다. 단추의 노출 순서나 청구에는 쓰지 않는다.
 */
export function ReportsView({ c, q }: { c: CrmCtx; q: ReportsQuery }) {
  const { data, paths, now } = c;
  const [from, to] = periodRange(q.p, now);
  const r = buildReport({ deals: data.deals, history: data.history, activities: data.activities, tasks: data.tasks, members: data.members, from, to, owner: q.owner || null, now });
  const link = (p: Partial<ReportsQuery>) => qs(paths.reports, { tab: (p.tab ?? q.tab) === "p" ? null : p.tab ?? q.tab, p: (p.p ?? q.p) === "m6" ? null : p.p ?? q.p, owner: p.owner ?? q.owner });
  const ownerName = q.owner ? data.members.find((m) => m.id === q.owner)?.name ?? "" : "";
  const top = r.funnel[0]?.count ?? 0;
  const maxDwell = Math.max(1, ...r.dwell.map((x) => x.days ?? 0));
  const longest = r.dwell.reduce<{ stage: string; days: number } | null>((m, x) => (x.days != null && (!m || x.days > m.days) ? { stage: x.stage, days: x.days } : m), null);
  const maxReason = Math.max(1, ...r.reasons.map((x) => x.count));
  const mem = new Map(data.members.map((m) => [m.id, m.name]));
  const co = new Map(data.companies.map((x) => [x.id, x.name]));
  const exportHref = qs(paths.exportXlsx, { from, to });
  const range = q.tab === "f" ? "진행 중인 안건" : from.slice(0, 7) === to.slice(0, 7) ? ym(from) : `${ym(from)} ~ ${from.slice(0, 4) === to.slice(0, 4) ? `${+to.slice(5, 7)}월` : ym(to)}`;
  const fc = q.tab === "f" ? buildForecast({ deals: data.deals, history: data.history, owner: q.owner || null, now }) : null;
  const sent = q.tab !== "f" ? buildQuoteFunnel({ deals: data.deals, history: data.history, quotes: data.quotes, danchu: c.danchu, from, to, owner: q.owner || null }) : null;
  const qf = q.tab === "q" ? sent : null;
  const maxWon = Math.max(1, ...r.wonReasons.map((x) => x.count));
  const ct = new Map(data.contacts.map((x) => [x.id, personLabel(x.name, x.title)]));
  return (
    <div className="cx">
      <header className="cx-ph">
        <div>
          <h1>분석</h1>
          <p className="cx-ph__sub">{range} · {ownerName ? `${ownerName} 담당` : "전체 담당자"}</p>
        </div>
        <div className="cx-ph__acts">
          {q.tab !== "f" && (
            <details className="cx-dd">
              <summary>{PERIODS[q.p]}<CaretDown size={14} aria-hidden="true" /></summary>
              <ul>{(Object.keys(PERIODS) as Period[]).map((p) => <li key={p}><Link href={link({ p })} aria-current={q.p === p ? "true" : undefined}>{PERIODS[p]}</Link></li>)}</ul>
            </details>
          )}
          {data.members.length > 1 && (
            <details className="cx-dd">
              <summary>{ownerName || "담당 영업"}<CaretDown size={14} aria-hidden="true" /></summary>
              <ul>
                <li><Link href={link({ owner: "" })} aria-current={!q.owner ? "true" : undefined}>전체</Link></li>
                {data.members.map((m) => <li key={m.id}><Link href={link({ owner: m.id })} aria-current={q.owner === m.id ? "true" : undefined}>{m.name}</Link></li>)}
              </ul>
            </details>
          )}
          <a href={exportHref} className="b2 bsm"><DownloadSimple size={16} aria-hidden="true" />엑셀로 내보내기</a>
        </div>
      </header>
      <nav className="cx-tabs2 cx-cotabs" aria-label="분석">
        {(Object.keys(TABS) as Tab[]).map((t) => <Link key={t} href={link({ tab: t })} aria-current={q.tab === t ? "page" : undefined}>{TABS[t]}</Link>)}
      </nav>

      {sent && (
        <dl className="cx-stats" aria-label="기간 요약">
          <div><dt>보낸 견적</dt><dd className="tnum">{sent.sent}건</dd></div>
          <div><dt>선정</dt><dd className="tnum">{sent.selected}건{sent.selectRate != null && <small>{sent.selectRate}%</small>}</dd></div>
          <div><dt>수주 · 실패</dt><dd className="tnum">{r.won} · {r.lost}건{r.winRate != null && <small>수주율 {r.winRate}%</small>}</dd></div>
          <div><dt>수주 금액</dt><dd className="tnum">{r.wonSum ? wonKo(r.wonSum) : "0원"}</dd></div>
        </dl>
      )}

      {q.tab === "p" && (
        <div className="cx-rep">
          <div className="cx-rep__col">
            <section className="cx-panel" aria-labelledby="r-funnel">
              <div><h2 id="r-funnel">단계별로 넘어간 안건</h2><p className="cx-cap">기간 안에 들어온 안건 {top}건이 어디까지 갔는지</p></div>
              {top ? (
                <ol className="cx-funnel">
                  {r.funnel.map((f, i) => (
                    <li key={f.stage}>
                      {i > 0 && <span className="cx-conv tnum" aria-label={`앞 단계에서 ${f.fromPrev ?? 0}% 넘어감`}>↓ {f.fromPrev ?? 0}%</span>}
                      <div className="cx-fr">
                        <span className="cx-fr__nm">{STAGE_LABEL[f.stage]}</span>
                        <span className="cx-fr__trk"><span className="cx-fr__fill tnum" style={{ width: `${Math.max(6, (f.count / top) * 100)}%` }}>{f.count}</span></span>
                        <span className="cx-fr__rt tnum">{i === 0 ? "시작" : <>문의의 <b>{f.fromStart ?? 0}%</b></>}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : <p className="cx-none">이 기간에 들어온 안건이 없어요.</p>}
              {top > 0 && <p className="cx-cap">단계 전환율. 수주한 안건은 계약까지 간 것으로 셉니다.</p>}
            </section>
            <section className="cx-panel" aria-labelledby="r-dwell">
              <div><h2 id="r-dwell">단계에 머문 평균 일수</h2><p className="cx-cap">{longest ? `${STAGE_LABEL[longest.stage as keyof typeof STAGE_LABEL]}에 가장 오래 머물러요.` : "단계를 옮긴 기록이 쌓이면 보여요."}</p></div>
              <div className="cx-dwell">
                {r.dwell.map((x) => (
                  <div key={x.stage}>
                    <b className="tnum">{x.days != null ? `${x.days}일` : "-"}</b>
                    <i style={{ height: `${x.days ? Math.max(6, (x.days / maxDwell) * 90) : 2}px` }} data-hi={longest?.stage === x.stage ? "1" : "0"} />
                    <span>{STAGE_LABEL[x.stage]}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div className="cx-rep__col">
            <SourcePanel r={r} />
          </div>
        </div>
      )}

      {qf && (
        <div className="cx-rep">
          <div className="cx-rep__col">
            <section className="cx-panel" aria-labelledby="r-qf">
              <div><h2 id="r-qf">보낸 견적에서 계약까지</h2><p className="cx-cap">기간 안에 처음 견적을 보낸 안건 {qf.sent}건이 어디까지 갔는지</p></div>
              {qf.sent ? (
                <ol className="cx-funnel cx-funnel--q">
                  {([["보낸 견적", qf.sent, null], ["선정", qf.selected, qf.selectRate], ["계약", qf.contracted, qf.contractRate]] as const).map(([nm, n, rate], i) => (
                    <li key={nm}>
                      {i > 0 && <span className="cx-conv tnum" aria-label={`앞 단계에서 ${rate ?? 0}% 넘어감`}>↓ {rate ?? 0}%</span>}
                      <div className="cx-fr">
                        <span className="cx-fr__nm">{nm}</span>
                        <span className="cx-fr__trk"><span className="cx-fr__fill tnum" style={{ width: `${Math.max(6, (n / qf.sent) * 100)}%` }}>{n}</span></span>
                        <span className="cx-fr__rt tnum">{i === 0 ? `견적서 ${qf.docs}장` : <>보낸 견적의 <b>{Math.round((n / qf.sent) * 100)}%</b></>}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : <p className="cx-none">이 기간에 보낸 견적이 없어요. 견적서에 보낸 날을 적거나 단추 요청에 견적을 내면 여기에 모여요.</p>}
              {qf.sent > 0 && <p className="cx-cap">안건 하나에 2차·3차 견적을 보내도 한 건으로 셉니다. 선정은 수주했거나 단추 요청에서 의뢰자가 우리 견적을 고른 안건, 계약은 계약 단계까지 간 수주와 단추에 체결로 보고한 안건이에요.</p>}
            </section>
            <PerfTable title="고객사별" id="r-qco" rows={qf.byCompany} name={(id) => (id ? co.get(id) ?? "고객사" : "고객사 정하지 않음")} href={(id) => (id ? `${paths.clients}/${id}` : null)} />
          </div>
          <div className="cx-rep__col">
            <section className="cx-panel" aria-label="견적 성과 요약">
              <dl className="cx-wonline">
                <div><dt>선정률</dt><dd className="tnum">{qf.selectRate != null ? `${qf.selectRate}%` : "-"}</dd></div>
                <div><dt>계약 전환</dt><dd className="tnum">{qf.overallRate != null ? `${qf.overallRate}%` : "-"}</dd></div>
                <div><dt>계약 금액</dt><dd className="tnum">{wonKo(qf.byCompany.reduce((s, x) => s + x.wonSum, 0))}</dd></div>
              </dl>
              <p className="cx-cap">선정률은 보낸 견적 중 선정된 비율, 계약 전환은 보낸 견적 중 계약까지 간 비율이에요.</p>
            </section>
            <PerfTable title="담당자별" id="r-qct" rows={qf.byContact} name={(id) => (id ? ct.get(id) ?? "담당자" : "")} sub={(x) => ("companyId" in x && x.companyId ? co.get(x.companyId as string) ?? "" : "")} narrow />
          </div>
        </div>
      )}

      {q.tab === "w" && (
        <div className="cx-rep">
          <div className="cx-rep__col">
            <section className="cx-panel" aria-labelledby="r-closed">
              <div><h2 id="r-closed">끝난 안건</h2><p className="cx-cap">기간 안에 수주 또는 실패로 바뀐 {r.closed.length}건</p></div>
              {r.closed.length ? (
                <div className="cx-tablewrap cx-tablewrap--flat">
                  <table className="cx-table">
                    <thead><tr><th>안건</th><th>결과</th><th>담당 영업</th><th className="r">금액</th><th className="r">끝난 날</th></tr></thead>
                    <tbody>
                      {r.closed.slice(0, 30).map((d) => (
                        <tr key={d.id}>
                          <td><Link href={`${paths.deals}/${d.id}`} className="cx-tlink">{d.title}</Link>{d.company_id && <small className="cx-muted"> · {co.get(d.company_id)}</small>}</td>
                          <td><span className={`cx-st cx-st--${d.status}`}>{closedLabel(d)}</span></td>
                          <td>{d.owner ? mem.get(d.owner) ?? "-" : "-"}</td>
                          <td className="r tnum">{wonKo(d.status === "won" ? d.won_amount ?? d.amount : d.amount)}</td>
                          <td className="r tnum">{d.closed_at ? ymdKst(d.closed_at).slice(5).replace("-", ".") : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="cx-none">이 기간에 끝난 안건이 없어요.</p>}
            </section>
          </div>
          <div className="cx-rep__col">
            <section className="cx-panel" aria-labelledby="r-won-reasons">
              <div><h2 id="r-won-reasons">수주 이유</h2><p className="cx-cap tnum">{r.won}건</p></div>
              {r.wonReasons.length ? (
                <ul className="cx-hbar">
                  {r.wonReasons.map((x) => <li key={x.reason}><span>{x.reason}</span><span className="cx-hbar__trk"><i style={{ width: `${(x.count / maxWon) * 100}%` }} /></span><span className="tnum cx-muted">{x.count}</span></li>)}
                </ul>
              ) : <p className="cx-none">이 기간에 수주한 안건이 없어요.</p>}
            </section>
            <section className="cx-panel" aria-labelledby="r-reasons">
              <div><h2 id="r-reasons">실패 사유</h2><p className="cx-cap tnum">{r.lost}건</p></div>
              {r.reasons.length ? (
                <ul className="cx-hbar">
                  {r.reasons.map((x) => <li key={x.reason}><span>{x.reason}</span><span className="cx-hbar__trk"><i style={{ width: `${(x.count / maxReason) * 100}%` }} /></span><span className="tnum cx-muted">{x.count}</span></li>)}
                </ul>
              ) : <p className="cx-none">이 기간에 실패한 안건이 없어요.</p>}
            </section>
            <SourcePanel r={r} />
          </div>
        </div>
      )}

      {fc && (
        <div className="cx-rep">
          <div className="cx-rep__col">
            <section className="cx-panel" aria-labelledby="r-fc">
              <div><h2 id="r-fc">계약 예상 달별 금액</h2><p className="cx-cap">진행 중인 안건 {fc.open}건을 안건에 적은 계약 예상일과 금액으로 묶었어요.</p></div>
              {fc.open ? (
                <ul className="cx-fc">
                  <li className="cx-fc__h" aria-hidden="true"><span>계약 예상</span><span>안건</span><span>금액 합계</span><span>수주율 반영</span></li>
                  {fc.buckets.map((b) => (
                    <li key={b.key} data-kind={b.kind}>
                      <span className="cx-fc__nm">{bucketLabel(b)}</span>
                      <span className="tnum"><i>안건</i>{b.count}건{b.noAmount ? <small className="cx-muted"> · 금액 없음 {b.noAmount}</small> : null}</span>
                      <span className="tnum"><i>금액 합계</i>{b.sum ? wonKo(b.sum) : "-"}</span>
                      <span className="tnum"><i>수주율 반영</i>{b.sum && b.weighted != null ? wonKo(b.weighted) : "-"}</span>
                    </li>
                  ))}
                  <li className="cx-fc__sum"><span className="cx-fc__nm">합계</span><span className="tnum"><i>안건</i>{fc.open}건</span><span className="tnum"><i>금액 합계</i>{fc.sum ? wonKo(fc.sum) : "-"}</span><span className="tnum"><i>수주율 반영</i>{fc.sum && fc.weighted != null ? wonKo(fc.weighted) : "-"}</span></li>
                </ul>
              ) : <p className="cx-none">진행 중인 안건이 없어요.</p>}
              {fc.open > 0 && <p className="cx-cap">계약 예상일이나 금액이 비어 있는 안건은 안건 화면에서 채우면 이 표에 들어와요.</p>}
            </section>
          </div>
          <div className="cx-rep__col">
            <section className="cx-panel" aria-labelledby="r-fcr">
              <div><h2 id="r-fcr">단계별 수주율</h2><p className="cx-cap">우리 기관에서 그 단계까지 간 뒤 끝난 안건 중 수주한 비율이에요. 끝난 안건이 {FORECAST_MIN_CLOSED}건보다 적은 단계는 반영하지 않아요.</p></div>
              <dl className="cx-fcr">
                {fc.rates.map((x) => (
                  <div key={x.stage}><dt>{STAGE_LABEL[x.stage]}</dt><dd className="tnum">{x.rate != null ? `${Math.round(x.rate * 100)}%` : "-"}</dd><dd className="cx-cap tnum">{x.closed ? `${x.closed}건 중 ${x.won}건` : "끝난 안건 없음"}</dd></div>
                ))}
              </dl>
            </section>
          </div>
        </div>
      )}

      {q.tab === "a" && (
        <section className="cx-panel" aria-labelledby="r-act">
          <div><h2 id="r-act">사람별 기록</h2><p className="cx-cap">기간 안에 남긴 기록과 끝낸 할 일이에요.</p></div>
          {r.activity.length ? (
            <div className="cx-tablewrap cx-tablewrap--flat">
              <table className="cx-table">
                <thead><tr><th>담당자</th><th className="r">미팅</th><th className="r">통화</th><th className="r">메모</th><th className="r">끝낸 할 일</th></tr></thead>
                <tbody>
                  {r.activity.map((x) => (
                    <tr key={x.member}><td>{x.member}</td><td className="r tnum">{x.meeting}</td><td className="r tnum">{x.call}</td><td className="r tnum">{x.memo}</td><td className="r tnum">{x.tasks}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="cx-none">기관 담당자가 없어요.</p>}
        </section>
      )}
      <p className="cx-foot cx-muted">CRM 숫자는 기관 안에서만 보여요. 단추의 요청 배포나 비교표에는 쓰지 않아요.</p>
    </div>
  );
}

function bucketLabel(b: ForecastBucket): string {
  if (b.kind === "ym") return ym(`${b.key}-01`);
  return b.kind === "late" ? "예상일 지남" : b.kind === "later" ? "그 뒤" : "예상일 없음";
}

/** 고객사별·담당자별 견적 성과 표 */
function PerfTable({ title, id, rows, name, sub, href, narrow = false }: {
  title: string; id: string; rows: PerfRow[]; name: (id: string | null) => string; sub?: (x: PerfRow) => string; href?: (id: string | null) => string | null; narrow?: boolean;
}) {
  return (
    <section className="cx-panel" aria-labelledby={id}>
      <div><h2 id={id}>{title}</h2><p className="cx-cap tnum">{rows.length ? `${rows.length}${title === "담당자별" ? "명" : "곳"} · 보낸 견적이 많은 순` : ""}</p></div>
      {rows.length ? (
        <div className="cx-tablewrap cx-tablewrap--flat">
          <table className={`cx-table cx-table--perf${narrow ? " cx-table--perf-n" : ""}`}>
            <thead><tr><th>{title.replace("별", "")}</th><th className="r">보낸 견적</th><th className="r">선정</th><th className="r">계약</th>{!narrow && <th className="r">선정률</th>}{!narrow && <th className="r">계약 금액</th>}</tr></thead>
            <tbody>
              {rows.slice(0, 20).map((x) => {
                const link = href?.(x.id);
                const s = sub?.(x);
                return (
                  <tr key={x.id ?? "none"}>
                    <td>{link ? <Link href={link} className="cx-tlink">{name(x.id)}</Link> : name(x.id)}{s && <small className="cx-muted cx-cellsub">{s}</small>}</td>
                    <td className="r tnum">{x.sent}</td>
                    <td className="r tnum">{x.selected}</td>
                    <td className="r tnum">{x.contracted}</td>
                    {!narrow && <td className="r tnum">{x.rate != null ? `${x.rate}%` : "-"}</td>}
                    {!narrow && <td className="r tnum">{x.wonSum ? wonKo(x.wonSum) : <span className="cx-muted">-</span>}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="cx-none">{title === "담당자별" ? "견적서에 받는 사람을 정하거나 안건에 담당자를 붙이면 여기에 모여요." : "이 기간에 보낸 견적이 없어요."}</p>}
    </section>
  );
}

function SourcePanel({ r }: { r: ReturnType<typeof buildReport> }) {
  return (
    <section className="cx-panel" aria-labelledby="r-src">
      <div><h2 id="r-src">출처별 수주율</h2></div>
      <dl className="cx-src2">
        {r.bySource.map((s) => (
          <div key={s.key}><dt>{s.label}</dt><dd className="tnum">{s.rate != null ? `${s.rate}%` : "-"}</dd><dd className="cx-cap tnum">{s.closed ? `${s.closed}건 중 ${s.won}건` : "끝난 안건 없음"}</dd></div>
        ))}
      </dl>
    </section>
  );
}

