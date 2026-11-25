import Link from "next/link";
import { LockSimple, MagnifyingGlass, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { TAB_LABEL, type PipeItem, type PipeTab } from "@/lib/pipeline";
import { dday, won, ymd } from "@/lib/format";
import { contractReportDue } from "@/lib/contract-reminder";
import { ContractReport } from "./ContractReport";
import { SubstanceForm } from "./SubstanceForm";
import type { CroPaths } from "./Pipeline";
import "./requests-board.css";

/**
 * 받은 요청 (2026-11-26 시안 v7 c-req · c-req-submitted · c-req-won).
 * 위: 제목 + 분할 탭(전체 · 새 요청 · 작성 중 · 제출 · 선정) + 검색. 그 아래 거르기 칩과 건수.
 * 전체·새 요청·작성 중: 표 + 오른쪽 상세 칸. 제출: 견적 표. 선정: 표 + 오른쪽 계약 결과 보고·시험물질 필요량.
 * 휴대폰: 표 대신 두 줄 목록, 상세는 요청 화면으로 바로 간다.
 * 거르기 값과 검색은 주소(?tab ?q ?cat ?due ?glp ?sp ?sel)에 두어 새로고침·뒤로 가기에도 남는다.
 */
export type Tab = "all" | Exclude<PipeTab, "other">;
export type BoardQuery = { tab: Tab; q: string; cat: string; due: string; glp: string; sp: string; sel: string | null };
export type AwardLite = {
  id: string;
  inviteId: string | null;
  no: string;
  title: string;
  awardedAt: string;
  reportedAt: string | null;
  contractAmount: number | null;
  quoteAmount: number | null;
  substanceQty: string;
  substanceWhen: string;
  substanceNote: string;
  substanceAt: string | null;
  sponsorSigned: boolean;
  contractDate: string | null;
  gapReason: string;
  contractNote: string;
  confirmLabel: string;
  client: { company: string; name: string; email: string; phone: string };
};

const TABS: Tab[] = ["all", "new", "draft", "sent", "won"];
const DUE_OPTS: [string, string][] = [["7", "7일 안"], ["14", "14일 안"], ["30", "30일 안"]];

export function href(base: string, q: BoardQuery, patch: Partial<BoardQuery>): string {
  const m = { ...q, ...patch };
  const sp = new URLSearchParams();
  if (m.tab !== "all") sp.set("tab", m.tab);
  if (m.q) sp.set("q", m.q);
  if (m.cat) sp.set("cat", m.cat);
  if (m.due) sp.set("due", m.due);
  if (m.glp) sp.set("glp", m.glp);
  if (m.sp) sp.set("sp", m.sp);
  if (m.sel) sp.set("sel", m.sel);
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

export function filterItems(items: PipeItem[], q: BoardQuery, today: string): PipeItem[] {
  const needle = q.q.trim().toLowerCase();
  const limit = q.due ? new Date(`${today}T00:00:00+09:00`).getTime() + Number(q.due) * 864e5 : 0;
  return items.filter((x) => {
    if (q.tab !== "all" && x.tab !== q.tab) return false;
    if (needle && !`${x.no} ${x.tests} ${x.title} ${x.cats}`.toLowerCase().includes(needle)) return false;
    if (q.cat && !x.cats.split(" · ").includes(q.cat)) return false;
    if (q.glp && !x.glp.includes(q.glp)) return false;
    if (q.sp && !x.species.includes(q.sp)) return false;
    if (q.due) {
      if (!x.replyBy || x.replyBy < today) return false;
      if (new Date(`${x.replyBy}T00:00:00+09:00`).getTime() > limit) return false;
    }
    return true;
  });
}

const md = (d: string) => (d ? `${d.slice(5, 7)}-${d.slice(8, 10)}` : "-");

function Pill({ item }: { item: PipeItem }) {
  // 시안: 참여 결정 전 = 검정, 작성 중 = 회색, 제출·선정·끝남 = 테두리
  const kind = item.tab === "new" ? "rq-pill--b" : item.tab === "draft" ? "rq-pill--w" : "rq-pill--o";
  return <span className={`rq-pill ${kind}`}>{item.stageLabel}</span>;
}

function Chip({ label, value, opts, base, q, k }: { label: string; value: string; opts: [string, string][]; base: string; q: BoardQuery; k: "cat" | "due" | "glp" | "sp" }) {
  if (!opts.length) return null;
  const cur = opts.find(([v]) => v === value);
  return (
    <details className="rq-chip">
      <summary className={cur ? "is-on" : undefined}>
        {cur ? cur[1] : label}
        <CaretDown size={12} aria-hidden="true" />
      </summary>
      <div className="rq-menu" role="list">
        <Link role="listitem" href={href(base, q, { [k]: "", sel: null })} scroll={false} aria-current={!cur ? "true" : undefined}>전체</Link>
        {opts.map(([v, l]) => (
          <Link role="listitem" key={v} href={href(base, q, { [k]: v, sel: null })} scroll={false} aria-current={v === value ? "true" : undefined}>{l}</Link>
        ))}
      </div>
    </details>
  );
}

export function RequestsBoard({ items, awards, query, paths, companyOf, today, base = "/cro/requests" }: { items: PipeItem[]; awards: AwardLite[]; query: BoardQuery; paths: CroPaths; companyOf: Record<string, string>; today: string; base?: string }) {
  const counts: Record<Tab, number> = { all: items.length, new: 0, draft: 0, sent: 0, won: 0 };
  for (const x of items) if (x.tab !== "other") counts[x.tab]++;
  const tabs = TABS.filter((t) => t !== "won" || counts.won > 0 || query.tab === "won");
  // 표는 받은 날 최근 순 (시안 c-req). 할 일 순서는 "오늘" 화면이 맡는다
  const shown = filterItems(items, query, today).sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.no.localeCompare(a.no));
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const catOpts = uniq(items.flatMap((x) => x.cats.split(" · "))).map((v) => [v, v] as [string, string]);
  const glpOpts = uniq(items.flatMap((x) => x.glp)).map((v) => [v, v] as [string, string]);
  const spOpts = uniq(items.flatMap((x) => x.species)).map((v) => [v, v] as [string, string]);
  const filtered = !!(query.q || query.cat || query.due || query.glp || query.sp);

  return (
    <div className="rq">
      <div className="rq-hd">
        <h1>받은 요청</h1>
        <nav className="rq-seg" aria-label="단계">
          {tabs.map((t) => (
            <Link key={t} href={href(base, query, { tab: t, sel: null })} scroll={false} aria-current={query.tab === t ? "page" : undefined}>
              {t === "all" ? "전체" : TAB_LABEL[t]}
              <em className="tnum">{counts[t]}</em>
            </Link>
          ))}
        </nav>
        <form className="rq-search" action={base} role="search">
          {query.tab !== "all" && <input type="hidden" name="tab" value={query.tab} />}
          <MagnifyingGlass size={16} aria-hidden="true" />
          <input name="q" defaultValue={query.q} placeholder="요청 번호·시험 이름" aria-label="요청 번호·시험 이름 검색" />
        </form>
      </div>

      {query.tab === "won" ? (
        <WonView awards={awards} query={query} base={base} />
      ) : (
        <>
          <div className="rq-flt">
            <Chip label="시험 종류" k="cat" value={query.cat} opts={catOpts} base={base} q={query} />
            <Chip label="회신 기한" k="due" value={query.due} opts={DUE_OPTS} base={base} q={query} />
            <Chip label="GLP" k="glp" value={query.glp} opts={glpOpts} base={base} q={query} />
            <Chip label="동물종" k="sp" value={query.sp} opts={spOpts} base={base} q={query} />
            {filtered && <Link href={href(base, query, { q: "", cat: "", due: "", glp: "", sp: "", sel: null })} className="rq-reset" scroll={false}>거르기 해제</Link>}
            <span className="rq-n tnum">{shown.length}건</span>
          </div>
          {query.tab === "sent" ? <SentView items={shown} /> : <MainView items={shown} query={query} base={base} paths={paths} companyOf={companyOf} filtered={filtered} />}
        </>
      )}
    </div>
  );
}

function Empty({ filtered, base, query }: { filtered: boolean; base: string; query: BoardQuery }) {
  return (
    <div className="rq-empty">
      <b>{filtered ? "맞는 요청이 없어요" : "이 단계의 요청이 없어요"}</b>
      {filtered && <Link href={href(base, query, { q: "", cat: "", due: "", glp: "", sp: "", sel: null })} className="b2 bsm">거르기 해제</Link>}
    </div>
  );
}

function MainView({ items, query, base, paths, companyOf, filtered }: { items: PipeItem[]; query: BoardQuery; base: string; paths: CroPaths; companyOf: Record<string, string>; filtered: boolean }) {
  if (!items.length) return <Empty filtered={filtered} base={base} query={query} />;
  const active = items.find((x) => x.id === query.sel) ?? items[0];
  return (
    <div className="rq-split">
      <div className="rq-l">
        <table className="rq-tb">
          <thead>
            <tr><th>요청 번호</th><th>시험</th><th>조건</th><th>받은 날</th><th>회신 기한</th><th>상태</th></tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id} aria-selected={x.id === active.id}>
                <td className="rq-mo"><Link href={href(base, query, { sel: x.id })} scroll={false} className="rq-row">{x.no}</Link></td>
                <td className="rq-tt">{x.tests}</td>
                <td className="rq-mut">{x.cond || "-"}</td>
                <td className="tnum">{md(x.sentAt)}</td>
                <td className="tnum">{md(x.replyBy)}</td>
                <td><Pill item={x} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="rq-ls">
          {items.map((x) => (
            <li key={x.id}>
              <Link href={`/cro/r/${x.id}`}>
                <span className="rq-ls__t"><span className="rq-mo">{x.no}</span> · {x.tests}</span>
                <span className="rq-ls__s tnum">{[x.cond, md(x.sentAt), md(x.replyBy)].filter((v) => v && v !== "-").join(" · ")}</span>
                <Pill item={x} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Detail item={active} paths={paths} companyOf={companyOf} />
    </div>
  );
}

function Detail({ item, paths, companyOf }: { item: PipeItem; paths: CroPaths; companyOf: Record<string, string> }) {
  const dd = item.replyBy ? dday(item.replyBy) : null;
  const props: [string, React.ReactNode][] = [
    ["시험", item.tests],
    [
      "의뢰자",
      item.client ? (
        item.clientKey && paths.clients ? <Link href={companyOf[item.clientKey] ? `${paths.clients}/${companyOf[item.clientKey]}` : paths.clients}>{item.client}</Link> : item.client
      ) : (
        <span className="rq-lock"><LockSimple size={13} aria-hidden="true" />{item.clientHint.replace(" · 이름은 선정 뒤 공개", "")} · 선정 뒤 공개</span>
      ),
    ],
    ["분야", item.cats || "-"],
    ...(item.cond ? ([["조건", item.cond]] as [string, string][]) : []),
    ...(item.replyBy ? ([["회신 기한", `${md(item.replyBy)}${dd && item.tab !== "sent" && item.tab !== "other" ? ` (${dd.label})` : ""}`]] as [string, string][]) : []),
    ...item.money.filter(([k]) => k !== "회신 기한"),
    ["다음 할 일", item.next],
  ];
  return (
    <aside className="rq-r" aria-labelledby="rq-title">
      <div className="rq-r__hd">
        <h2 id="rq-title" className="rq-mo">{item.no}</h2>
        <Pill item={item} />
      </div>
      <dl className="rq-pr">
        {props.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd className="tnum">{v}</dd></div>
        ))}
      </dl>
      <div className="rq-acts">
        {item.action?.href === `/cro/r/${item.id}` ? (
          <Link href={item.action.href} className={item.tab === "new" ? "b1" : "b2"}>{item.action.label}</Link>
        ) : (
          <>
            <Link href={`/cro/r/${item.id}`} className="b2">요청서 전체 보기</Link>
            {item.action && <Link href={item.action.href} className="b1">{item.action.label}</Link>}
          </>
        )}
      </div>
    </aside>
  );
}

function SentView({ items }: { items: PipeItem[] }) {
  if (!items.length) return <div className="rq-empty"><b>제출한 견적이 없어요</b></div>;
  return (
    <div className="rq-full">
      <p className="rq-cap">비교표가 열린 뒤에는 고치거나 다시 제출할 수 없어요.</p>
      <table className="rq-tb">
        <thead>
          <tr><th>요청</th><th className="r">총액</th><th className="r">기간</th><th>제출일</th><th>회신 기한</th><th>진행</th><th /></tr>
        </thead>
        <tbody>
          {items.map((x) => (
            <tr key={x.id}>
              <td className="rq-tt"><span className="rq-mo">{x.no}</span> · {x.tests}</td>
              <td className="r tnum">{x.total != null ? x.total.toLocaleString("ko-KR") : "-"}</td>
              <td className="r tnum">{x.weeks ? `${x.weeks}주` : "-"}</td>
              <td className="tnum">{md(x.submittedOn)}</td>
              <td className="tnum">{md(x.replyBy)}</td>
              <td><span className={`rq-pill ${x.stageLabel === "미선정" ? "rq-pill--b" : x.stageLabel === "비교표 열림" ? "rq-pill--o" : "rq-pill--w"}`}>{x.stageLabel === "제출" ? "선정 결과 대기" : x.stageLabel}</span></td>
              <td className="r"><Link href={`/cro/r/${x.id}`} className="b2 bsm">견적 보기</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="rq-ls">
        {items.map((x) => (
          <li key={x.id}>
            <Link href={`/cro/r/${x.id}`}>
              <span className="rq-ls__t"><span className="rq-mo">{x.no}</span> · {x.tests}</span>
              <span className="rq-ls__s tnum">{[x.total != null ? won(x.total) : "", x.weeks ? `${x.weeks}주` : "", md(x.submittedOn)].filter(Boolean).join(" · ")}</span>
              <span className="rq-pill rq-pill--o">{x.stageLabel === "제출" ? "선정 결과 대기" : x.stageLabel}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WonView({ awards, query, base }: { awards: AwardLite[]; query: BoardQuery; base: string }) {
  const needle = query.q.trim().toLowerCase();
  const list = needle ? awards.filter((a) => `${a.no} ${a.title}`.toLowerCase().includes(needle)) : awards;
  if (!list.length) return <div className="rq-empty"><b>{needle ? "맞는 요청이 없어요" : "아직 선정된 요청이 없어요"}</b></div>;
  const a = list.find((x) => x.id === query.sel) ?? list.find((x) => !x.reportedAt) ?? list[0];
  return (
    <div className="rq-split rq-split--won">
      <div className="rq-l">
        <table className="rq-tb">
          <thead>
            <tr><th>요청</th><th>선정일</th><th>계약 결과</th><th>시험물질</th></tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id} aria-selected={x.id === a.id}>
                <td className="rq-tt"><Link href={href(base, query, { sel: x.id })} scroll={false} className="rq-row"><span className="rq-mo">{x.no}</span> · {x.title}</Link></td>
                <td className="tnum">{md(ymd(x.awardedAt))}</td>
                <td><span className={`rq-pill ${x.reportedAt ? "rq-pill--o" : "rq-pill--b"}`}>{x.reportedAt ? "보고함" : "보고 전"}</span></td>
                <td><span className={`rq-pill ${x.substanceAt ? "rq-pill--o" : "rq-pill--w"}`}>{x.substanceAt ? "적음" : "필요량 적기"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="rq-ls">
          {list.map((x) => (
            <li key={x.id}>
              <Link href={href(base, query, { sel: x.id })} scroll={false}>
                <span className="rq-ls__t"><span className="rq-mo">{x.no}</span> · {x.title}</span>
                <span className="rq-ls__s tnum">선정 {md(ymd(x.awardedAt))}</span>
                <span className={`rq-pill ${x.reportedAt ? "rq-pill--o" : "rq-pill--b"}`}>{x.reportedAt ? "보고함" : "보고 전"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <aside className="rq-r rq-r--won" aria-labelledby="rq-won-title">
        <div className="rq-r__hd">
          <h2 id="rq-won-title"><span className="rq-mo">{a.no}</span> · {a.title}</h2>
        </div>
        <dl className="rq-pr">
          <div><dt>의뢰자</dt><dd>{a.client.company}</dd></div>
          <div><dt>담당</dt><dd>{[a.client.name, a.client.email, a.client.phone].filter(Boolean).join(" · ")}</dd></div>
          <div><dt>선정일</dt><dd className="tnum">{ymd(a.awardedAt)}</dd></div>
          {!a.reportedAt && <div><dt>보고 기한</dt><dd className="tnum">{ymd(contractReportDue(a.awardedAt))}</dd></div>}
          <div><dt>선정 금액</dt><dd className="tnum">{a.quoteAmount != null ? won(a.quoteAmount) : "-"}</dd></div>
          {a.reportedAt && <div><dt>체결일</dt><dd className="tnum">{a.contractDate ?? "-"}</dd></div>}
          {a.reportedAt && <div><dt>계약 금액</dt><dd className="tnum">{won(a.contractAmount ?? 0)}</dd></div>}
          {a.reportedAt && a.gapReason && <div><dt>차이 사유</dt><dd>{a.gapReason}</dd></div>}
          {a.reportedAt && a.contractNote && <div><dt>비고</dt><dd>{a.contractNote}</dd></div>}
          {a.reportedAt && a.confirmLabel && <div><dt>확인</dt><dd>{a.confirmLabel}</dd></div>}
        </dl>
        {!a.reportedAt && a.sponsorSigned && <p className="note note--warn" role="status">의뢰자가 계약했다고 알려 왔어요.</p>}
        {!a.reportedAt && (
          <section className="rq-sec" aria-label="계약 결과 보고">
            <ContractReport awardId={a.id} quoteAmount={a.quoteAmount} />
          </section>
        )}
        <section className="rq-sec" aria-label="시험물질 필요량">
          <SubstanceForm awardId={a.id} qty={a.substanceQty} when={a.substanceWhen} note={a.substanceNote} updatedAt={a.substanceAt} />
        </section>
        <div className="rq-acts">
          <Link href={`/cro/awards/${a.id}/contract`} className="b2">계약서(안)</Link>
          {a.inviteId && <Link href={`/cro/r/${a.inviteId}`} className="b2">요청서 전체 보기</Link>}
        </div>
      </aside>
    </div>
  );
}
