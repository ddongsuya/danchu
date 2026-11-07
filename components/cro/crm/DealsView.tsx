import Link from "next/link";
import { CaretDown, Kanban, ListBullets, MagnifyingGlass, Plus, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { DEAL_KIND, DEAL_KINDS, STAGE_LABEL, STATUS_LABEL, amountLabel, board, filterDeals, monthClosed, nextLabel, type Stage, type Status } from "@/lib/crm-deals";
import { wonKo, ymdKst } from "@/lib/crm-shape";
import { SheetButton } from "./forms";
import { Board, DealForm, type BoardColumn } from "./deal-ui";
import { buildOpts, qs } from "./opts";
import { rowsOf, type CrmCtx } from "./ctx";
import "./crm.css";

export type DealsQuery = { v: "board" | "list"; f: "" | "mine" | "need" | "nonext"; kind: string; src: "" | "danchu" | "direct"; s: "open" | "won" | "lost" | "all"; q: string };

export function parseDealsQuery(sp: Record<string, string | undefined>): DealsQuery {
  return {
    v: sp.v === "list" ? "list" : "board",
    f: sp.f === "mine" || sp.f === "need" || sp.f === "nonext" ? sp.f : "",
    kind: sp.kind && (DEAL_KINDS as readonly string[]).includes(sp.kind) ? sp.kind : "",
    src: sp.src === "danchu" || sp.src === "direct" ? sp.src : "",
    s: sp.s === "won" || sp.s === "lost" || sp.s === "all" ? sp.s : "open",
    q: (sp.q ?? "").slice(0, 60),
  };
}

/**
 * 안건 보드 (시안 v5 2번). 단계별 열 머리에 건수와 합계 금액, 카드에는 안건 이름 · 고객사 · 금액 · 다음 할 일 · 단계에 머문 날.
 * 단추 요청은 선정 전이라 고객사 대신 요청 번호가 보인다. 목록 보기에는 수주·실패도 있다.
 */
export function DealsView({ c, q }: { c: CrmCtx; q: DealsQuery }) {
  const { data, paths, now, me } = c;
  const all = rowsOf(c);
  const rows = filterDeals(all, { mine: q.f === "mine", kind: q.kind || undefined, source: q.src || undefined, noNext: q.f === "nonext", q: q.q || undefined }).filter((r) => q.f !== "need" || !!r.flag);
  const open = all.filter((r) => r.deal.status === "open");
  const noNext = open.filter((r) => r.flag?.label === "다음 할 일 없음").length;
  const month = monthClosed(data.deals, now);
  const opts = buildOpts({ ...data, me });
  const link = (p: Partial<DealsQuery>) => qs(paths.deals, { ...q, ...p, v: (p.v ?? q.v) === "list" ? "list" : null, s: (p.s ?? q.s) === "open" ? null } as Record<string, string>);
  const cols: BoardColumn[] = board(rows).map((col) => ({
    stage: col.stage, count: col.count, sum: wonKo(col.sum),
    cards: col.rows.map((r) => ({
      id: r.deal.id, title: r.deal.title, href: `${paths.deals}/${r.deal.id}`,
      who: [r.company ?? "", r.contact ? `${r.contact}${r.contactMore ? ` 외 ${r.contactMore}명` : ""}` : ""].filter(Boolean).join(" · ") || "고객사 정하지 않음",
      danchu: !r.company && r.danchuNo ? `${r.danchuNo} · 의뢰자는 선정 뒤 보여요` : null,
      amount: amountLabel(r.deal.amount), next: nextLabel(r.next, now),
      nextKind: r.next ? (r.next.kind === "event" ? (r.next.mode === "phone" ? "call" : r.next.mode === "in_person" ? "meeting" : "event") : r.next.kind) : null,
      flag: r.flag && (r.flag.label === "다음 할 일 없음" || r.flag.tone === "due") ? r.flag.label : null, flagTone: r.flag?.tone ?? null, days: r.days,
    })),
  }));
  const listRows = rows.filter((r) => q.s === "all" || r.deal.status === q.s).sort((x, y) => (y.deal.closed_at ?? y.deal.updated_at).localeCompare(x.deal.closed_at ?? x.deal.updated_at));
  const mem = new Map(data.members.map((m) => [m.id, m.name]));
  return (
    <div className="cx">
      <header className="cx-ph">
        <div>
          <h1>안건</h1>
          <p className="cx-ph__sub">진행 중 <b className="tnum">{open.length}건</b> · <b className="tnum">{wonKo(open.reduce((s, r) => s + (r.deal.amount ?? 0), 0))}</b></p>
        </div>
        <div className="cx-ph__acts">
          <Link href={paths.import} className="b2 bsm"><UploadSimple size={16} aria-hidden="true" />엑셀 가져오기</Link>
          <SheetButton className="b1 bsm" title="안건 만들기" label={<><Plus size={16} aria-hidden="true" />안건 만들기</>}><DealForm opts={opts} base={paths.deals} /></SheetButton>
        </div>
      </header>

      <div className="cx-filters">
        <nav className="cx-seg" aria-label="누구 안건">
          <Link href={link({ f: "" })} aria-current={q.f === "" || q.f === "need" || q.f === "nonext" ? "true" : undefined}>전체 안건</Link>
          <Link href={link({ f: "mine" })} aria-current={q.f === "mine" ? "true" : undefined}>내 안건</Link>
        </nav>
        <details className="cx-dd">
          <summary>{q.kind ? DEAL_KIND[q.kind] : "시험 갈래"}<CaretDown size={14} aria-hidden="true" /></summary>
          <ul>
            <li><Link href={link({ kind: "" })}>전체</Link></li>
            {DEAL_KINDS.map((k) => <li key={k}><Link href={link({ kind: k })} aria-current={q.kind === k ? "true" : undefined}>{DEAL_KIND[k]}</Link></li>)}
          </ul>
        </details>
        <details className="cx-dd">
          <summary>{q.src === "danchu" ? "단추 요청" : q.src === "direct" ? "직접 받은 문의" : "출처"}<CaretDown size={14} aria-hidden="true" /></summary>
          <ul>
            <li><Link href={link({ src: "" })}>전체</Link></li>
            <li><Link href={link({ src: "danchu" })} aria-current={q.src === "danchu" ? "true" : undefined}>단추 요청</Link></li>
            <li><Link href={link({ src: "direct" })} aria-current={q.src === "direct" ? "true" : undefined}>직접 받은 문의</Link></li>
          </ul>
        </details>
        <Link className="cx-pill" href={link({ f: q.f === "nonext" ? "" : "nonext" })} aria-current={q.f === "nonext" ? "true" : undefined}>다음 할 일 없음 <b className="tnum">{noNext}</b></Link>
        <form className="cx-search" action={paths.deals} role="search">
          {q.v === "list" && <input type="hidden" name="v" value="list" />}
          <MagnifyingGlass size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor="deal-q">안건·고객사·담당자 찾기</label>
          <input id="deal-q" name="q" defaultValue={q.q} placeholder="안건, 고객사, 담당자 찾기" maxLength={60} />
        </form>
        <nav className="cx-seg cx-seg--r" aria-label="보기">
          <Link href={link({ v: "board" })} aria-current={q.v === "board" ? "true" : undefined}><Kanban size={15} aria-hidden="true" />보드</Link>
          <Link href={link({ v: "list" })} aria-current={q.v === "list" ? "true" : undefined}><ListBullets size={15} aria-hidden="true" />목록</Link>
        </nav>
      </div>

      {q.v === "board" ? (
        <>
          <Board cols={cols} />
          <p className="cx-foot">
            <span>이번 달 수주 <b className="tnum">{month.won}건 · {wonKo(month.wonSum)}</b></span>
            <span>이번 달 실패 <b className="tnum">{month.lost}건</b></span>
            <span className="cx-muted">수주·실패는 보드에서 빠지고 <Link href={link({ v: "list", s: "all" })} className="cx-lk">목록 보기</Link>와 보고서에 남아요.</span>
          </p>
        </>
      ) : (
        <>
          <nav className="cx-tabs2" aria-label="상태">
            {(["open", "won", "lost", "all"] as const).map((s) => (
              <Link key={s} href={link({ s })} aria-current={q.s === s ? "page" : undefined}>{s === "all" ? "전체" : STATUS_LABEL[s]} <span className="tnum">{s === "all" ? rows.length : rows.filter((r) => r.deal.status === s).length}</span></Link>
            ))}
          </nav>
          {listRows.length ? (
            <div className="cx-tablewrap">
              <table className="cx-table">
                <thead><tr><th>안건</th><th>고객사</th><th>단계</th><th>다음 할 일</th><th>담당 영업</th><th className="r">금액</th><th className="r">머문 날</th></tr></thead>
                <tbody>
                  {listRows.map((r) => (
                    <tr key={r.deal.id}>
                      <td><Link href={`${paths.deals}/${r.deal.id}`} className="cx-tlink">{r.deal.title}</Link>{r.danchuNo && <small className="cx-muted"> · 단추 {r.danchuNo}</small>}</td>
                      <td>{r.company ?? <span className="cx-muted">{r.danchuNo ? "선정 뒤 보여요" : "-"}</span>}</td>
                      <td>{r.deal.status === "open" ? <span className="cx-st">{STAGE_LABEL[r.deal.stage as Stage]}</span> : <span className={`cx-st cx-st--${r.deal.status}`}>{STATUS_LABEL[r.deal.status as Status]}{r.deal.lost_reason ? ` · ${r.deal.lost_reason}` : ""}</span>}</td>
                      <td>{r.deal.status === "open" ? (r.flag?.label === "다음 할 일 없음" ? <span className="cx-flag cx-flag--warn">다음 할 일 없음</span> : nextLabel(r.next, now) || "-") : <span className="cx-muted tnum">{r.deal.closed_at ? ymdKst(r.deal.closed_at) : ""}</span>}</td>
                      <td>{r.deal.owner ? mem.get(r.deal.owner) ?? "-" : "-"}</td>
                      <td className="r tnum">{amountLabel(r.deal.status === "won" ? r.deal.won_amount ?? r.deal.amount : r.deal.amount)}</td>
                      <td className="r tnum">{r.deal.status === "open" ? `${r.days}일` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="cx-none">조건에 맞는 안건이 없어요.</p>}
        </>
      )}
    </div>
  );
}
