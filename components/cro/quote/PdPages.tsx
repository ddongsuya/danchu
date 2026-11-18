/**
 * 효력시험 견적서 4쪽 (0047 4단계, 시안 v15 견적서): 표지 → 견적 내용 → 시험 상세 → 평가항목.
 * 효력 시험 하나짜리 견적서이고 단가표 방식(t.prices)일 때 DocPages 대신 쓴다 (pdDocTest).
 * 금액은 비용 묶음(관리비·이익을 나눠 더한 값)만 보인다. 단가·관리비 %는 나가지 않는다.
 * 형광펜은 표준과 달라진 곳(추가 마리·새 군·새 평가항목)에만.
 */
import { docTotals, testKind, type DocData, type DocHead, type DocTest, type QuoteStyle } from "@/lib/quote-doc";
import type { DayLane, PdDesign } from "@/lib/kind-design";
import { dayRange, evalSamples, pdBuckets, pdQuote, scaleTitle, wonKo, type PdQuote } from "@/lib/pd-quote";
import { Foot, Head, Logo, brandVars } from "./DocPages";

const n = (v: number) => v.toLocaleString("ko-KR");
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${n(Math.abs(v))}`;

/** 4쪽 효력 견적서를 쓸 시험. 효력 시험 하나이고 단가 사본이 있을 때만 */
export function pdDocTest(d: DocData): { t: DocTest; q: PdQuote } | null {
  if (d.tests.length !== 1) return null;
  const t = d.tests[0];
  if (testKind(t) !== "pd" || !t.kd?.pd) return null;
  const q = pdQuote(t);
  return q ? { t, q } : null;
}
export const PD_PAGES = 4;

type P = { head: DocHead; data: DocData; t: DocTest; q: PdQuote; style: QuoteStyle };

const metaRight = (head: DocHead) => <span className="qd__num">{head.docNo}</span>;

export function PdCover({ head, data, t, q, style }: P) {
  const pd = t.kd!.pd!;
  const std = t.std.kd?.pd;
  const stdById = new Map((std?.groups ?? []).map((g) => [g.id, g]));
  const animals = pd.groups.reduce((a, g) => a + g.n, 0);
  const species = (pd.brief?.animal || t.cond.species).split(",")[0].trim();
  const weeks = t.weeks;
  const total = docTotals(data);
  return (
    <section className="qd qd--cover qp" style={brandVars(style)}>
      <header className="qp__chead">
        <Logo style={style} />
        <dl className="qp__meta">
          <div><dt>견적번호</dt><dd className="qd__num">{head.docNo}</dd></div>
          <div><dt>작성일</dt><dd className="qd__num">{head.issuedOn}</dd></div>
          {head.validUntil && <div><dt>유효기간</dt><dd><span className="qd__num">{head.validUntil}</span>까지</dd></div>}
        </dl>
      </header>
      <div className="qp__cover">
        <p className="qp__kicker">효력시험 견적서</p>
        <h1 className="qp__title">{pd.model || t.title}<br />효력시험</h1>
        <p className="qp__sum">
          {species ? `${species} ` : ""}{animals}마리, {pd.groups.length}군.{weeks ? ` 착수부터 최종 보고서까지 ${weeks}주,` : ""}
          <br /><b className="qd__num">{n(total.supply)}원</b>(부가세 별도)입니다.
        </p>
        <div className="qp__dots" aria-label={`군 구성 ${pd.groups.length}군 ${animals}마리`}>
          <p className="qp__cap">군 구성 · {pd.groups.length}군 {animals}마리</p>
          {pd.groups.map((g, i) => {
            const s = stdById.get(g.id);
            const base = s ? s.n : 0;
            return (
              <div key={g.id} className="qp__drow">
                <span className="qd__num">G{i + 1}</span>
                <span className="qp__dd">{Array.from({ length: Math.min(g.n, 40) }, (_, k) => <i key={k} data-hl={k >= base ? "1" : undefined} />)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="qp__parties">
        <dl>
          <dt className="qp__ph">공급자</dt>
          <div><dt>기관명</dt><dd>{style.supplier.name || "기관명"}</dd></div>
          {style.supplier.person && <div><dt>담당</dt><dd>{style.supplier.person}</dd></div>}
          {(style.supplier.contact || style.supplier.email) && <div><dt>연락처</dt><dd>{[style.supplier.contact, style.supplier.email].filter(Boolean).join(" · ")}</dd></div>}
        </dl>
        <dl>
          <dt className="qp__ph">의뢰자</dt>
          {head.client && <div><dt>의뢰자</dt><dd>{head.client}</dd></div>}
          {head.rfqNo && <div><dt>요청번호</dt><dd className="qd__num">{head.rfqNo}</dd></div>}
          {head.substance && <div><dt>시험물질</dt><dd>{head.substance}</dd></div>}
        </dl>
      </div>
      {q.cur.missing > 0 && <p className="qp__warn">단가표에 없는 항목이 있어요</p>}
    </section>
  );
}

function Sec({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="qp__sec">
      <div className="qp__sl"><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      <div className="qp__sb">{children}</div>
    </section>
  );
}

export function PdQuotePage({ head, data, t, q, style, i }: P & { i: number }) {
  const total = docTotals(data);
  const rows = pdBuckets(q, t.kd!.pd!);
  const terms: [string, string][] = [];
  if (data.terms.pay) terms.push(["결제 조건", data.terms.pay]);
  if (t.weeks) terms.push(["소요 기간", `착수부터 최종 보고서까지 ${t.weeks}주`]);
  if (data.terms.extra) terms.push(["별도 비용", data.terms.extra]);
  if (t.asks?.length) terms.push(["확인할 것", t.asks.filter(Boolean).join(", ")]);
  if (data.terms.note) terms.push(["비고", data.terms.note]);
  return (
    <section className="qd qp" style={brandVars(style)}>
      <Head head={head} style={style} right={metaRight(head)} />
      <h1 className="qp__h1">견적 내용</h1>
      <Sec title="금액">
        <table className="qp__t">
          <thead><tr><th>구분</th><th>포함 내용</th><th className="r">금액</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.key}><th scope="row">{r.label}</th><td className="qp__mut">{r.note}</td><td className="r qd__num">{n(r.amount)}</td></tr>)}
            {total.discount > 0 && <tr className="qp__sub"><td colSpan={2}>할인</td><td className="r qd__num">- {n(total.discount)}</td></tr>}
            <tr className="qp__sub"><td colSpan={2}>공급가액</td><td className="r qd__num">{n(total.supply)}</td></tr>
            <tr className="qp__sub"><td colSpan={2}>부가세 10%</td><td className="r qd__num">{n(total.vat)}</td></tr>
          </tbody>
        </table>
        <div className="qp__grand">
          <b>합계</b>
          <span><span className="qp__gn"><span className="qp__big qd__num">{n(total.grand)}</span>원</span><small>{wonKo(total.grand)} 원</small></span>
        </div>
      </Sec>
      {q.changes.length > 0 && (
        <Sec title={"기관 표준에서\n달라진 곳"} sub={`표준가 ${n(q.std.total)}`}>
          <table className="qp__t">
            <thead><tr><th>항목</th><th>기관 표준</th><th>이번 견적</th><th className="r">금액</th></tr></thead>
            <tbody>
              {q.changes.map((c) => (
                <tr key={c.item}>
                  <th scope="row">{c.item}</th>
                  <td>{c.before}</td>
                  <td><mark className="qp__hl">{c.after}</mark></td>
                  {c.span > 0 && <td className="r qd__num qp__mid" rowSpan={c.span}>{c.amount != null ? signed(c.amount) : ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {t.why && <p className="qp__p qp__mut">{t.why}</p>}
        </Sec>
      )}
      {terms.length > 0 && (
        <Sec title="거래 조건">
          <dl className="qp__kv">{terms.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </Sec>
      )}
      <Foot label="견적 내용" i={i} total={PD_PAGES} />
    </section>
  );
}

/** 인쇄용 스키마: 날짜 칸 격자. 기간은 칸 채움, 매일은 점, 한 시점은 칸 하나 */
function DaySchema({ days }: { days: DayLane[] }) {
  const r = dayRange({ days } as PdDesign);
  if (!r) return null;
  const cols = Array.from({ length: r.days }, (_, k) => r.from + k);
  const ticks = new Set([r.from, ...(r.from <= 0 && r.to >= 0 ? [0] : []), ...cols.filter((d) => d > 0 && d % 3 === 0 && d < r.to - 1), r.to]);
  let bar = 0;
  return (
    <div className="qp__sch" style={{ ["--days" as string]: r.days }}>
      {days.map((l) => {
        const tone = l.mark === "bar" ? Math.min(2, bar++) : 0;
        return (
          <div key={l.id} className="qp__srow">
            <span>{l.name}</span>
            <span className="qp__scells">
              {cols.map((d) => {
                const on = d >= l.from && d <= l.to;
                return <i key={d} data-k={on ? l.mark : undefined} data-tone={on && l.mark === "bar" ? tone : undefined} />;
              })}
            </span>
          </div>
        );
      })}
      <div className="qp__srow qp__saxis" aria-hidden="true">
        <span />
        <span className="qp__scells">{cols.map((d) => <i key={d}>{ticks.has(d) ? `D${d}` : ""}</i>)}</span>
      </div>
    </div>
  );
}

export function PdDetailPage({ head, t, style, i }: P & { i: number }) {
  const pd = t.kd!.pd!;
  const std = t.std.kd?.pd;
  const stdById = new Map((std?.groups ?? []).map((g) => [g.id, g]));
  const animals = pd.groups.reduce((a, g) => a + g.n, 0);
  const r = dayRange(pd);
  const kv: [string, string][] = [];
  if (pd.brief?.animal || t.cond.species) kv.push(["동물", `${pd.brief?.animal || t.cond.species}, ${animals}마리`]);
  if (pd.induction) kv.push(["유발", pd.induction]);
  if (pd.brief?.dosing) kv.push(["투여", pd.brief.dosing]);
  if (t.cond.glp) kv.push(["시험 기준", t.cond.glp]);
  const paras = t.description.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  return (
    <section className="qd qp" style={brandVars(style)}>
      <Head head={head} style={style} right={metaRight(head)} />
      <h1 className="qp__h1">시험 상세</h1>
      <Sec title="시험 개요">
        <dl className="qp__kv">{kv.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {paras.map((p, k) => <p key={k} className="qp__p">{p}</p>)}
      </Sec>
      {r && <Sec title="시험 스키마" sub={`D${r.from}~D${r.to} · ${r.days}일`}><DaySchema days={pd.days!} /></Sec>}
      <Sec title="군 구성" sub={`${pd.groups.length}군 · ${animals}마리`}>
        <table className="qp__t">
          <thead><tr><th>군</th><th>이름</th><th>유발</th><th>처치</th><th>용량</th><th className="r">마리</th></tr></thead>
          <tbody>
            {pd.groups.map((g, k) => {
              const s = stdById.get(g.id);
              return (
                <tr key={g.id} data-hl={s ? undefined : "1"}>
                  <td className="qd__num">G{k + 1}</td>
                  <td>{g.label}</td>
                  <td>{g.induce || (g.role === "normal" ? "없음" : "")}</td>
                  <td>{g.treat}</td>
                  <td className="qd__num">{g.dose || "-"}</td>
                  <td className="r qd__num">{s && s.n !== g.n ? <mark className="qp__hl">{g.n}</mark> : g.n}</td>
                </tr>
              );
            })}
            <tr className="qp__tot"><th scope="row" colSpan={5}>합계</th><td className="r qd__num">{animals}</td></tr>
          </tbody>
        </table>
      </Sec>
      <Foot label="시험 상세" i={i} total={PD_PAGES} />
    </section>
  );
}

export function PdEvalPage({ head, t, style, i }: P & { i: number }) {
  const pd = t.kd!.pd!;
  const stdEvals = new Set((t.std.kd?.pd?.evals ?? []).filter((e) => !e.optional).map((e) => e.item.trim()));
  const evals = (pd.evals ?? []).filter((e) => !e.optional);
  const target = [...new Set(evals.map((e) => e.target).filter(Boolean))];
  const items = t.prices?.items ?? [];
  const hasN = evals.some((e) => evalSamples(pd, e, items) != null);
  const scales = evals.filter((e) => e.scale && e.scale.rows.length);
  const report = (pd.report ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <section className="qd qp" style={brandVars(style)}>
      <Head head={head} style={style} right={metaRight(head)} />
      <h1 className="qp__h1">평가항목</h1>
      <Sec title="측정 일정과 방법" sub={target.length === 1 ? `${target[0]} 대상` : undefined}>
        {evals.length ? (
          <table className="qp__t">
            <thead><tr><th className="qp__ev">항목</th><th className="qp__nw">시점</th><th className="qp__nw">횟수</th><th>방법</th>{target.length > 1 && <th>대상</th>}{hasN && <th className="r qp__nw">검체</th>}</tr></thead>
            <tbody>
              {evals.map((e) => (
                <tr key={e.id}>
                  <th scope="row">{stdEvals.has(e.item.trim()) ? e.item : <mark className="qp__hl">{e.item}</mark>}</th>
                  <td className="qd__num qp__nw">{e.when}</td>
                  <td className="qp__nw">{e.freq}</td>
                  <td>{e.method}</td>
                  {target.length > 1 && <td>{e.target}</td>}
                  {hasN && <td className="r qd__num qp__nw">{(() => { const n = evalSamples(pd, e, items); return n != null ? n.toLocaleString("ko-KR") : "-"; })()}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="qp__p qp__mut">평가항목 없음</p>}
      </Sec>
      {scales.map((e) => (
        <Sec key={e.id} title={scaleTitle(e.item)}>
          <table className="qp__t qp__sc">
            <thead><tr>{e.scale!.cols.map((c, j) => <th key={j} className={j === 0 ? "qp__nw" : undefined}>{c}</th>)}</tr></thead>
            <tbody>
              {e.scale!.rows.map((r, k) => (
                <tr key={k}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row" className="qd__num">{c || "-"}</th> : <td key={j}>{c || "-"}</td>))}</tr>
              ))}
            </tbody>
          </table>
        </Sec>
      ))}
      {report.length > 0 && (
        <Sec title="결과 보고">
          {report.map((l, k) => <p key={k} className="qp__p">{l}</p>)}
        </Sec>
      )}
      <Foot label="평가항목" i={i} total={PD_PAGES} />
    </section>
  );
}

/** 4쪽 전체 */
export function PdPages(p: P) {
  return (
    <>
      <PdCover {...p} />
      <PdQuotePage {...p} i={2} />
      <PdDetailPage {...p} i={3} />
      <PdEvalPage {...p} i={4} />
    </>
  );
}
