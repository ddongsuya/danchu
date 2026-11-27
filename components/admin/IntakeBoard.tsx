import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { RfqSummary } from "@/lib/data";
import type { Stuck } from "@/lib/stuck";
import { participationLabel } from "@/lib/request-policy";
import { statusLabel } from "@/lib/status";
import { dday, md, nextDay, todaySeoul } from "@/lib/format";
import { testNamesOf } from "@/lib/quote-items";
import type { Values } from "@/lib/rfq-schema";
import { Pager } from "./Pager";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeadlineForm } from "./DeadlineForm";
import { MopUpButton } from "./AdminActions";
import { LoadError } from "./LoadError";
import { particle } from "./act";
import "@/components/cro/board.css";

/**
 * 운영자 접수 (2026-11-26 시안 v7 a-intake). 위: 제목 + 탭(멈춤 · 진행 · 선정 · 전체) + 검색.
 * 그 아래 흐름 숫자 한 줄(누르면 그 단계만), 표 + 오른쪽 칸(요약·조치·요청 열기).
 * 예전 "이번 주 확인할 것 · 멈춘 요청 · 전체 요청" 세 덩어리를 한 표로 합쳤다.
 */
export type IntakeTab = "stuck" | "live" | "won" | "all";
export type IntakeQuery = { tab: IntakeTab; q: string; status: string; sel: string; page: number };
export const LIVE_STATUSES = ["received", "distributed", "quoted", "compared", "selected", "contracting"];
export const WON_STATUSES = ["selected", "contracting"];
const TAB_LABEL: Record<IntakeTab, string> = { stuck: "멈춤", live: "진행", won: "선정", all: "전체" };
const FLOW: [string, string][] = [["received", "접수"], ["distributed", "참여 안내"], ["quoted", "견적 도착"], ["compared", "비교표 공개"], ["selected", "기관 선정"], ["contracting", "계약 진행"]];

export function intakeHref(q: IntakeQuery, patch: Partial<IntakeQuery>): string {
  const m = { ...q, ...patch };
  const sp = new URLSearchParams();
  if (m.tab !== "stuck") sp.set("tab", m.tab);
  if (m.status) sp.set("status", m.status);
  if (m.q) sp.set("q", m.q);
  if (m.sel) sp.set("sel", m.sel);
  if (m.page > 1) sp.set("page", String(m.page));
  const s = sp.toString();
  return s ? `/admin?${s}` : "/admin";
}

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));

export function IntakeBoard({ list, hasMore, query, counts, stuck, failed = false }: { list: RfqSummary[]; hasMore: boolean; query: IntakeQuery; counts: { stuck: number; live: number; won: number; all: number; byStatus: Record<string, number> }; stuck: Map<string, Stuck[]>; failed?: boolean }) {
  const active = list.find((r) => r.rfq_no === query.sel) ?? list[0] ?? null;
  const why = (r: RfqSummary) => stuck.get(r.rfq_no) ?? [];
  return (
    <div className="bd">
      <div className="bd-hd">
        <h1>접수</h1>
        <nav className="bd-seg" aria-label="거르기">
          {(["stuck", "live", "won", "all"] as IntakeTab[]).map((t) => (
            <Link key={t} href={intakeHref(query, { tab: t, status: "", sel: "", page: 1 })} scroll={false} aria-current={query.tab === t && !query.status ? "page" : undefined}>
              {TAB_LABEL[t]}<em className="tnum">{counts[t]}</em>
            </Link>
          ))}
        </nav>
        <form className="bd-search" action="/admin" role="search">
          {query.tab !== "stuck" && <input type="hidden" name="tab" value={query.tab} />}
          {query.status && <input type="hidden" name="status" value={query.status} />}
          <MagnifyingGlass size={16} aria-hidden="true" />
          <input name="q" defaultValue={query.q} placeholder="번호 · 회사 · 시험물질 · 이메일" aria-label="번호 · 회사 · 시험물질 · 이메일 검색" />
        </form>
      </div>
      <nav className="bd-fn" aria-label="진행 단계">
        {FLOW.map(([k, label]) => (
          <Link key={k} href={intakeHref(query, { tab: "all", status: query.status === k ? "" : k, sel: "", page: 1 })} scroll={false} aria-current={query.status === k ? "true" : undefined}>
            <span>{label}</span>
            <b className="tnum">{counts.byStatus[k] ?? 0}</b>
          </Link>
        ))}
      </nav>
      {failed ? (
        <div className="bd-empty"><LoadError title="접수 목록을 불러오지 못했어요" /></div>
      ) : !active ? (
        <div className="bd-empty">
          {query.q
            ? <EmptyState kind="filtered" title={`'${query.q}'${particle(query.q, "과", "와")} 맞는 요청이 없어요`} action={<Link href={intakeHref(query, { q: "", sel: "", page: 1 })} className="b2 bsm">검색 지우기</Link>} />
            : query.status
              ? <EmptyState kind="filtered" title="이 단계의 요청이 없어요" clearHref={intakeHref(query, { status: "", sel: "", page: 1 })} />
              : query.tab === "stuck"
                ? <EmptyState kind="filtered" title="멈춘 요청이 없어요" action={<Link href={intakeHref(query, { tab: "all", sel: "", page: 1 })} className="b2 bsm">전체 보기</Link>} />
                : query.tab === "all" ? <EmptyState title="접수한 요청이 없어요" /> : <EmptyState kind="filtered" title={`${TAB_LABEL[query.tab]} 요청이 없어요`} action={<Link href={intakeHref(query, { tab: "all", sel: "", page: 1 })} className="b2 bsm">전체 보기</Link>} />}
        </div>
      ) : (
        <div className="bd-split bd-split--adm">
          <div className="bd-l">
            <table className="bd-tb">
              <thead>
                <tr><th>요청 번호</th><th>의뢰자</th><th>시험</th><th className="r">전달</th><th className="r">참여</th><th>상태 · 멈춘 이유</th><th className="r">경과</th></tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const w = why(r);
                  const days = w.length ? Math.max(...w.map((x) => x.days)) : daysSince(r.created_at);
                  return (
                    <tr key={r.id} aria-selected={r.id === active.id}>
                      <td className="bd-mo"><Link href={intakeHref(query, { sel: r.rfq_no })} scroll={false} className="bd-row">{r.rfq_no}</Link></td>
                      <td>{r.company}</td>
                      <td className="bd-tt">{testNamesOf(r.payload as Values) || r.substance}</td>
                      <td className="r tnum">{r.sent}곳</td>
                      <td className="r tnum">{r.joined}곳</td>
                      <td>{w.length ? <span className={`bd-pill ${w.some((x) => x.kind === "no_join") ? "bd-pill--b" : "bd-pill--w"}`}>{w[0].label}{w.length > 1 ? ` 외 ${w.length - 1}` : ""}</span> : <span className="bd-pill bd-pill--o">{statusLabel(r.status, r.outcome)}</span>}</td>
                      <td className="r tnum">{days}일</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ul className="bd-ls">
              {list.map((r) => {
                const w = why(r);
                return (
                  <li key={r.id}>
                    <Link href={`/admin/r/${r.rfq_no}`}>
                      <span className="bd-ls__t"><span className="bd-mo">{r.rfq_no}</span> · {r.company}</span>
                      <span className="bd-ls__s tnum">{[testNamesOf(r.payload as Values) || r.substance, `${r.sent}곳`, `${r.joined}곳`].join(" · ")}</span>
                      {w.length ? <span className={`bd-pill ${w.some((x) => x.kind === "no_join") ? "bd-pill--b" : "bd-pill--w"}`}>{w[0].label}</span> : <span className="bd-pill bd-pill--o">{statusLabel(r.status, r.outcome)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Pager page={query.page} hasMore={hasMore} href={(p) => intakeHref(query, { page: p, sel: "" })} />
          </div>
          <Side r={active} why={why(active)} />
        </div>
      )}
    </div>
  );
}

function Side({ r, why }: { r: RfqSummary; why: Stuck[] }) {
  const dd = r.reply_by ? dday(r.reply_by) : null;
  const props: [string, string][] = [
    ["의뢰자", r.company],
    ["시험", testNamesOf(r.payload as Values) || r.substance],
    ["접수", md(r.created_at)],
    ["전달", r.distributed_at ? `${r.sent}곳 · ${md(r.distributed_at)}` : `${r.sent}곳`],
    ["요약 열람", `${r.opened}곳`],
    ["참여", participationLabel(r)],
    ["회신 기한", r.reply_by ? `${md(r.reply_by)}${dd && ["received", "distributed", "quoted"].includes(r.status) ? ` (${dd.n < 0 ? `${-dd.n}일 지남` : dd.label})` : ""}` : "-"],
  ];
  const today = todaySeoul();
  const open = ["received", "distributed", "quoted"].includes(r.status) && !r.compared_at;
  const min = r.distributed_at && r.reply_by && nextDay(r.reply_by) > today ? nextDay(r.reply_by) : today;
  return (
    <aside className="bd-r" aria-labelledby="ad-title">
      <div className="bd-r__hd">
        <h2 id="ad-title" className="bd-mo">{r.rfq_no}</h2>
      </div>
      <dl className="bd-pr">
        {props.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd className="tnum">{v}</dd></div>))}
      </dl>
      {why.length > 0 && (
        <section className="bd-sec" aria-label="조치">
          <h3 className="bd-h3">조치</h3>
          <ul className="bd-todo">
            {why.flatMap((w) => w.kind === "no_join" || w.kind === "too_soon"
              ? [
                  open && (
                    <li key={`${w.kind}-deadline`}>
                      <span><b>회신 기한 변경</b><small>{r.distributed_at ? "의뢰자 동의 뒤 늘리기만" : w.label}</small></span>
                      <DeadlineForm no={r.rfq_no} current={r.reply_by} min={min} invited={r.sent} distributed={!!r.distributed_at} label="기한 변경" />
                    </li>
                  ),
                  w.kind === "no_join" && (
                    <li key="mop">
                      <span><b>요청 마무리</b><small>의뢰자에게 결과 메일</small></span>
                      <MopUpButton no={r.rfq_no} />
                    </li>
                  ),
                ]
              : [
                  <li key={w.kind}>
                    <span><b>{w.action}</b><small>{w.label}</small></span>
                    <Link href={`/admin/r/${r.rfq_no}`} className="b2 bsm">열기</Link>
                  </li>,
                ])}
          </ul>
        </section>
      )}
      <div className="bd-acts">
        <Link href={`/admin/r/${r.rfq_no}`} className="b1">요청 열기</Link>
      </div>
    </aside>
  );
}
