/**
 * 견적서 4부의 A4 페이지 (표지 · 견적서 · 시험 상세 설명 · 시험 수행 일정표).
 * PDF 저장(인쇄)·편집 화면의 미리보기·양식 미리보기가 같은 페이지를 쓴다. 상태가 없는 표시 전용 컴포넌트.
 * 문서는 화면 테마와 상관없이 종이색으로 고정한다 (quote.css .qd).
 */
import { docTotals, inkOn, mainAnimals, recoveryAnimals, scheduleWeeks, testLines, type DocData, type DocHead, type DocTest, type QuoteStyle } from "@/lib/quote-doc";

const n = (v: number) => v.toLocaleString("ko-KR");

export type PageKey = "cover" | "quote" | `detail:${string}` | "schedule";
export const pageKeys = (d: DocData): PageKey[] => ["cover", "quote", ...d.tests.map((t) => `detail:${t.uid}` as PageKey), "schedule"];

export function Logo({ style }: { style: QuoteStyle }) {
  if (style.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="qd__logo" src={style.logo} alt={style.supplier.name || "기관 로고"} />;
  }
  return <span className="qd__logotext">{style.supplier.name || "기관명"}</span>;
}

function Head({ head, style, right }: { head: DocHead; style: QuoteStyle; right: React.ReactNode }) {
  return (
    <header className="qd__head" data-pos={style.logoPos}>
      <Logo style={style} />
      <div className="qd__meta">{right}</div>
    </header>
  );
}

function Foot({ label, i, total }: { label: string; i: number; total: number }) {
  return (
    <footer className="qd__foot">
      <span>{label}</span>
      <span className="qd__num">{i} / {total}</span>
    </footer>
  );
}

/** 시험 조건 한 줄 요약: "랫드 · 경구 · GLP" */
export function condLine(t: DocTest): string {
  return [t.cond.species, t.cond.route, t.cond.glp].filter(Boolean).join(" · ");
}
/** 군 구성 요약: "4군, 126마리" */
export function groupLine(t: DocTest): string {
  if (!t.groups.length) return "";
  return `${t.groups.length}군, ${mainAnimals(t.groups) + recoveryAnimals(t.groups)}마리`;
}

export function Cover({ head, data, style, i, total }: { head: DocHead; data: DocData; style: QuoteStyle; i: number; total: number }) {
  const glp = [...new Set(data.tests.map((t) => t.cond.glp).filter(Boolean))].join(", ");
  return (
    <section className="qd qd--cover" style={brandVars(style)}>
      <Head head={head} style={style} right={<div>견적번호 <span className="qd__num">{head.docNo}</span></div>} />
      <div className="qd__cover">
        <h1 className="qd__title">견적서</h1>
        <p className="qd__sub">{head.title}</p>
      </div>
      <dl className="qd__kv">
        <div><dt>의뢰자</dt><dd>{head.client || " "}</dd></div>
        {head.substance && <div><dt>시험물질</dt><dd>{head.substance}</dd></div>}
        {glp && <div><dt>시험 기준</dt><dd>{glp}</dd></div>}
        <div><dt>작성일</dt><dd className="qd__num">{head.issuedOn}</dd></div>
        {head.validUntil && <div><dt>견적 유효기간</dt><dd><span className="qd__num">{head.validUntil}</span>까지</dd></div>}
      </dl>
      {data.tests.length > 0 && (
        <div className="qd__incl">
          <h2>포함 시험</h2>
          <ol>{data.tests.map((t) => <li key={t.uid}>{t.title}{condLine(t) ? ` (${condLine(t)})` : ""}</li>)}</ol>
        </div>
      )}
      <div className="qd__supplier">
        <div>
          <span className="qd__cap">공급자</span>
          <b>{style.supplier.name || "기관명"}</b>
          {[style.supplier.address, style.supplier.contact].filter(Boolean).join(" · ") && <span>{[style.supplier.address, style.supplier.contact].filter(Boolean).join(" · ")}</span>}
          {[style.supplier.person, style.supplier.email].filter(Boolean).join(" · ") && <span>{[style.supplier.person, style.supplier.email].filter(Boolean).join(" · ")}</span>}
        </div>
        <span className="qd__num">{i} / {total}</span>
      </div>
    </section>
  );
}

export function QuotePage({ head, data, style, i, total }: { head: DocHead; data: DocData; style: QuoteStyle; i: number; total: number }) {
  const t = docTotals(data);
  const weeks = scheduleWeeks(data);
  const v = data.visible;
  const days = head.validUntil ? Math.round((Date.parse(head.validUntil) - Date.parse(head.issuedOn)) / 864e5) : 0;
  const terms: [string, React.ReactNode][] = [];
  if (head.validUntil) terms.push(["견적 유효기간", <><span className="qd__num">{head.validUntil}</span>까지{days > 0 ? ` (작성일부터 ${days}일)` : ""}</>]);
  if (weeks) terms.push(["수행 기간", `착수부터 최종 보고서까지 ${weeks}주 (4부 일정표)`]);
  if (data.terms.pay) terms.push(["결제 조건", data.terms.pay]);
  if (data.terms.extra) terms.push(["별도 비용", data.terms.extra]);
  if (data.terms.note) terms.push(["비고", data.terms.note]);
  return (
    <section className="qd" style={brandVars(style)}>
      <Head head={head} style={style} right={<><div>견적번호 <span className="qd__num">{head.docNo}</span></div><div>작성일 <span className="qd__num">{head.issuedOn}</span></div></>} />
      <h1 className="qd__h1">견적서</h1>
      <p className="qd__lead">아래와 같이 견적합니다. 금액 단위 원, 부가세 별도.</p>
      <h2 className="qd__h2">견적 내역</h2>
      <table className="qd__items">
        <thead><tr><th className="qd__no">No</th><th>시험</th><th>조건</th><th className="r">기간</th>{v.perTest && <th className="r">금액</th>}</tr></thead>
        {data.tests.map((x, idx) => {
          const c = testLines(x);
          const showAdj = v.perTest && v.adjust && c.lines.length > 0;
          return (
            <tbody key={x.uid}>
              <tr className="qd__test">
                <td className="qd__no">{idx + 1}</td>
                <td><b>{x.title}</b>{x.subtitle && <small>{x.subtitle}</small>}</td>
                <td>{condLine(x)}{groupLine(x) && <small>{groupLine(x)}</small>}</td>
                <td className="r">{x.weeks ? `${x.weeks}주` : ""}</td>
                {v.perTest && <td className="r qd__num qd__amt">{n(c.total)}</td>}
              </tr>
              {showAdj && (
                <>
                  <tr className="qd__adj"><td /><td colSpan={3}>표준가{x.std.summary ? ` (${x.std.summary})` : ""}</td><td className="r qd__num">{n(c.base)}</td></tr>
                  {c.lines.map((l, k) => (
                    <tr className="qd__adj" key={k}><td /><td colSpan={3}>{l.label}{v.formula && l.kind !== "extra" ? <span className="qd__formula"> {l.formula}</span> : null}</td><td className="r qd__num">{l.amount < 0 ? `- ${n(-l.amount)}` : n(l.amount)}</td></tr>
                  ))}
                </>
              )}
            </tbody>
          );
        })}
      </table>
      <dl className="qd__totals">
        {t.discount > 0 && <><div><dt>시험 금액 합계</dt><dd className="qd__num">{n(t.sum)}</dd></div><div><dt>할인</dt><dd className="qd__num">- {n(t.discount)}</dd></div></>}
        <div><dt>공급가액</dt><dd className="qd__num">{n(t.supply)}</dd></div>
        <div><dt>부가세 (10%)</dt><dd className="qd__num">{n(t.vat)}</dd></div>
        <div className="qd__grand"><dt>합계금액</dt><dd className="qd__num">{n(t.grand)}</dd></div>
      </dl>
      {terms.length > 0 && (
        <>
          <h2 className="qd__h2">거래 조건</h2>
          <dl className="qd__terms">{terms.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}</dl>
        </>
      )}
      <div className="qd__sign"><span>담당자</span><span>기관 직인</span></div>
      <Foot label="2부 견적서" i={i} total={total} />
    </section>
  );
}

export function GroupTable({ t }: { t: DocTest }) {
  const rec = t.groups.some((g) => g.rm + g.rf > 0);
  const sum = (k: "m" | "f" | "rm" | "rf") => t.groups.reduce((a, g) => a + g[k], 0);
  return (
    <table className="qd__groups">
      <thead>
        {rec && <tr><th /><th /><th colSpan={2} className="c">본시험군</th><th colSpan={2} className="c">회복군</th><th /></tr>}
        <tr><th>군</th><th>용량</th><th className="r">수컷</th><th className="r">암컷</th>{rec && <><th className="r">수컷</th><th className="r">암컷</th></>}<th className="r">합계</th></tr>
      </thead>
      <tbody>
        {t.groups.map((g) => (
          <tr key={g.id}><td>{g.label}</td><td>{g.dose}</td><td className="r qd__num">{g.m}</td><td className="r qd__num">{g.f}</td>{rec && <><td className="r qd__num">{g.rm || "-"}</td><td className="r qd__num">{g.rf || "-"}</td></>}<td className="r qd__num">{g.m + g.f + g.rm + g.rf}</td></tr>
        ))}
      </tbody>
      <tfoot><tr><td>합계</td><td /><td className="r qd__num">{sum("m")}</td><td className="r qd__num">{sum("f")}</td>{rec && <><td className="r qd__num">{sum("rm")}</td><td className="r qd__num">{sum("rf")}</td></>}<td className="r qd__num">{mainAnimals(t.groups) + recoveryAnimals(t.groups)}</td></tr></tfoot>
    </table>
  );
}

export const COND_LABEL: [keyof DocTest["cond"], string][] = [["species", "실험동물"], ["route", "투여경로"], ["dosing", "투여기간"], ["recovery", "회복기간"], ["glp", "시험 기준"], ["guideline", "참고 가이드라인"]];

export function DetailPage({ head, t, idx, count, style, i, total }: { head: DocHead; t: DocTest; idx: number; count: number; style: QuoteStyle; i: number; total: number }) {
  const evals = t.evals.filter((e) => e.on);
  return (
    <section className="qd" style={brandVars(style)}>
      <Head head={head} style={style} right={<><div>견적번호 <span className="qd__num">{head.docNo}</span></div><div>작성일 <span className="qd__num">{head.issuedOn}</span></div></>} />
      <p className="qd__cap">시험 {idx + 1} / {count}</p>
      <h1 className="qd__h1">{t.title}</h1>
      {t.subtitle && <p className="qd__lead">{t.subtitle}</p>}
      <h2 className="qd__h2">시험 조건</h2>
      <dl className="qd__cond">{COND_LABEL.filter(([k]) => t.cond[k] && !(k === "recovery" && !t.groups.length && t.cond[k] === "없음")).map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{t.cond[k]}</dd></div>)}</dl>
      {t.groups.length > 0 && <><h2 className="qd__h2">군 구성</h2><GroupTable t={t} /></>}
      {evals.length > 0 && <><h2 className="qd__h2">평가항목</h2><ul className="qd__evals">{evals.map((e) => <li key={e.name}>{e.name}</li>)}</ul></>}
      {t.description && <><h2 className="qd__h2">시험 설명</h2><p className="qd__desc">{t.description}</p></>}
      <Foot label="3부 시험 상세 설명" i={i} total={total} />
    </section>
  );
}

export function SchedulePage({ head, data, style, i, total }: { head: DocHead; data: DocData; style: QuoteStyle; i: number; total: number }) {
  const W = Math.max(1, scheduleWeeks(data));
  // 주 머리글: 30주까지는 매주, 그 뒤로는 간격을 둔다
  const step = W <= 30 ? 1 : W <= 60 ? 2 : W <= 120 ? 4 : 8;
  const ticks = Array.from({ length: W }, (_, k) => k + 1);
  const pct = (w: number) => `${(w / W) * 100}%`;
  return (
    <section className="qd qd--land" style={brandVars(style)}>
      <Head head={head} style={style} right={<><div>견적번호 <span className="qd__num">{head.docNo}</span></div><div>4부 시험 수행 일정표</div></>} />
      <h1 className="qd__h1">시험 수행 일정표</h1>
      <p className="qd__lead">시험물질 입고 주를 1주로 셉니다. 착수일이 정해지면 날짜로 다시 맞춥니다.</p>
      <div className="qd__gantt" style={{ ["--w" as string]: W }}>
        <div className="qd__grow qd__ghead">
          <span>시험</span><span>단계</span>
          <div className="qd__gweeks">{ticks.map((k) => <span key={k} style={{ left: pct(k - 1), width: pct(1) }}>{(k - 1) % step === 0 ? k : ""}</span>)}</div>
        </div>
        {data.tests.map((t) => t.phases.map((p, k) => (
          <div className="qd__grow" key={`${t.uid}-${p.id}`}>
            <b>{k === 0 ? t.title : ""}</b>
            <span>{p.name}</span>
            <div className="qd__gtrack">
              {p.kind === "point"
                ? <i className="qd__pt" style={{ left: `calc(${pct(t.startWeek + p.start)} + ${100 / W / 2}% - 5px)` }} />
                : <i className={`qd__bar qd__bar--${p.kind}`} style={{ left: pct(t.startWeek + p.start), width: pct(Math.min(p.weeks, W - t.startWeek - p.start)) }} />}
            </div>
          </div>
        )))}
      </div>
      <div className="qd__legend">
        <span><i className="qd__bar qd__bar--run" />투여와 수행</span>
        <span><i className="qd__bar qd__bar--recovery" />회복</span>
        <span><i className="qd__bar qd__bar--report" />준비와 보고</span>
        <span><i className="qd__pt" />시점</span>
      </div>
      <p className="qd__total"><b>{W}주</b> 착수부터 최종 보고서까지</p>
      <Foot label="4부 시험 수행 일정표" i={i} total={total} />
    </section>
  );
}

export function brandVars(style: QuoteStyle): React.CSSProperties {
  const c = style.brandColor && /^#[0-9a-f]{6}$/i.test(style.brandColor) ? style.brandColor : "#1b1b19";
  return { ["--qd-brand" as string]: c, ["--qd-on" as string]: inkOn(c) };
}

/** 4부 전체 (인쇄·PDF) */
export function DocPages({ head, data, style }: { head: DocHead; data: DocData; style: QuoteStyle }) {
  const total = 3 + data.tests.length;
  return (
    <div className="qd-pages">
      <Cover head={head} data={data} style={style} i={1} total={total} />
      <QuotePage head={head} data={data} style={style} i={2} total={total} />
      {data.tests.map((t, k) => <DetailPage key={t.uid} head={head} t={t} idx={k} count={data.tests.length} style={style} i={3 + k} total={total} />)}
      <SchedulePage head={head} data={data} style={style} i={total} total={total} />
    </div>
  );
}
