/**
 * 견적서의 A4 페이지 (1부 표지 · 2부 견적서 · 3부 시험 상세 설명 · 4부 시험 수행 일정표 · 5부 시험 안내).
 * PDF 저장(인쇄)·편집 화면의 미리보기·양식 미리보기가 같은 페이지를 쓴다. 상태가 없는 표시 전용 컴포넌트.
 * 문서는 화면 테마와 상관없이 종이색으로 고정한다 (quote.css .qd).
 *
 * 판(style.layout, 2026-11-13): 표지·견적서 머리·합계 자리·쪽 머리와 꼬리만 판마다 다르다.
 * 견적 내역 표(kindRows)·시험 상세(독성 군 구성, 효력·약동학·개별 분석 KindDetail)·일정표·시험 안내의 내용은
 * 모든 판이 같은 컴포넌트를 쓰므로, 네 갈래가 어느 판에서나 빠짐없이 나온다.
 */
import { docStyle, docTotals, inkOn, kindRows, kindSummary, mainAnimals, recoveryAnimals, scheduleWeeks, testKind, testLines, wonKorean, type DocData, type DocHead, type DocTest, type QuoteLayout, type QuoteStyle } from "@/lib/quote-doc";
import { PD_ROLE, pkSamples } from "@/lib/kind-design";
import { docGuides, GUIDES_PER_PAGE, type TestGuide } from "@/lib/test-guide";

const n = (v: number) => v.toLocaleString("ko-KR");

export type PageKey = "cover" | "quote" | `detail:${string}` | "schedule" | `guide:${number}`;

/** 5부 시험 안내를 쪽 단위로 나눈다. 끄거나 안내할 시험이 없으면 빈 배열 */
export function guidePages(d: DocData): { g: TestGuide; nos: number[] }[][] {
  if (d.visible.guide === false) return [];
  const all = docGuides(d);
  const out: { g: TestGuide; nos: number[] }[][] = [];
  for (let k = 0; k < all.length; k += GUIDES_PER_PAGE) out.push(all.slice(k, k + GUIDES_PER_PAGE));
  return out;
}
/** 전체 쪽 수 */
export const pageCount = (d: DocData) => 3 + d.tests.length + guidePages(d).length;
export const pageKeys = (d: DocData): PageKey[] => ["cover", "quote", ...d.tests.map((t) => `detail:${t.uid}` as PageKey), "schedule", ...guidePages(d).map((_, k) => `guide:${k}` as PageKey)];

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

const lay = (s: QuoteStyle): QuoteLayout => s.layout ?? "basic";
const dot = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).join(" · ");

/** 판마다 쪽 꼬리 왼쪽에 반복하는 줄 (비어 있으면 부 이름) */
function footLine(L: QuoteLayout, head: DocHead, style: QuoteStyle, data: DocData | undefined, part: string): string {
  const s = style.supplier;
  if (L === "summary") return dot(s.name, s.email) || part;
  if (L === "sentence") return dot(head.docNo, data ? `${n(docTotals(data).grand)}원` : "", head.validUntil ? `${head.validUntil}까지 유효` : "");
  if (L === "steps") return dot(s.person, s.contact) || part;
  if (L === "side" || L === "sign") return s.email || part;
  return part;
}

/** 공급자 칸: 기관명 · 등록번호·대표 · 주소 · 담당·연락처 · 이메일 */
function SupplierLines({ style, name = true }: { style: QuoteStyle; name?: boolean }) {
  const s = style.supplier;
  return (
    <>
      {name && <b>{s.name || "기관명"}</b>}
      {(s.reg || s.ceo) && <span>{s.reg && <>등록번호 <span className="qd__num">{s.reg}</span></>}{s.reg && s.ceo ? " · " : ""}{s.ceo && `대표 ${s.ceo}`}</span>}
      {s.address && <span>{s.address}</span>}
      {dot(s.person, s.contact) && <span>{dot(s.person, s.contact)}</span>}
      {s.email && <span>{s.email}</span>}
    </>
  );
}

/** 옆 띠 판의 왼쪽 띠: 공급자·의뢰자·번호·날짜 (+ 쪽마다 다른 줄) */
function Band({ head, style, extra, tail }: { head: DocHead; style: QuoteStyle; extra?: [string, React.ReactNode][]; tail?: React.ReactNode }) {
  return (
    <aside className="qd__band">
      <div className="qd__bandlogo"><Logo style={style} /></div>
      <div><span className="qd__cap">공급자</span><SupplierLines style={style} name={!!style.logo} /></div>
      {head.client && <div><span className="qd__cap">의뢰자</span><b>{head.client}</b>{head.substance && <span>시험물질 {head.substance}</span>}</div>}
      <div><span className="qd__cap">견적번호</span><span className="qd__num">{head.docNo}</span></div>
      <div><span className="qd__cap">작성일</span><span className="qd__num">{head.issuedOn}</span></div>
      {head.validUntil && <div><span className="qd__cap">유효기간</span><span className="qd__num">{head.validUntil}</span></div>}
      {extra?.map(([k, v]) => <div key={k}><span className="qd__cap">{k}</span><span>{v}</span></div>)}
      {tail && <div className="qd__bandtail">{tail}</div>}
    </aside>
  );
}

/**
 * 쪽 틀: 판마다 머리(로고·견적번호·부 이름)·위 띠·왼쪽 띠·꼬리가 다르다. 본문(children)은 판과 상관없이 같다.
 * own: 견적서·표지처럼 머리를 본문이 직접 그리는 쪽
 */
function Frame({ head, style, data, part, i, total, cls = "", own = false, band, children }: {
  head: DocHead; style: QuoteStyle; data?: DocData; part: string; i: number; total: number; cls?: string; own?: boolean;
  band?: { extra?: [string, React.ReactNode][]; tail?: React.ReactNode }; children: React.ReactNode;
}) {
  const L = lay(style);
  const foot = <Foot label={footLine(L, head, style, data, part)} i={i} total={total} />;
  const meta = L === "basic"
    ? <><div>견적번호 <span className="qd__num">{head.docNo}</span></div><div>{part.startsWith("2부") || part.startsWith("3부") ? <>작성일 <span className="qd__num">{head.issuedOn}</span></> : part}</div></>
    : <><div>{part}</div><div>견적번호 <span className="qd__num">{head.docNo}</span></div></>;
  if (L === "side") {
    return (
      <section className={`qd qd--band ${cls}`} data-layout={L} style={brandVars(style)}>
        <Band head={head} style={style} extra={band?.extra} tail={band?.tail} />
        <div className="qd__main">
          {!own && <p className="qd__part">{part}</p>}
          {children}
          {foot}
        </div>
      </section>
    );
  }
  return (
    <section className={`qd ${cls}`} data-layout={L} style={brandVars(style)}>
      {(L === "sentence" || L === "sign") && <i className="qd__topbar" aria-hidden="true" />}
      {!own && (L === "sign"
        ? <header className="qd__signhead"><span className="qd__chip">{part}</span><b className="qd__num">{head.docNo}</b></header>
        : <Head head={head} style={style} right={meta} />)}
      {children}
      {foot}
    </section>
  );
}

/** 시험 조건 한 줄 요약: "랫드 · 경구 · GLP" */
export function condLine(t: DocTest): string {
  return [t.cond.species, t.cond.route, t.cond.glp].filter(Boolean).join(" · ");
}
/** 군 구성 요약: "4군, 126마리" */
export function groupLine(t: DocTest): string {
  const ks = kindSummary(t);
  if (ks) return ks;
  if (!t.groups.length) return "";
  return `${t.groups.length}군, ${mainAnimals(t.groups) + recoveryAnimals(t.groups)}마리`;
}

function BasicCover({ head, data, style, i, total }: { head: DocHead; data: DocData; style: QuoteStyle; i: number; total: number }) {
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

/** 목차: 부·이름·쪽 */
function tocRows(d: DocData): [string, string, string][] {
  const nt = d.tests.length;
  const ng = guidePages(d).length;
  const span = (a: number, b: number) => (a === b ? String(a) : `${a}~${b}`);
  const out: [string, string, string][] = [["2부", "견적서", "2"]];
  if (nt) out.push(["3부", "시험 상세 설명", span(3, 2 + nt)]);
  out.push(["4부", "시험 수행 일정표", String(3 + nt)]);
  if (ng) out.push(["5부", "시험 안내", span(4 + nt, 3 + nt + ng)]);
  return out;
}
function Toc({ data, head = true }: { data: DocData; head?: boolean }) {
  return (
    <table className="qd__toc">
      {head && <thead><tr><th colSpan={2}>목차</th><th className="r">쪽</th></tr></thead>}
      <tbody>{tocRows(data).map(([a, b, c]) => <tr key={a}><td className="qd__no">{a}</td><td>{b}</td><td className="r qd__num">{c}</td></tr>)}</tbody>
    </table>
  );
}
/** 표지의 시험 목록: 시험·조건 / 기간 / 금액 (금액은 시험별 금액을 보일 때만) */
function CoverTests({ data }: { data: DocData }) {
  if (!data.tests.length) return null;
  const amt = data.visible.perTest;
  return (
    <table className="qd__ctests">
      <thead><tr><th>시험</th><th className="r">기간</th>{amt && <th className="r">금액 (원)</th>}</tr></thead>
      <tbody>{data.tests.map((t) => (
        <tr key={t.uid}><td><b>{t.title}</b>{condLine(t) && <small>{condLine(t)}</small>}</td><td className="r">{t.weeks ? `${t.weeks}주` : ""}</td>{amt && <td className="r qd__num">{n(testLines(t).total)}</td>}</tr>
      ))}</tbody>
    </table>
  );
}
/** "시험물질 A · 시험 4건 · 30주" */
function jobLine(head: DocHead, data: DocData): string {
  const w = scheduleWeeks(data);
  return dot(head.substance, data.tests.length ? `시험 ${data.tests.length}건` : "", w ? `${w}주` : "");
}
function Krw({ v }: { v: number }) {
  return <p className="qd__krw">{wonKorean(v)} (부가세 포함)</p>;
}
function Brand({ style }: { style: QuoteStyle }) {
  return <div className="qd__brand"><Logo style={style} />{style.logo && style.supplier.name && <span>{style.supplier.name}</span>}</div>;
}

export function Cover(p: { head: DocHead; data: DocData; style: QuoteStyle; i: number; total: number }) {
  const L = lay(p.style);
  if (L === "basic") return <BasicCover {...p} />;
  const { head, data, style, i, total } = p;
  const t = docTotals(data);
  const w = scheduleWeeks(data);
  const fr = { head, style, data, part: "1부 표지", i, total, own: true, cls: "qd--cover" };
  const client = head.client || "의뢰자";

  if (L === "summary") return (
    <Frame {...fr}>
      <div className="qd__xtop"><div><h1 className="qd__title">견적서</h1><p className="qd__sub">{head.title}</p></div><Brand style={style} /></div>
      <div className="qd__parties qd__parties--lr">
        <div><span className="qd__cap">의뢰자</span><b>{client} 귀중</b>{head.substance && <span>시험물질 {head.substance}</span>}</div>
        <div><span className="qd__cap">공급자</span><SupplierLines style={style} /></div>
      </div>
      <div className="qd__facts qd__facts--big">
        <div className="qd__wide"><span>견적 총액 (부가세 포함)</span><b className="qd__num">{n(t.grand)}원</b></div>
        {head.validUntil && <div><span>유효기간</span><b className="qd__num">{head.validUntil}</b></div>}
        <div><span>작성일</span><i className="qd__num">{head.issuedOn}</i></div>
        <div><span>견적번호</span><i className="qd__num">{head.docNo}</i></div>
        {w > 0 && <div><span>수행 기간</span><i>{w}주</i></div>}
      </div>
      <Krw v={t.grand} />
      <CoverTests data={data} />
      <div className="qd__push" />
      <Toc data={data} />
    </Frame>
  );

  if (L === "sentence") return (
    <Frame {...fr}>
      <div className="qd__xtop">
        <div><h1 className="qd__h1">견적서</h1><dl className="qd__stack"><div><dt>견적번호</dt><dd className="qd__num">{head.docNo}</dd></div><div><dt>작성일</dt><dd className="qd__num">{head.issuedOn}</dd></div>{head.validUntil && <div><dt>유효기간</dt><dd className="qd__num">{head.validUntil}</dd></div>}</dl></div>
        <Brand style={style} />
      </div>
      <p className="qd__sentence">{head.client && <>{head.client}에<br /></>}{data.tests.length > 0 && <>시험 {data.tests.length}건{w ? `, ${w}주` : ""},<br /></>}<span className="qd__num">{n(t.grand)}</span>원.</p>
      <p className="qd__krw">{dot(head.validUntil ? `${head.validUntil}까지 유효` : "", "부가세 포함", wonKorean(t.grand))}</p>
      <div className="qd__parties">
        <div><span className="qd__cap">공급자</span><SupplierLines style={style} /></div>
        <div><span className="qd__cap">의뢰자</span><b>{client}</b>{head.substance && <span>시험물질 {head.substance}</span>}</div>
      </div>
      <div className="qd__push" />
      <Toc data={data} />
    </Frame>
  );

  if (L === "steps") return (
    <Frame {...fr}>
      <div className="qd__mtop">
        <div><h1 className="qd__title">견적서</h1><p className="qd__lead">{style.supplier.name || "기관명"}</p></div>
        <dl className="qd__inline"><div><dt>견적번호</dt><dd className="qd__num">{head.docNo}</dd></div><div><dt>작성일</dt><dd className="qd__num">{head.issuedOn}</dd></div>{head.validUntil && <div><dt>유효기간</dt><dd className="qd__num">{head.validUntil}</dd></div>}</dl>
      </div>
      <div className="qd__parties qd__parties--wide">
        <div><span className="qd__cap">의뢰자</span><b>{client}</b>{head.substance && <span>시험물질 {head.substance}</span>}</div>
        <div><span className="qd__cap">공급자</span><SupplierLines style={style} /></div>
      </div>
      <p className="qd__due qd__due--big"><span className="qd__num">{n(t.grand)}</span>원{head.validUntil ? <> · <span className="qd__num">{head.validUntil}</span>까지 유효</> : ""}</p>
      <Krw v={t.grand} />
      <CoverTests data={data} />
      <Toc data={data} />
      <div className="qd__push" />
      <Steps style={style} data={data} />
    </Frame>
  );

  if (L === "side") return (
    <Frame {...fr} band={{ tail: <><span className="qd__cap">목차</span>{tocRows(data).map(([a, b, c]) => <span key={a}>{a} {b} <span className="qd__num">{c}</span></span>)}</> }}>
      <div className="qd__sidehero">
        <span className="qd__cap">{client} 귀중</span>
        <h1 className="qd__title">견적서</h1>
        <p className="qd__sub">{head.title}</p>
      </div>
      <CoverTests data={data} />
      <div className="qd__push" />
      <Totals data={data} />
      <p className="qd__krw r">{wonKorean(t.grand)}</p>
    </Frame>
  );

  // sign
  return (
    <Frame {...fr}>
      <header className="qd__signhead"><span className="qd__chip">견적서</span><b className="qd__num">{head.docNo}</b></header>
      <div className="qd__hd">
        <div className="qd__hdl">
          <span className="qd__cap">의뢰자</span>
          <h1 className="qd__title">{client} 귀중</h1>
          <p className="qd__job">{jobLine(head, data) || head.title}</p>
          <div className="qd__parties"><div><span className="qd__cap">공급자</span><SupplierLines style={style} /></div></div>
        </div>
        <InfoPanel title="견적 정보" rows={[["작성일", <span key="d" className="qd__num">{head.issuedOn}</span>], ["유효기간", head.validUntil ? <span key="v" className="qd__num">{head.validUntil}</span> : ""], ["견적 총액", <b key="t" className="qd__num">{n(t.grand)}</b>], ["담당", style.supplier.person], ["연락처", style.supplier.contact]]} />
      </div>
      <CoverTests data={data} />
      <h3 className="qd__h3">목차</h3>
      <Toc data={data} head={false} />
      <div className="qd__push" />
      <div className="qd__sigs qd__sigs--3"><span>공급자 확인 ({style.supplier.name || "기관명"})</span><span>의뢰자 확인 ({client})</span><span>날짜</span></div>
    </Frame>
  );
}

function InfoPanel({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== "" && v != null);
  return (
    <dl className="qd__panel">
      <dt className="qd__paneltitle">{title}</dt>
      {shown.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

/** 진행 안내 판: 회신 → 계약·결제 → 착수 */
function Steps({ style, data }: { style: QuoteStyle; data: DocData }) {
  const s = style.supplier;
  return (
    <div className="qd__steps">
      <b className="qd__stepsh">진행 방법</b>
      <ol>
        <li><b>1 회신</b><span>{s.email ? `수락 의사를 ${s.email}로` : s.contact ? `수락 의사를 ${s.contact}로` : "수락 의사 회신"}</span></li>
        <li><b>2 계약·결제</b><span>{data.terms.pay || "위탁연구계약 체결"}</span></li>
        <li><b>3 착수</b><span>시험물질 입고 주를 1주차로 착수</span></li>
      </ol>
    </div>
  );
}

/** 거래 조건 줄 (모든 판 같은 내용) */
function termRows(head: DocHead, data: DocData): [string, React.ReactNode][] {
  const weeks = scheduleWeeks(data);
  const days = head.validUntil ? Math.round((Date.parse(head.validUntil) - Date.parse(head.issuedOn)) / 864e5) : 0;
  const terms: [string, React.ReactNode][] = [];
  if (head.validUntil) terms.push(["견적 유효기간", <><span className="qd__num">{head.validUntil}</span>까지{days > 0 ? ` (작성일부터 ${days}일)` : ""}</>]);
  if (weeks) terms.push(["수행 기간", `착수부터 최종 보고서까지 ${weeks}주 (4부 일정표)`]);
  if (data.terms.pay) terms.push(["결제 조건", data.terms.pay]);
  if (data.terms.extra) terms.push(["별도 비용", data.terms.extra]);
  if (data.terms.note) terms.push(["비고", data.terms.note]);
  return terms;
}

/** 견적 내역 표: 독성(표준가+조정)·효력·약동학·개별 분석(kindRows) 모두 같은 표 */
function Items({ data }: { data: DocData }) {
  const v = data.visible;
  return (
    <table className="qd__items">
      <thead><tr><th className="qd__no">No</th><th>시험</th><th>조건</th><th className="r">기간</th>{v.perTest && <th className="r">금액</th>}</tr></thead>
      {data.tests.map((x, idx) => {
        const c = testLines(x);
        const rows = kindRows(x);
        const showAdj = v.perTest && v.adjust && (rows ? rows.length > 0 : c.lines.length > 0);
        return (
          <tbody key={x.uid}>
            <tr className="qd__test">
              <td className="qd__no">{idx + 1}</td>
              <td><b>{x.title}</b>{x.subtitle && <small>{x.subtitle}</small>}</td>
              <td>{condLine(x)}{groupLine(x) && <small>{groupLine(x)}</small>}</td>
              <td className="r">{x.weeks ? `${x.weeks}주` : ""}</td>
              {v.perTest && <td className="r qd__num qd__amt">{n(c.total)}</td>}
            </tr>
            {showAdj && rows && rows.map((r, k) => (
              <tr className="qd__adj" key={k}><td /><td colSpan={3}>{r.label}{r.note && (v.formula || testKind(x) !== "pd") ? <span className="qd__formula"> {r.note}</span> : null}</td><td className="r qd__num">{r.amount < 0 ? `- ${n(-r.amount)}` : n(r.amount)}</td></tr>
            ))}
            {showAdj && !rows && (
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
  );
}

/** 합계: 기본 판은 "합계금액", 다른 판은 "견적 총액" */
function Totals({ data, basic = false }: { data: DocData; basic?: boolean }) {
  const t = docTotals(data);
  return (
    <dl className="qd__totals">
      {t.discount > 0 && <><div><dt>시험 금액 합계</dt><dd className="qd__num">{n(t.sum)}</dd></div><div><dt>할인</dt><dd className="qd__num">- {n(t.discount)}</dd></div></>}
      <div><dt>공급가액</dt><dd className="qd__num">{n(t.supply)}</dd></div>
      <div><dt>{basic ? "부가세 (10%)" : "부가가치세 10%"}</dt><dd className="qd__num">{n(t.vat)}</dd></div>
      <div className="qd__grand"><dt>{basic ? "합계금액" : "견적 총액"}</dt><dd className="qd__num">{n(t.grand)}</dd></div>
    </dl>
  );
}

function TermList({ rows }: { rows: [string, React.ReactNode][] }) {
  return <dl className="qd__terms">{rows.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}</dl>;
}

export function QuotePage({ head, data, style, i, total }: { head: DocHead; data: DocData; style: QuoteStyle; i: number; total: number }) {
  const L = lay(style);
  const t = docTotals(data);
  const terms = termRows(head, data);
  const w = scheduleWeeks(data);
  const fr = { head, style, data, part: "2부 견적서", i, total };
  const client = head.client || "의뢰자";

  if (L === "basic") return (
    <Frame {...fr}>
      <h1 className="qd__h1">견적서</h1>
      <p className="qd__lead">아래와 같이 견적합니다. 금액 단위 원, 부가세 별도.</p>
      <h2 className="qd__h2">견적 내역</h2>
      <Items data={data} />
      <Totals data={data} basic />
      {terms.length > 0 && <><h2 className="qd__h2">거래 조건</h2><TermList rows={terms} /></>}
      <div className="qd__sign"><span>담당자</span><span>기관 직인</span></div>
    </Frame>
  );

  if (L === "summary") return (
    <Frame {...fr} own>
      <div className="qd__xtop"><h1 className="qd__h1">견적서</h1><Brand style={style} /></div>
      <div className="qd__parties qd__parties--lr">
        <div><span className="qd__cap">의뢰자</span><b>{client}</b>{head.substance && <span>시험물질 {head.substance}</span>}</div>
        <div><span className="qd__cap">공급자</span><SupplierLines style={style} name={false} /></div>
      </div>
      <div className="qd__facts">
        <div className="qd__wide"><span>견적 총액 (부가세 포함)</span><b className="qd__num">{n(t.grand)}원</b></div>
        {head.validUntil && <div><span>유효기간</span><b className="qd__num">{head.validUntil}</b></div>}
        <div><span>작성일</span><i className="qd__num">{head.issuedOn}</i></div>
        <div><span>견적번호</span><i className="qd__num">{head.docNo}</i></div>
        {w > 0 && <div><span>수행 기간</span><i>{w}주</i></div>}
      </div>
      <Krw v={t.grand} />
      <Items data={data} />
      <div className="qd__low">
        <div>{terms.length > 0 && <TermList rows={terms.filter(([k]) => k !== "견적 유효기간")} />}</div>
        <Totals data={data} />
      </div>
    </Frame>
  );

  if (L === "sentence") return (
    <Frame {...fr} own>
      <div className="qd__xtop">
        <div><h1 className="qd__h1">견적서</h1><dl className="qd__stack"><div><dt>견적번호</dt><dd className="qd__num">{head.docNo}</dd></div><div><dt>작성일</dt><dd className="qd__num">{head.issuedOn}</dd></div>{head.validUntil && <div><dt>유효기간</dt><dd className="qd__num">{head.validUntil}</dd></div>}{head.substance && <div><dt>시험물질</dt><dd>{head.substance}</dd></div>}</dl></div>
        <Brand style={style} />
      </div>
      <div className="qd__parties">
        <div><span className="qd__cap">공급자</span><SupplierLines style={style} /></div>
        <div><span className="qd__cap">의뢰자</span><b>{client}</b></div>
      </div>
      <p className="qd__due"><span className="qd__num">{n(t.grand)}</span>원{head.validUntil ? <> · <span className="qd__num">{head.validUntil}</span>까지 유효</> : ""}</p>
      <Krw v={t.grand} />
      <Items data={data} />
      <Totals data={data} />
      {terms.length > 0 && <TermList rows={terms.filter(([k]) => k !== "견적 유효기간")} />}
    </Frame>
  );

  if (L === "steps") return (
    <Frame {...fr} own>
      <div className="qd__mtop">
        <div><h1 className="qd__h1">견적서</h1><p className="qd__lead">{style.supplier.name || "기관명"}</p></div>
        <dl className="qd__inline"><div><dt>견적번호</dt><dd className="qd__num">{head.docNo}</dd></div><div><dt>작성일</dt><dd className="qd__num">{head.issuedOn}</dd></div>{head.validUntil && <div><dt>유효기간</dt><dd className="qd__num">{head.validUntil}</dd></div>}</dl>
      </div>
      <div className="qd__parties qd__parties--wide">
        <div><span className="qd__cap">의뢰자</span><b>{client}</b>{head.substance && <span>시험물질 {head.substance}</span>}</div>
        <div><span className="qd__cap">공급자</span><SupplierLines style={style} /></div>
      </div>
      <p className="qd__due"><span className="qd__num">{n(t.grand)}</span>원{head.validUntil ? <> · <span className="qd__num">{head.validUntil}</span>까지 유효</> : ""}</p>
      <Krw v={t.grand} />
      <Items data={data} />
      <Totals data={data} />
      {terms.filter(([k]) => k === "별도 비용" || k === "비고").length > 0 && <TermList rows={terms.filter(([k]) => k === "별도 비용" || k === "비고")} />}
      <div className="qd__push" />
      <Steps style={style} data={data} />
    </Frame>
  );

  if (L === "side") return (
    <Frame {...fr} own band={{ tail: terms.filter(([k]) => k !== "견적 유효기간" && k !== "수행 기간").map(([k, v]) => <span key={k}><span className="qd__cap">{k}</span>{v}</span>) }}>
      <h1 className="qd__h1">견적서</h1>
      <div className="qd__facts qd__facts--2">
        {w > 0 && <div><span>수행 기간</span><i>{w}주</i></div>}
        <div><span>견적 총액 (부가세 포함)</span><b className="qd__num">{n(t.grand)}원</b></div>
      </div>
      <Items data={data} />
      <Totals data={data} />
      <p className="qd__krw r">{wonKorean(t.grand)}</p>
    </Frame>
  );

  // sign
  return (
    <Frame {...fr} own>
      <header className="qd__signhead"><span className="qd__chip">견적서</span><b className="qd__num">{head.docNo}</b></header>
      <div className="qd__hd">
        <div className="qd__hdl">
          <h1 className="qd__h1">{client} 귀중</h1>
          <p className="qd__job">{jobLine(head, data) || head.title}</p>
          <div className="qd__parties"><div><span className="qd__cap">공급자</span><SupplierLines style={style} /></div></div>
        </div>
        <InfoPanel title="견적 정보" rows={[["작성일", <span key="d" className="qd__num">{head.issuedOn}</span>], ["유효기간", head.validUntil ? <span key="v" className="qd__num">{head.validUntil}</span> : ""], ["시험물질", head.substance], ["담당", style.supplier.person], ["연락처", style.supplier.contact]]} />
      </div>
      <Items data={data} />
      <Totals data={data} />
      <p className="qd__krw r">{wonKorean(t.grand)}</p>
      {terms.filter(([k]) => k !== "견적 유효기간").map(([k, v]) => <div key={k} className="qd__note"><h3 className="qd__h3">{k}</h3><p>{v}</p></div>)}
      <div className="qd__push" />
      <div className="qd__sigs"><span>의뢰자 확인 (서명)</span><span>날짜</span></div>
    </Frame>
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

/** 효력·약동학·개별 분석의 설계 (3부) */
function KindDetail({ t }: { t: DocTest }) {
  const k = testKind(t);
  const pd = k === "pd" ? t.kd?.pd : undefined;
  const pk = k === "pk" ? t.kd?.pk : undefined;
  const ot = k === "other" ? t.kd?.other : undefined;
  return (
    <>
      {pd && (
        <>
          {(pd.model || pd.induction) && <dl className="qd__cond">{pd.model && <div><dt>질환 모델</dt><dd>{pd.model}</dd></div>}{pd.induction && <div><dt>유발</dt><dd>{pd.induction}</dd></div>}</dl>}
          {pd.groups.length > 0 && (
            <>
              <h2 className="qd__h2">군 구성</h2>
              <table className="qd__groups">
                <thead><tr><th>군</th><th>처치</th><th>용량</th><th className="r">군당 수</th></tr></thead>
                <tbody>{pd.groups.map((g) => <tr key={g.id}><td>{g.label} <small>{PD_ROLE[g.role]}</small></td><td>{g.treat}</td><td>{g.dose}</td><td className="r qd__num">{g.n}</td></tr>)}</tbody>
                <tfoot><tr><td>합계</td><td /><td /><td className="r qd__num">{pd.groups.reduce((a, g) => a + g.n, 0)}</td></tr></tfoot>
              </table>
            </>
          )}
          {pd.endpoints.length > 0 && <><h2 className="qd__h2">평가 지표</h2><ul className="qd__evals">{pd.endpoints.map((e) => <li key={e}>{e}</li>)}</ul></>}
        </>
      )}
      {pk && (
        <>
          {pk.types.length > 0 && <dl className="qd__cond"><div><dt>시험 종류</dt><dd>{pk.types.join(", ")}</dd></div></dl>}
          {pk.groups.length > 0 && (
            <>
              <h2 className="qd__h2">용량군</h2>
              <table className="qd__groups">
                <thead><tr><th>군</th><th>투여경로</th><th>용량</th><th className="r">마리</th></tr></thead>
                <tbody>{pk.groups.map((g) => <tr key={g.id}><td>{g.label}</td><td>{g.route}</td><td>{g.dose}</td><td className="r qd__num">{g.n}</td></tr>)}</tbody>
              </table>
            </>
          )}
          <h2 className="qd__h2">채혈과 분석</h2>
          <dl className="qd__cond">
            {pk.times.length > 0 && <div><dt>채혈 시점</dt><dd>{pk.times.join(", ")} ({pk.times.length}시점)</dd></div>}
            {pk.matrix.length > 0 && <div><dt>검체</dt><dd>{pk.matrix.join(", ")}</dd></div>}
            {pkSamples(pk) > 0 && <div><dt>검체 수</dt><dd className="qd__num">{pkSamples(pk)}검체</dd></div>}
            {pk.method && <div><dt>분석법</dt><dd>{pk.method === "dev" ? "분석법 개발 포함" : "의뢰자 분석법 사용"}</dd></div>}
            {pk.params.length > 0 && <div><dt>파라미터</dt><dd>{pk.params.join(", ")}</dd></div>}
          </dl>
        </>
      )}
      {ot && (ot.sample || ot.n > 0) && (
        <dl className="qd__cond">{ot.sample && <div><dt>시료</dt><dd>{ot.sample}</dd></div>}{ot.n > 0 && <div><dt>검체 수</dt><dd className="qd__num">{ot.n}검체</dd></div>}</dl>
      )}
      {t.why && <><h2 className="qd__h2">요청과 다르게 설계한 이유</h2><p className="qd__desc">{t.why}</p></>}
      {t.asks && t.asks.length > 0 && <><h2 className="qd__h2">확인이 필요한 사항</h2><ol className="qd__evals">{t.asks.map((a) => <li key={a}>{a}</li>)}</ol></>}
    </>
  );
}

export const COND_LABEL: [keyof DocTest["cond"], string][] = [["species", "실험동물"], ["route", "투여경로"], ["dosing", "투여기간"], ["recovery", "회복기간"], ["glp", "시험 기준"], ["guideline", "참고 가이드라인"]];

/** 시험 한 건의 머리 숫자: 금액(시험별 금액을 보일 때만) · 구성(독성 군·마리, 효력 군·마리, 약동학 군·시점·검체, 개별 분석 검체) · 기간 · 시험 기준 */
function testFacts(t: DocTest, data?: DocData): [string, React.ReactNode][] {
  const out: [string, React.ReactNode][] = [];
  if (data?.visible.perTest) out.push(["시험 금액", <span key="a" className="qd__num">{n(testLines(t).total)}원</span>]);
  const g = groupLine(t);
  if (g) out.push(["구성", g]);
  if (t.weeks) out.push(["기간", `${t.weeks}주`]);
  if (t.cond.glp) out.push(["시험 기준", t.cond.glp]);
  return out;
}

export function DetailPage({ head, t, idx, count, style, i, total, data }: { head: DocHead; t: DocTest; idx: number; count: number; style: QuoteStyle; i: number; total: number; data?: DocData }) {
  const L = lay(style);
  const evals = t.evals.filter((e) => e.on);
  const facts = testFacts(t, data);
  const part = "3부 시험 상세 설명";
  return (
    <Frame head={head} style={style} data={data} part={part} i={i} total={total} band={L === "side" ? { extra: facts } : undefined}>
      <p className="qd__cap">시험 {idx + 1} / {count}</p>
      {L === "sign" ? (
        <div className="qd__hd">
          <div className="qd__hdl"><h1 className="qd__h1">{t.title}</h1>{t.subtitle && <p className="qd__job">{t.subtitle}</p>}</div>
          {facts.length > 0 && <InfoPanel title="시험 정보" rows={facts} />}
        </div>
      ) : (
        <>
          <h1 className="qd__h1">{t.title}</h1>
          {t.subtitle && <p className="qd__lead">{t.subtitle}</p>}
          {L !== "basic" && L !== "side" && facts.length > 0 && (
            L === "sentence"
              ? <dl className="qd__stack">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              : L === "steps"
                ? <dl className="qd__inline qd__inline--left">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                : <div className="qd__facts qd__facts--rule">{facts.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
          )}
        </>
      )}
      <h2 className="qd__h2">시험 조건</h2>
      <dl className="qd__cond">{COND_LABEL.filter(([k]) => t.cond[k] && !(k === "recovery" && !t.groups.length && t.cond[k] === "없음")).map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{t.cond[k]}</dd></div>)}</dl>
      {t.groups.length > 0 && <><h2 className="qd__h2">군 구성</h2><GroupTable t={t} /></>}
      <KindDetail t={t} />
      {evals.length > 0 && <><h2 className="qd__h2">평가항목</h2><ul className="qd__evals">{evals.map((e) => <li key={e.name}>{e.name}</li>)}</ul></>}
      {t.description && <><h2 className="qd__h2">시험 설명</h2><p className="qd__desc">{t.description}</p></>}
    </Frame>
  );
}

export function SchedulePage({ head, data, style, i, total }: { head: DocHead; data: DocData; style: QuoteStyle; i: number; total: number }) {
  const W = Math.max(1, scheduleWeeks(data));
  // 주 머리글: 30주까지는 매주, 그 뒤로는 간격을 둔다
  const step = W <= 30 ? 1 : W <= 60 ? 2 : W <= 120 ? 4 : 8;
  const ticks = Array.from({ length: W }, (_, k) => k + 1);
  const pct = (w: number) => `${(w / W) * 100}%`;
  return (
    <Frame head={head} style={style} data={data} part="4부 시험 수행 일정표" i={i} total={total} cls="qd--land">
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
    </Frame>
  );
}

/** 5부 시험 안내: 견적서에 든 시험이 어떤 시험인지 (공개 가이드라인의 일반 설명, lib/test-guide.ts) */
export function GuidePage({ head, items, part, parts, style, i, total, data }: { head: DocHead; items: { g: TestGuide; nos: number[] }[]; part: number; parts: number; style: QuoteStyle; i: number; total: number; data?: DocData }) {
  return (
    <Frame head={head} style={style} data={data} part={`5부 시험 안내${parts > 1 ? ` (${part + 1}/${parts})` : ""}`} i={i} total={total}>
      <h1 className="qd__h1">시험 안내</h1>
      <p className="qd__lead">견적에 포함된 시험의 일반적인 목적과 평가 내용입니다. 이 견적의 설계는 3부 시험 상세 설명을 따릅니다.</p>
      {items.map(({ g, nos }) => (
        <article className="qd__guide" key={g.key}>
          <h2 className="qd__h2">{g.name}<small>시험 {nos.join(", ")}</small></h2>
          <p className="qd__desc">{g.what}</p>
          <dl className="qd__gkv">
            <div><dt>용도</dt><dd>{g.why}</dd></div>
            <div><dt>주요 평가</dt><dd>{g.looks.join(", ")}</dd></div>
            <div><dt>관련 기준</dt><dd>{g.basis}</dd></div>
          </dl>
        </article>
      ))}
    </Frame>
  );
}

export function brandVars(style: QuoteStyle): React.CSSProperties {
  const c = style.brandColor && /^#[0-9a-f]{6}$/i.test(style.brandColor) ? style.brandColor : "#1b1b19";
  return { ["--qd-brand" as string]: c, ["--qd-on" as string]: inkOn(c) };
}

/** 5부 전체 (인쇄·PDF). 견적서에 판을 따로 골랐으면 그 판으로 */
export function DocPages({ head, data, style: orgStyle }: { head: DocHead; data: DocData; style: QuoteStyle }) {
  const style = docStyle(orgStyle, data);
  const guides = guidePages(data);
  const sched = 3 + data.tests.length;
  const total = sched + guides.length;
  return (
    <div className="qd-pages">
      <Cover head={head} data={data} style={style} i={1} total={total} />
      <QuotePage head={head} data={data} style={style} i={2} total={total} />
      {data.tests.map((t, k) => <DetailPage key={t.uid} head={head} t={t} idx={k} count={data.tests.length} style={style} i={3 + k} total={total} data={data} />)}
      <SchedulePage head={head} data={data} style={style} i={sched} total={total} />
      {guides.map((items, k) => <GuidePage key={k} head={head} items={items} part={k} parts={guides.length} style={style} i={sched + 1 + k} total={total} data={data} />)}
    </div>
  );
}
