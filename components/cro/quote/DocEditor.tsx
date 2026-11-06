"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash, X } from "@phosphor-icons/react";
import {
  blankTest, condChanges, docTitle, docTotals, mainAnimals, recoveryAnimals, scheduleWeeks, testFromCatalog, testLines, uid,
  type DocData, type DocGroup, type DocHead, type DocTest, type Phase, type PhaseKind, type QuoteStyle, type Rate,
} from "@/lib/quote-doc";
import type { CatalogRow } from "@/lib/catalog";
import { COND_LABEL, Cover, DetailPage, Logo, brandVars, QuotePage, SchedulePage, condLine, pageKeys, type PageKey } from "./DocPages";

const n = (v: number) => v.toLocaleString("ko-KR");
const signed = (v: number) => (v < 0 ? `- ${n(-v)}` : `+ ${n(v)}`);
const digits = (s: string) => s.replace(/[^\d]/g, "").slice(0, 12);
const PHASE_LABEL: Record<PhaseKind, string> = { run: "투여와 수행", recovery: "회복", report: "준비와 보고", point: "시점" };

type Props = {
  head: DocHead;
  initial: DocData;
  style: QuoteStyle;
  catalog: CatalogRow[];
  rates: Record<string, Rate[]>;
  /** 단추 요청에 회신하는 견적서면 회신 화면 주소 */
  replyHref: string | null;
  readOnly?: boolean;
};

type Mode = "edit" | "preview" | "client";
type Pane = "rail" | "desk" | "ledger";

/**
 * 견적서 편집 화면. 왼쪽 견적서 구성, 가운데 책상 위 A4 페이지를 직접 고치고, 오른쪽 금액 장부.
 * 금액은 표준가 + 달라진 곳의 추가 비용 (lib/quote-doc testLines). 800ms 뒤 자동 저장.
 * 960px 아래에서는 세 칸을 "구성 · 문서 · 금액" 전환으로 한 칸씩 보여 준다.
 */
export function DocEditor({ head: head0, initial, style, catalog, rates, replyHref, readOnly = false }: Props) {
  const router = useRouter();
  const [head, setHead] = useState<DocHead>(head0);
  const [data, setData] = useState<DocData>(initial);
  const [page, setPage] = useState<PageKey>(initial.tests[0] ? `detail:${initial.tests[0].uid}` : "cover");
  const [mode, setMode] = useState<Mode>("edit");
  const [pane, setPane] = useState<Pane>("desk");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "failed">("saved");
  const [picker, setPicker] = useState(false);
  const timer = useRef<number>(0);
  const abort = useRef<AbortController | null>(null);
  const rev = useRef(0);

  const totals = useMemo(() => docTotals(data), [data]);
  const keys = pageKeys(data);
  const test = page.startsWith("detail:") ? data.tests.find((t) => `detail:${t.uid}` === page) ?? null : null;

  const queue = (nextHead: DocHead, nextData: DocData) => {
    if (readOnly) return;
    const mine = ++rev.current;
    setSaved("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;
      const ok = await fetch(`/api/cro/docs/${nextHead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: nextHead.client, substance: nextHead.substance, issuedOn: nextHead.issuedOn, validUntil: nextHead.validUntil, memo: nextHead.memo, data: nextData }),
        signal: ac.signal,
      }).then((r) => r.ok).catch(() => (ac.signal.aborted ? null : false));
      if (ok === null || mine !== rev.current) return;
      setSaved(ok ? "saved" : "failed");
    }, 800);
  };
  useEffect(() => () => { window.clearTimeout(timer.current); abort.current?.abort(); }, []);
  useEffect(() => {
    if (saved !== "saving" && saved !== "failed") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);

  const setDoc = (patch: Partial<DocData>) => { const next = { ...data, ...patch }; setData(next); setHead((h) => ({ ...h, title: docTitle(next) })); queue({ ...head, title: docTitle(next) }, next); };
  const setH = (patch: Partial<DocHead>) => { const next = { ...head, ...patch }; setHead(next); queue(next, data); };
  const setTest = (u: string, patch: Partial<DocTest>) => setDoc({ tests: data.tests.map((t) => (t.uid === u ? { ...t, ...patch } : t)) });
  const addTest = (t: DocTest) => { setDoc({ tests: [...data.tests, t] }); setPage(`detail:${t.uid}`); setPicker(false); setPane("desk"); };
  const removeTest = (t: DocTest) => {
    if (!window.confirm(`"${t.title}" 시험을 견적서에서 뺄까요?`)) return;
    const rest = data.tests.filter((x) => x.uid !== t.uid);
    setDoc({ tests: rest });
    setPage(rest[0] ? `detail:${rest[0].uid}` : "cover");
  };
  const move = (t: DocTest, dir: -1 | 1) => {
    const i = data.tests.findIndex((x) => x.uid === t.uid);
    const j = i + dir;
    if (j < 0 || j >= data.tests.length) return;
    const next = [...data.tests];
    [next[i], next[j]] = [next[j], next[i]];
    setDoc({ tests: next });
  };

  const total = 3 + data.tests.length;
  const pageNo = keys.indexOf(page) + 1;
  const section = page === "cover" ? "1부 · 표지" : page === "quote" ? "2부 · 견적서" : page === "schedule" ? "4부 · 시험 수행 일정표" : `3부 · 시험 ${data.tests.findIndex((t) => t.uid === test?.uid) + 1} / ${data.tests.length}`;
  const savedLabel = readOnly ? "읽기 전용" : saved === "saving" ? "저장 중…" : saved === "failed" ? "저장 실패" : "자동 저장됨";

  return (
    <div className="qed" data-pane={pane}>
      <header className="qed__bar">
        <div className="qed__crumb">
          <Link href="/cro/docs" className="qed__back">견적서</Link>
          <span aria-hidden="true">/</span>
          <b className="qed__title">{head.title}</b>
          {head.rfqNo ? <span className="qed__tag">단추 요청 {head.rfqNo}에 회신</span> : <span className="qed__tag">단추 밖 견적</span>}
          <span className="qed__no tnum">{head.docNo}</span>
        </div>
        <div className="qed__actions">
          <span role="status" className="qed__saved" data-s={saved}>{savedLabel}</span>
          {saved === "failed" && <button type="button" className="b2 bsm" onClick={() => queue(head, data)}>다시 저장</button>}
          <a className="b2 bsm" href={`/api/cro/docs/${head.id}/xlsx`}>엑셀</a>
          <Link className="b2 bsm" href={`/cro/docs/${head.id}/print`}>PDF</Link>
          {replyHref && <Link className="b1 bsm" href={replyHref}>회신 보내기</Link>}
        </div>
      </header>

      <div className="qed__panes" role="tablist" aria-label="화면 나누기">
        {([["rail", "구성"], ["desk", "문서"], ["ledger", "금액"]] as [Pane, string][]).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={pane === k} onClick={() => setPane(k)}>{label}{k === "ledger" ? <span className="tnum"> {n(totals.grand)}</span> : null}</button>
        ))}
      </div>

      <div className="qed__grid">
        {/* 왼쪽: 견적서 구성 */}
        <aside className="qed__rail" aria-label="견적서 구성">
          <h2 className="qed__h">견적서 구성</h2>
          <nav className="qed__toc">
            <Toc on={page === "cover"} onClick={() => { setPage("cover"); setPane("desk"); }} title="표지" sub="의뢰자, 견적번호" thumb="cover" />
            <Toc on={page === "quote"} onClick={() => { setPage("quote"); setPane("desk"); }} title="견적서" sub={`시험 ${data.tests.length}건 · 합계`} thumb="quote" />
            <Toc on={!!test} onClick={() => { if (data.tests[0]) { setPage(`detail:${data.tests[0].uid}`); setPane("desk"); } }} title="시험 상세 설명" sub={data.tests.length ? "시험 설계 편집" : "시험을 추가하세요"} thumb="detail" />
            {data.tests.length > 0 && (
              <ol className="qed__tests">
                {data.tests.map((t) => {
                  const ch = testLines(t).changes;
                  return (
                    <li key={t.uid}>
                      <button type="button" aria-current={test?.uid === t.uid ? "true" : undefined} onClick={() => { setPage(`detail:${t.uid}`); setPane("desk"); }}>
                        <b>{t.title}</b>
                        <span>{ch ? `변경 ${ch}` : "변경 없음"}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <Toc on={page === "schedule"} onClick={() => { setPage("schedule"); setPane("desk"); }} title="시험 수행 일정표" sub={scheduleWeeks(data) ? `착수부터 최종 보고서까지 ${scheduleWeeks(data)}주` : "시험을 추가하세요"} thumb="schedule" />
          </nav>
          {!readOnly && <button type="button" className="qed__add" onClick={() => setPicker(true)}><Plus size={16} aria-hidden="true" />시험 추가</button>}
          <p className="qed__railnote">시험을 추가하면 카탈로그의 <b>표준가와 포함 범위</b>로 채워져요. 달라진 곳만 추가 비용으로 계산해요.</p>
        </aside>

        {/* 가운데: 책상 위 페이지 */}
        <main className="qed__desk">
          <div className="qed__deskbar">
            <p><b>{section}</b>{mode === "edit" && test ? <> 표준가 포함 범위에서 <mark>달라진 곳</mark>을 표시해요</> : null}</p>
            <div className="qed__seg" role="tablist" aria-label="보기">
              <button type="button" role="tab" aria-selected={mode === "edit"} onClick={() => setMode("edit")}>편집</button>
              <button type="button" role="tab" aria-selected={mode === "preview"} onClick={() => setMode("preview")}>PDF 미리보기</button>
              {head.rfqNo && <button type="button" role="tab" aria-selected={mode === "client"} onClick={() => setMode("client")}>의뢰자 화면</button>}
            </div>
          </div>

          {mode === "client" ? (
            <ClientView data={data} rfqNo={head.rfqNo ?? ""} />
          ) : mode === "preview" ? (
            <div className="qed__paper">
              {page === "cover" && <Cover head={head} data={data} style={style} i={1} total={total} />}
              {page === "quote" && <QuotePage head={head} data={data} style={style} i={2} total={total} />}
              {test && <DetailPage head={head} t={test} idx={data.tests.indexOf(test)} count={data.tests.length} style={style} i={pageNo} total={total} />}
              {page === "schedule" && <SchedulePage head={head} data={data} style={style} i={total} total={total} />}
            </div>
          ) : (
            <div className="qed__paper">
              {page === "cover" && <CoverEdit head={head} setH={setH} readOnly={readOnly} style={style} data={data} total={total} />}
              {page === "quote" && <QuoteEdit head={head} data={data} setDoc={setDoc} style={style} total={total} readOnly={readOnly} />}
              {test && <TestEdit t={test} idx={data.tests.indexOf(test)} count={data.tests.length} head={head} style={style} set={(p) => setTest(test.uid, p)} onRemove={() => removeTest(test)} onMove={(d) => move(test, d)} pageNo={pageNo} total={total} readOnly={readOnly} />}
              {page === "schedule" && <ScheduleEdit data={data} setTest={setTest} head={head} style={style} total={total} readOnly={readOnly} />}
              {page.startsWith("detail:") && !test && <div className="qd"><p className="qed__empty">시험을 추가하면 여기에서 설계를 고칠 수 있어요.</p></div>}
            </div>
          )}
        </main>

        {/* 오른쪽: 금액 장부 */}
        <aside className="qed__ledger" aria-label="금액">
          {test && <TestLedger t={test} set={(p) => setTest(test.uid, p)} readOnly={readOnly} />}

          <section className="qed__sec">
            <div className="qed__sech"><h2 className="qed__h">의뢰자에게 보이는 항목</h2><span>이 견적서만</span></div>
            <Check on={data.visible.perTest} disabled={readOnly} onChange={(v) => setDoc({ visible: { ...data.visible, perTest: v } })}>시험별 금액</Check>
            <Check on={data.visible.adjust} disabled={readOnly || !data.visible.perTest} onChange={(v) => setDoc({ visible: { ...data.visible, adjust: v } })}>추가 비용 내역</Check>
            <Check on={data.visible.formula} disabled={readOnly || !data.visible.perTest || !data.visible.adjust} onChange={(v) => setDoc({ visible: { ...data.visible, formula: v } })}>단가와 계산식</Check>
          </section>

          <section className="qed__sec">
            <div className="qed__sech"><h2 className="qed__h">견적서 전체</h2><span>원, VAT 별도</span></div>
            <table className="qed__sum">
              <tbody>
                {data.tests.map((t) => {
                  const c = testLines(t);
                  return <tr key={t.uid}><td><button type="button" onClick={() => { setPage(`detail:${t.uid}`); setPane("desk"); }}>{t.title}</button>{c.changes > 0 && <small> 변경 {c.changes}</small>}</td><td className="tnum">{n(c.total)}</td></tr>;
                })}
                {!data.tests.length && <tr><td colSpan={2} className="qed__muted">아직 시험이 없어요.</td></tr>}
              </tbody>
              <tbody className="qed__sumfoot">
                {totals.discount > 0 && <tr><td>시험 금액 합계</td><td className="tnum">{n(totals.sum)}</td></tr>}
                <tr>
                  <td><label htmlFor="qed-discount">할인</label></td>
                  <td><input id="qed-discount" className="qed__num" inputMode="numeric" disabled={readOnly} value={data.discount ? n(data.discount) : ""} placeholder="0" onChange={(e) => setDoc({ discount: Number(digits(e.target.value) || 0) })} /></td>
                </tr>
                <tr><td>공급가액</td><td className="tnum">{n(totals.supply)}</td></tr>
                <tr><td>부가세 (10%)</td><td className="tnum">{n(totals.vat)}</td></tr>
                <tr className="qed__grand"><td>합계금액</td><td className="tnum">{n(totals.grand)}</td></tr>
              </tbody>
            </table>
            <p className="qed__muted">{head.validUntil ? <>견적 유효기간 <b className="tnum">{head.validUntil}</b>까지</> : "견적 유효기간을 표지에서 정하세요"}{scheduleWeeks(data) ? <> · 착수부터 최종 보고서까지 <b>{scheduleWeeks(data)}주</b></> : null}</p>
          </section>

          <section className="qed__memo">
            <div className="qed__sech"><label className="qed__h" htmlFor="qed-memo">내부 메모</label><span>의뢰자에게 보이지 않아요</span></div>
            <textarea id="qed-memo" rows={3} disabled={readOnly} value={head.memo} placeholder="예: TK 채혈 시점은 의뢰자 확인 뒤 확정" onChange={(e) => setH({ memo: e.target.value.slice(0, 2000) })} />
          </section>
          {!readOnly && <DocMenu id={head.id} onDone={(href) => router.push(href)} />}
        </aside>
      </div>

      {picker && <TestPicker catalog={catalog} rates={rates} onAdd={addTest} onClose={() => setPicker(false)} />}
    </div>
  );
}

function Toc({ on, onClick, title, sub, thumb }: { on: boolean; onClick: () => void; title: string; sub: string; thumb: "cover" | "quote" | "detail" | "schedule" }) {
  return (
    <button type="button" className="qed__toci" aria-current={on ? "true" : undefined} onClick={onClick}>
      <span className="qed__thumb" data-k={thumb} aria-hidden="true"><i /><i /><i /><i /></span>
      <span><b>{title}</b><small>{sub}</small></span>
    </button>
  );
}

function Check({ on, disabled, onChange, children }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="qed__ck">
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** 점선 칸: 문서 위에서 바로 고치는 글자 칸. 표준과 다르면 형광펜 + 원래 값 취소선 */
function Field({ value, was, onChange, label, disabled, wide, mono, placeholder }: { value: string; was?: string; onChange: (v: string) => void; label: string; disabled?: boolean; wide?: boolean; mono?: boolean; placeholder?: string }) {
  const changed = was !== undefined && was !== value;
  return (
    <span className="qed__fld" data-wide={wide ? "1" : undefined}>
      {changed && <s className="qed__was">{was || "없음"}</s>}
      <input aria-label={label} className={`qed__in${changed ? " is-ch" : ""}${mono ? " tnum" : ""}`} value={value} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </span>
  );
}

function NumCell({ value, was, onChange, label, disabled }: { value: number; was?: number; onChange: (v: number) => void; label: string; disabled?: boolean }) {
  const changed = was !== undefined && was !== value;
  return (
    <td className="qed__ncell">
      {changed && <s className="qed__was">{was === 0 ? "-" : was}</s>}
      <input aria-label={label} className={`qed__nin tnum${changed ? " is-ch" : ""}`} inputMode="numeric" disabled={disabled} value={value ? String(value) : ""} placeholder="0" onChange={(e) => onChange(Number(digits(e.target.value).slice(0, 3) || 0))} />
    </td>
  );
}

function PageHead({ head, style, right }: { head: DocHead; style: QuoteStyle; right?: React.ReactNode }) {
  return (
    <header className="qd__head" data-pos={style.logoPos}>
      <Logo style={style} />
      <div className="qd__meta">{right ?? <><div>견적번호 <span className="qd__num">{head.docNo}</span></div><div>작성일 <span className="qd__num">{head.issuedOn}</span></div></>}</div>
    </header>
  );
}

function CoverEdit({ head, setH, readOnly, style, data, total }: { head: DocHead; setH: (p: Partial<DocHead>) => void; readOnly: boolean; style: QuoteStyle; data: DocData; total: number }) {
  return (
    <>
      <section className="qd qd--edit" style={brandVars(style)}>
        <PageHead head={head} style={style} right={<div>견적번호 <span className="qd__num">{head.docNo}</span></div>} />
        <h1 className="qd__h1">표지</h1>
        <p className="qd__lead">점선 칸을 눌러 수정해요. 공급자 정보와 로고는 <Link href="/cro/docs/style">견적서 양식</Link>에서 정해요.</p>
        <dl className="qed__kv">
          <div><dt>의뢰자</dt><dd><Field label="의뢰자" value={head.client} disabled={readOnly} wide placeholder="회사명 또는 단추 요청 번호" onChange={(v) => setH({ client: v.slice(0, 200) })} /></dd></div>
          <div><dt>시험물질</dt><dd><Field label="시험물질" value={head.substance} disabled={readOnly} wide placeholder="예: 물질 코드" onChange={(v) => setH({ substance: v.slice(0, 200) })} /></dd></div>
          <div><dt>작성일</dt><dd><input className="qed__in tnum" type="date" aria-label="작성일" disabled={readOnly} value={head.issuedOn} onChange={(e) => e.target.value && setH({ issuedOn: e.target.value })} /></dd></div>
          <div><dt>견적 유효기간</dt><dd><input className="qed__in tnum" type="date" aria-label="견적 유효기간" disabled={readOnly} value={head.validUntil ?? ""} onChange={(e) => setH({ validUntil: e.target.value || null })} />까지</dd></div>
        </dl>
      </section>
      <p className="qed__under">PDF에서는 이렇게 보여요</p>
      <Cover head={head} data={data} style={style} i={1} total={total} />
    </>
  );
}

function QuoteEdit({ head, data, setDoc, style, total, readOnly }: { head: DocHead; data: DocData; setDoc: (p: Partial<DocData>) => void; style: QuoteStyle; total: number; readOnly: boolean }) {
  const setT = (k: keyof DocData["terms"], v: string) => setDoc({ terms: { ...data.terms, [k]: v } });
  return (
    <>
      <section className="qd qd--edit" style={brandVars(style)}>
        <PageHead head={head} style={style} />
        <h1 className="qd__h1">거래 조건</h1>
        <p className="qd__lead">견적 내역과 금액은 시험 상세 설명에서 고친 대로 채워져요. 기본 문구는 <Link href="/cro/docs/style">견적서 양식</Link>에서 정해요.</p>
        <dl className="qed__kv">
          <div><dt>결제 조건</dt><dd><Field label="결제 조건" value={data.terms.pay} disabled={readOnly} wide placeholder="예: 계약 시 50%, 최종 보고서 제출 시 50%" onChange={(v) => setT("pay", v.slice(0, 300))} /></dd></div>
          <div><dt>별도 비용</dt><dd><Field label="별도 비용" value={data.terms.extra} disabled={readOnly} wide placeholder="예: 시험물질 운송, 영문 보고서" onChange={(v) => setT("extra", v.slice(0, 300))} /></dd></div>
          <div><dt>비고</dt><dd><Field label="비고" value={data.terms.note} disabled={readOnly} wide placeholder="예: 시험 설계가 바뀌면 수정 견적서를 다시 드립니다." onChange={(v) => setT("note", v.slice(0, 600))} /></dd></div>
        </dl>
      </section>
      <p className="qed__under">PDF에서는 이렇게 보여요</p>
      <QuotePage head={head} data={data} style={style} i={2} total={total} />
    </>
  );
}

function TestEdit({ t, idx, count, head, style, set, onRemove, onMove, pageNo, total, readOnly }: { t: DocTest; idx: number; count: number; head: DocHead; style: QuoteStyle; set: (p: Partial<DocTest>) => void; onRemove: () => void; onMove: (d: -1 | 1) => void; pageNo: number; total: number; readOnly: boolean }) {
  const stdById = new Map(t.std.groups.map((g) => [g.id, g]));
  const rec = t.groups.some((g) => g.rm + g.rf > 0) || t.std.groups.some((g) => g.rm + g.rf > 0);
  const setG = (id: string, p: Partial<DocGroup>) => set({ groups: t.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) });
  const addGroup = () => {
    const last = t.groups[t.groups.length - 1];
    const per = t.std.groups[0]?.m ?? last?.m ?? 0;
    const g: DocGroup = { id: uid("g"), label: `G${t.groups.length + 1} 시험군`, dose: "", m: per, f: per, rm: 0, rf: 0 };
    set({ groups: [...t.groups, g] });
  };
  const total0 = mainAnimals(t.std.groups) + recoveryAnimals(t.std.groups);
  const total1 = mainAnimals(t.groups) + recoveryAnimals(t.groups);
  const ch = condChanges(t);
  const added = t.evals.filter((e) => e.on && !e.base).length;
  const qtyRates = t.rates.filter((r) => r.kind === "qty");
  return (
    <section className="qd qd--edit" style={brandVars(style)}>
      <PageHead head={head} style={style} />
      <div className="qed__testtop">
        <p className="qd__cap">시험 {idx + 1} / {count}</p>
        {!readOnly && (
          <div className="qed__testtools">
            <button type="button" className="btxt" disabled={idx === 0} onClick={() => onMove(-1)}>앞으로</button>
            <button type="button" className="btxt" disabled={idx === count - 1} onClick={() => onMove(1)}>뒤로</button>
            <button type="button" className="btxt" onClick={onRemove}><Trash size={14} aria-hidden="true" /> 이 시험 빼기</button>
          </div>
        )}
      </div>
      <input className="qed__h1in" aria-label="시험 이름" value={t.title} disabled={readOnly} onChange={(e) => set({ title: e.target.value.slice(0, 160) })} />
      <input className="qed__subin" aria-label="시험 부제" value={t.subtitle} disabled={readOnly} placeholder="예: 설치류(랫드) · 경구 · GLP" onChange={(e) => set({ subtitle: e.target.value.slice(0, 160) })} />

      <div className="qed__h2row"><h2 className="qd__h2">시험 조건</h2><span>점선 칸을 눌러 수정해요{ch.length ? ` · 변경 ${ch.length}` : ""}</span></div>
      <dl className="qed__cond">
        {COND_LABEL.map(([k, label]) => (
          <div key={k}><dt>{label}</dt><dd><Field label={label} value={t.cond[k]} was={t.catalogId ? t.std.cond[k] : undefined} disabled={readOnly} wide onChange={(v) => set({ cond: { ...t.cond, [k]: v.slice(0, 160) } })} /></dd></div>
        ))}
      </dl>

      {(t.groups.length > 0 || t.std.groups.length > 0) && (
        <>
          <div className="qed__h2row"><h2 className="qd__h2">군 구성</h2><span className="tnum">총 {total0 !== total1 ? <>{total0} → <mark>{total1}</mark></> : total1}마리</span></div>
          <div className="qed__tblwrap">
            <table className="qd__groups qed__groups">
              <thead>
                {rec && <tr><th /><th /><th colSpan={2} className="c">본시험군</th><th colSpan={2} className="c">회복군</th><th /><th /></tr>}
                <tr><th>군</th><th>용량</th><th className="r">수컷</th><th className="r">암컷</th>{rec && <><th className="r">수컷</th><th className="r">암컷</th></>}<th className="r">합계</th><th /></tr>
              </thead>
              <tbody>
                {t.groups.map((g) => {
                  const s = stdById.get(g.id);
                  return (
                    <tr key={g.id} className={s ? undefined : "is-new"}>
                      <td><input aria-label="군 이름" className="qed__in" value={g.label} disabled={readOnly} onChange={(e) => setG(g.id, { label: e.target.value.slice(0, 40) })} />{!s && <small className="qed__newtag">추가</small>}</td>
                      <td><input aria-label={`${g.label} 용량`} className="qed__in tnum" value={g.dose} disabled={readOnly} placeholder="mg/kg/일" onChange={(e) => setG(g.id, { dose: e.target.value.slice(0, 40) })} /></td>
                      <NumCell label={`${g.label} 수컷`} value={g.m} was={s?.m} disabled={readOnly} onChange={(v) => setG(g.id, { m: v })} />
                      <NumCell label={`${g.label} 암컷`} value={g.f} was={s?.f} disabled={readOnly} onChange={(v) => setG(g.id, { f: v })} />
                      {rec && <NumCell label={`${g.label} 회복 수컷`} value={g.rm} was={s ? s.rm : 0} disabled={readOnly} onChange={(v) => setG(g.id, { rm: v })} />}
                      {rec && <NumCell label={`${g.label} 회복 암컷`} value={g.rf} was={s ? s.rf : 0} disabled={readOnly} onChange={(v) => setG(g.id, { rf: v })} />}
                      <td className="r tnum">{g.m + g.f + g.rm + g.rf}</td>
                      <td>{!readOnly && <button type="button" className="qed__x" aria-label={`${g.label} 빼기`} onClick={() => set({ groups: t.groups.filter((x) => x.id !== g.id) })}><X size={14} /></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><td>합계</td><td /><td className="r tnum">{t.groups.reduce((a, g) => a + g.m, 0)}</td><td className="r tnum">{t.groups.reduce((a, g) => a + g.f, 0)}</td>{rec && <><td className="r tnum">{t.groups.reduce((a, g) => a + g.rm, 0)}</td><td className="r tnum">{t.groups.reduce((a, g) => a + g.rf, 0)}</td></>}<td className="r tnum">{total1}</td><td /></tr></tfoot>
            </table>
          </div>
          {!readOnly && (
            <div className="qed__rowtools">
              <button type="button" className="btxt" onClick={addGroup}><Plus size={14} aria-hidden="true" /> 투여군 추가</button>
              {!rec && <button type="button" className="btxt" onClick={() => { const last = t.groups[t.groups.length - 1]; if (last) setG(last.id, { rm: 5, rf: 5 }); }}><Plus size={14} aria-hidden="true" /> 회복군 칸 열기</button>}
            </div>
          )}
        </>
      )}

      <div className="qed__h2row"><h2 className="qd__h2">평가항목</h2><span>기본 {t.evals.filter((e) => e.base).length}{added ? ` · 추가 ${added}` : ""}</span></div>
      {t.evals.length ? (
        <ul className="qed__evals">
          {t.evals.map((e, k) => {
            const r = e.rateId ? t.rates.find((x) => x.id === e.rateId) : undefined;
            return (
              <li key={`${e.name}-${k}`}>
                <label>
                  <input type="checkbox" checked={e.on} disabled={readOnly} onChange={(ev) => set({ evals: t.evals.map((x, j) => (j === k ? { ...x, on: ev.target.checked } : x)) })} />
                  <span className={!e.base && e.on ? "qed__mk" : undefined}>{e.name}</span>
                </label>
                <small>{e.base ? "기본" : e.on ? "추가" : r?.add ? `추가 시 + ${n(r.add)}` : "추가 시 금액 없음"}</small>
              </li>
            );
          })}
        </ul>
      ) : <p className="qed__muted">카탈로그에 기본 포함 항목을 적어 두면 여기에 채워져요.</p>}
      {!readOnly && <EvalAdder onAdd={(name) => set({ evals: [...t.evals, { name, on: true, base: true }] })} />}

      {qtyRates.length > 0 && (
        <>
          <div className="qed__h2row"><h2 className="qd__h2">수량 항목</h2><span>카탈로그 추가 비용 단가</span></div>
          <ul className="qed__qty">
            {qtyRates.map((r) => (
              <li key={r.id}>
                <span>{r.shown}</span>
                <span className="qed__qtyin">
                  <input aria-label={`${r.shown} 수량`} className={`qed__nin tnum${t.qty[r.id] ? " is-ch" : ""}`} inputMode="numeric" disabled={readOnly} value={t.qty[r.id] ? String(t.qty[r.id]) : ""} placeholder="0" onChange={(e) => { const v = e.target.value.trim(); const neg = v.startsWith("-"); const num = Number(digits(v).slice(0, 3) || 0); set({ qty: { ...t.qty, [r.id]: neg ? -num : num } }); }} />
                  {r.unit}
                </span>
                <small className="tnum">{r.add ? `${n(r.add)} / ${r.unit}` : "단가 없음"}</small>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="qed__h2row"><h2 className="qd__h2">시험 설명</h2></div>
      <textarea className="qed__desc" rows={4} aria-label="시험 설명" disabled={readOnly} value={t.description} placeholder="시험 목적과 방법을 적어요. 견적서 3부에 그대로 들어가요." onChange={(e) => set({ description: e.target.value.slice(0, 3000) })} />

      <footer className="qd__foot"><span>3부 시험 상세 설명</span><span className="qd__num">{pageNo} / {total}</span></footer>
    </section>
  );
}

function EvalAdder({ onAdd }: { onAdd: (name: string) => void }) {
  const [v, setV] = useState("");
  const add = () => { const s = v.trim().slice(0, 80); if (s) { onAdd(s); setV(""); } };
  return (
    <div className="qed__evaladd">
      <input aria-label="평가항목 이름" className="qed__in" value={v} placeholder="평가항목 직접 추가 (금액 없음)" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <button type="button" className="btxt" onClick={add} disabled={!v.trim()}>추가</button>
    </div>
  );
}

function TestLedger({ t, set, readOnly }: { t: DocTest; set: (p: Partial<DocTest>) => void; readOnly: boolean }) {
  const c = testLines(t);
  const manualPrice = !t.catalogId;
  return (
    <section className="qed__sec">
      <div className="qed__sech"><h2 className="qed__h qed__h--lg">이 시험 금액</h2>{t.itemKey && <Link href={`/cro/catalog/prices?item=${encodeURIComponent(t.itemKey)}`}>추가 비용 단가</Link>}</div>
      <p className="qed__muted">표준가에 달라진 곳의 추가 비용만 더해요</p>
      <ul className="qed__ledgerrows">
        <li>
          <div><span>표준가</span>{manualPrice || t.std.price == null ? <input aria-label="표준가" className="qed__num" inputMode="numeric" disabled={readOnly} value={t.std.price ? n(t.std.price) : ""} placeholder="금액 입력" onChange={(e) => set({ std: { ...t.std, price: e.target.value ? Number(digits(e.target.value)) : null } })} /> : <b className="tnum">{n(c.base)}</b>}</div>
          <small>{[t.subtitle, t.std.summary].filter(Boolean).join(" · ") || (manualPrice ? "카탈로그에 없는 시험이에요" : "")}</small>
          {!manualPrice && t.std.price == null && <small className="qed__warn">카탈로그에 이 조건의 표준가가 없어요. <Link href={`/cro/catalog/prices?item=${encodeURIComponent(t.itemKey)}`}>표준가 정하기</Link></small>}
        </li>
        {c.lines.filter((l) => l.kind !== "extra").map((l, k) => (
          <li key={k}><div><span>{l.label}</span><b className="tnum">{signed(l.amount)}</b></div><small className="tnum">{l.formula}</small>{l.amount === 0 && <small className="qed__warn">단가가 비어 있어 금액이 0원이에요.</small>}</li>
        ))}
        {t.extras.map((x) => (
          <li key={x.id} className="qed__extra">
            <div>
              <input aria-label="직접 입력 항목 이름" className="qed__in" value={x.label} disabled={readOnly} placeholder="항목 이름" onChange={(e) => set({ extras: t.extras.map((y) => (y.id === x.id ? { ...y, label: e.target.value.slice(0, 80) } : y)) })} />
              <input aria-label="직접 입력 금액" className="qed__num" inputMode="numeric" disabled={readOnly} value={x.amount ? (x.amount < 0 ? `-${n(-x.amount)}` : n(x.amount)) : ""} placeholder="0" onChange={(e) => { const neg = e.target.value.trim().startsWith("-"); const v = Number(digits(e.target.value) || 0); set({ extras: t.extras.map((y) => (y.id === x.id ? { ...y, amount: neg ? -v : v } : y)) }); }} />
              {!readOnly && <button type="button" className="qed__x" aria-label="항목 빼기" onClick={() => set({ extras: t.extras.filter((y) => y.id !== x.id) })}><X size={14} /></button>}
            </div>
            <small>직접 입력 · 빼려면 앞에 - 를 붙여요</small>
          </li>
        ))}
      </ul>
      {!readOnly && <button type="button" className="btxt qed__addline" onClick={() => set({ extras: [...t.extras, { id: uid("e"), label: "", amount: 0 }] })}><Plus size={14} aria-hidden="true" /> 금액 줄 직접 추가</button>}
      <div className="qed__testtotal"><span>이 시험 합계</span><b className="tnum">{n(c.total)}</b></div>
      <div className="qed__weeks">
        <label htmlFor={`w-${t.uid}`}>착수부터 이 시험이 끝날 때까지</label>
        <span><input id={`w-${t.uid}`} className="qed__nin tnum" inputMode="numeric" disabled={readOnly} value={t.weeks ?? ""} onChange={(e) => set({ weeks: e.target.value ? Math.min(520, Number(digits(e.target.value)) || 1) : null })} />주</span>
      </div>
    </section>
  );
}

function ScheduleEdit({ data, setTest, head, style, total, readOnly }: { data: DocData; setTest: (u: string, p: Partial<DocTest>) => void; head: DocHead; style: QuoteStyle; total: number; readOnly: boolean }) {
  const setP = (t: DocTest, id: string, p: Partial<Phase>) => setTest(t.uid, { phases: t.phases.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  return (
    <>
      <section className="qd qd--edit" style={brandVars(style)}>
        <PageHead head={head} style={style} />
        <h1 className="qd__h1">시험 수행 일정표</h1>
        <p className="qd__lead">시험물질 입고 주를 1주로 셉니다. 시험마다 시작 주와 단계를 고쳐요.</p>
        {data.tests.map((t) => (
          <div key={t.uid} className="qed__sched">
            <div className="qed__h2row">
              <h2 className="qd__h2">{t.title}</h2>
              <span className="qed__start">시작 <input aria-label={`${t.title} 시작 주`} className="qed__nin tnum" inputMode="numeric" disabled={readOnly} value={t.startWeek + 1} onChange={(e) => setTest(t.uid, { startWeek: Math.max(0, Math.min(519, (Number(digits(e.target.value)) || 1) - 1)) })} />주</span>
            </div>
            <div className="qed__tblwrap">
              <table className="qed__phases">
                <thead><tr><th>단계</th><th>종류</th><th className="r">시작</th><th className="r">기간</th><th /></tr></thead>
                <tbody>
                  {t.phases.map((p) => (
                    <tr key={p.id}>
                      <td><input aria-label="단계 이름" className="qed__in" value={p.name} disabled={readOnly} onChange={(e) => setP(t, p.id, { name: e.target.value.slice(0, 60) })} /></td>
                      <td>
                        <select aria-label="단계 종류" className="qed__sel" value={p.kind} disabled={readOnly} onChange={(e) => setP(t, p.id, { kind: e.target.value as PhaseKind })}>
                          {(Object.keys(PHASE_LABEL) as PhaseKind[]).map((k) => <option key={k} value={k}>{PHASE_LABEL[k]}</option>)}
                        </select>
                      </td>
                      <td className="r"><input aria-label="시작 주" className="qed__nin tnum" inputMode="numeric" disabled={readOnly} value={p.start + 1} onChange={(e) => setP(t, p.id, { start: Math.max(0, (Number(digits(e.target.value)) || 1) - 1) })} />주</td>
                      <td className="r">{p.kind === "point" ? "-" : <><input aria-label="기간" className="qed__nin tnum" inputMode="numeric" disabled={readOnly} value={p.weeks} onChange={(e) => setP(t, p.id, { weeks: Math.max(1, Math.min(520, Number(digits(e.target.value)) || 1)) })} />주</>}</td>
                      <td>{!readOnly && t.phases.length > 1 && <button type="button" className="qed__x" aria-label={`${p.name} 빼기`} onClick={() => setTest(t.uid, { phases: t.phases.filter((x) => x.id !== p.id) })}><X size={14} /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!readOnly && <button type="button" className="btxt" onClick={() => { const last = t.phases[t.phases.length - 1]; setTest(t.uid, { phases: [...t.phases, { id: uid("p"), name: "새 단계", start: last ? last.start + (last.kind === "point" ? 1 : last.weeks) : 0, weeks: 1, kind: "report" }] }); }}><Plus size={14} aria-hidden="true" /> 단계 추가</button>}
          </div>
        ))}
        {!data.tests.length && <p className="qed__muted">시험을 추가하면 카탈로그의 기간으로 일정이 채워져요.</p>}
      </section>
      <p className="qed__under">PDF에서는 이렇게 보여요</p>
      <SchedulePage head={head} data={data} style={style} i={total} total={total} />
    </>
  );
}

/** 단추 요청 비교표에 들어가는 값 (회신 보내기에서 채운다) */
function ClientView({ data, rfqNo }: { data: DocData; rfqNo: string }) {
  const t = docTotals(data);
  return (
    <div className="qed__client">
      <h2 className="qed__h qed__h--lg">의뢰자가 비교표에서 보는 값</h2>
      <p className="qed__muted">단추 요청 {rfqNo}의 회신 화면에 시험별 금액과 기간을 채워요. 의뢰자는 여러 기관의 값을 나란히 봐요.</p>
      <table className="tbl qed__ctbl">
        <thead><tr><th>시험</th><th>조건</th><th className="r">기간</th><th className="r">금액</th></tr></thead>
        <tbody>
          {data.tests.map((x) => {
            const c = testLines(x);
            return <tr key={x.uid}><td><b>{x.title}</b>{x.rfqSeq == null && <small className="qed__warn"> 요청에 없는 시험이라 비교표에는 들어가지 않아요</small>}</td><td>{condLine(x)}</td><td className="r tnum">{x.weeks ? `${x.weeks}주` : "-"}</td><td className="r tnum">{n(c.total)}</td></tr>;
          })}
        </tbody>
        <tfoot><tr><td colSpan={3}>공급가액</td><td className="r tnum">{n(t.supply)}</td></tr></tfoot>
      </table>
      <p className="qed__muted">견적서 PDF는 회신 화면에서 첨부해요. 할인은 시험별 금액에 나눠 넣지 않으니, 할인이 있으면 회신의 전달 사항에 적어 주세요.</p>
    </div>
  );
}

function DocMenu({ id, onDone }: { id: string; onDone: (href: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const act = async (action: "copy" | "delete") => {
    if (action === "delete" && !window.confirm("이 견적서를 삭제할까요? 되돌릴 수 없어요.")) return;
    setBusy(true); setErr("");
    const r = await fetch(`/api/cro/docs/${id}`, { method: action === "delete" ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: action === "copy" ? JSON.stringify({ action: "copy" }) : undefined }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { id?: string; error?: string } | undefined;
    setBusy(false);
    if (!r?.ok) return setErr(d?.error || "처리하지 못했어요.");
    onDone(action === "copy" && d?.id ? `/cro/docs/${d.id}` : "/cro/docs");
  };
  return (
    <div className="qed__menu">
      <button type="button" className="btxt" disabled={busy} onClick={() => act("copy")}>복제</button>
      <button type="button" className="btxt" disabled={busy} onClick={() => act("delete")}>삭제</button>
      {err && <span role="alert" className="qed__warn">{err}</span>}
    </div>
  );
}

/** 시험 추가: 카탈로그 조건 목록에서 고르거나, 카탈로그에 없는 시험을 직접 적는다 */
export function TestPicker({ catalog, rates, onAdd, onClose }: { catalog: CatalogRow[]; rates: Record<string, Rate[]>; onAdd: (t: DocTest) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  useEffect(() => { ref.current?.showModal(); }, []);
  const rows = catalog.filter((c) => c.available && (!q || `${c.category} ${c.item} ${c.species.join(" ")} ${c.route ?? ""} ${c.dosing ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  const byItem = new Map<string, CatalogRow[]>();
  for (const r of rows) byItem.set(r.item_key, [...(byItem.get(r.item_key) ?? []), r]);
  return (
    <dialog ref={ref} className="qed__dlg" onClose={onClose} aria-labelledby="qed-pick-title">
      <div className="qed__dlghead">
        <h2 id="qed-pick-title">시험 추가</h2>
        <button type="button" className="qed__x" aria-label="닫기" onClick={() => ref.current?.close()}><X size={18} /></button>
      </div>
      <input className="inp" type="search" aria-label="카탈로그 검색" placeholder="시험 이름, 동물종, 투여경로로 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="qed__dlglist">
        {[...byItem.entries()].map(([key, list]) => (
          <div key={key} className="qed__dlgitem">
            <p><b>{list[0].item}</b><span>{list[0].category}</span></p>
            {list.map((c) => (
              <button key={c.id} type="button" onClick={() => onAdd(testFromCatalog(c, rates[c.item_key] ?? []))}>
                <span>{[c.species.join("·"), c.route, c.dosing, c.method].filter(Boolean).join(" · ") || "조건 미입력"}</span>
                <b className="tnum">{c.std_price != null ? `${n(c.std_price)}원` : "표준가 없음"}</b>
              </button>
            ))}
          </div>
        ))}
        {!byItem.size && <p className="qed__muted">{catalog.length ? "찾는 시험이 없어요." : "카탈로그에 등록한 시험이 없어요. 카탈로그에 시험 조건을 등록하면 표준가로 채워져요."}</p>}
      </div>
      <div className="qed__dlgfoot">
        <Link href="/cro/catalog" className="btxt">카탈로그 열기</Link>
        <button type="button" className="b2 bsm" onClick={() => onAdd(blankTest())}>카탈로그에 없는 시험 직접 추가</button>
      </div>
    </dialog>
  );
}
