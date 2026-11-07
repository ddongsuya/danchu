"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, X } from "@phosphor-icons/react";
import {
  addDays, blankTest, docTitle, docTotals, mainAnimals, recoveryAnimals, scheduleWeeks, switchCond, testFromCatalog, testLines, uid,
  type DocData, type DocGroup, type DocHead, type DocTest, type QuoteStyle, type Rate,
} from "@/lib/quote-doc";
import type { CatalogRow } from "@/lib/catalog";
import { Cover, QuotePage } from "./DocPages";

/**
 * 견적서 질문 화면 (2026-11-07 시안 승인). 질문 하나씩 답하면 견적서가 채워진다.
 * 의뢰자 → 시험 → 금액(표준가 없는 시험만) → 바꿀 곳 → 바꾸기(고른 시험마다) → 거래 조건 → 확인.
 * PC는 왼쪽 질문 · 오른쪽 A4 미리보기, 960px 아래는 한 화면에 질문 하나와 아래 고정 버튼.
 * 저장은 문서 편집 화면과 같은 PUT /api/cro/docs/[id] (800ms 뒤 자동 저장).
 * head 가 없으면 아직 만들지 않은 새 견적서: 시험까지 고른 뒤 만들고 이 화면으로 다시 온다.
 */

type StepId = "client" | "tests" | "price" | "change" | "detail" | "terms" | "review";
const ORDER: StepId[] = ["client", "tests", "price", "change", "detail", "terms", "review"];
const BAR: Record<StepId, number> = { client: 1, tests: 2, price: 3, change: 4, detail: 4, terms: 5, review: 6 };

const n = (v: number) => v.toLocaleString("ko-KR");
const digits = (s: string, max = 12) => s.replace(/[^\d]/g, "").slice(0, max);
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

type Props = {
  head: DocHead | null;
  initial: DocData | null;
  style: QuoteStyle;
  catalog: CatalogRow[];
  rates: Record<string, Rate[]>;
  replyHref: string | null;
  start?: string;
  readOnly?: boolean;
};

export function QuoteFill({ head: head0, initial, style, catalog, rates, replyHref, start, readOnly = false }: Props) {
  const router = useRouter();
  const isNew = !head0;
  const blankHead: DocHead = { id: "", docNo: "새 견적서", title: "견적서", client: "", substance: "", issuedOn: today(), validUntil: null, inviteId: null, rfqNo: null, memo: "", updatedAt: "" };
  const [head, setHead] = useState<DocHead>(head0 ?? blankHead);
  const [data, setData] = useState<DocData>(initial ?? { tests: [], visible: { perTest: true, adjust: true, formula: false }, discount: 0, terms: style.terms, glp: "" });
  const first: StepId = ORDER.includes(start as StepId) ? (start as StepId) : head0?.rfqNo ? "tests" : "client";
  const [step, setStep] = useState<StepId>(first);
  // ?step=detail 로 바로 열면 첫 시험을 바꿀 시험으로 잡는다
  const [changeIds, setChangeIds] = useState<string[]>(() => (first === "detail" && initial?.tests[0] ? [initial.tests[0].uid] : []));
  const [at, setAt] = useState(0);
  const [saveToList, setSaveToList] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<"saved" | "saving" | "failed">("saved");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [peek, setPeek] = useState(false);
  const timer = useRef<number>(0);
  const abort = useRef<AbortController | null>(null);
  const rev = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const totals = useMemo(() => docTotals(data), [data]);
  const noPrice = data.tests.filter((t) => t.std.price == null);
  const changing = changeIds.map((u) => data.tests.find((t) => t.uid === u)).filter((t): t is DocTest => !!t);
  const cur = changing[Math.min(at, changing.length - 1)];

  /* ── 저장 ── */
  const queue = (h: DocHead, d: DocData) => {
    if (readOnly || !h.id) return;
    const mine = ++rev.current;
    setSaved("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;
      const ok = await fetch(`/api/cro/docs/${h.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: h.client, substance: h.substance, issuedOn: h.issuedOn, validUntil: h.validUntil, memo: h.memo, data: d }),
        signal: ac.signal,
      }).then((r) => r.ok).catch(() => (ac.signal.aborted ? null : false));
      if (ok === null || mine !== rev.current) return;
      setSaved(ok ? "saved" : "failed");
    }, 800);
  };
  useEffect(() => () => { window.clearTimeout(timer.current); abort.current?.abort(); }, []);
  useEffect(() => {
    if (saved === "saved") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);
  // 질문이 바뀌면 맨 위부터 보이게
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step, at]);

  const setDoc = (p: Partial<DocData>) => { const next = { ...data, ...p }; const h = { ...head, title: docTitle(next) }; setData(next); setHead(h); queue(h, next); };
  const setH = (p: Partial<DocHead>) => { const h = { ...head, ...p }; setHead(h); queue(h, data); };
  const setTest = (u: string, p: Partial<DocTest> | ((t: DocTest) => DocTest)) => setDoc({ tests: data.tests.map((t) => (t.uid === u ? (typeof p === "function" ? p(t) : { ...t, ...p }) : t)) });

  /* ── 이동 ── */
  const go = (s: StepId) => { setErr(""); setPeek(false); setStep(s); };
  const next = async () => {
    setErr("");
    if (step === "client") return go("tests");
    if (step === "tests") {
      if (isNew) return create();
      return go(noPrice.length ? "price" : "change");
    }
    if (step === "price") { await savePrices(); return go("change"); }
    if (step === "change") { setAt(0); return go(changing.length ? "detail" : "terms"); }
    if (step === "detail") { if (at < changing.length - 1) { setAt(at + 1); return; } return go("terms"); }
    if (step === "terms") return go("review");
  };
  const back = () => {
    setErr("");
    if (step === "detail" && at > 0) { setAt(at - 1); return; }
    if (step === "terms") return go(changing.length ? "detail" : "change");
    if (step === "change") return go(noPrice.length ? "price" : "tests");
    const i = ORDER.indexOf(step);
    if (i > 0) go(ORDER[i - 1]);
  };

  /** 새 견적서: 시험까지 고르면 만든다. 만든 뒤 같은 질문 화면의 다음 단계로 */
  const create = async () => {
    setBusy(true);
    const ids = data.tests.map((t) => t.catalogId).filter((x): x is string => !!x);
    const manual = data.tests.filter((t) => !t.catalogId).map((t) => t.title);
    const r = await fetch("/api/cro/docs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogIds: ids, manual, client: head.client, substance: head.substance }) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { id?: string; error?: string } | undefined;
    if (!r?.ok || !d?.id) { setBusy(false); setErr(d?.error || "견적서를 만들지 못했어요. 네트워크를 확인하고 다시 시도해 주세요."); return; }
    const nextStep = data.tests.some((t) => t.std.price == null) ? "price" : "change";
    router.replace(`/cro/docs/${d.id}/fill?step=${nextStep}`);
  };

  /** 금액 단계: "시험 목록에도 저장"을 켠 시험의 표준가를 시험 목록에 적는다 */
  const savePrices = async () => {
    const list = data.tests.filter((t) => t.catalogId && t.std.price != null && canSave(t) && saveToList[t.uid] !== false);
    for (const t of list) {
      await fetch("/api/cro/rates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemKey: t.itemKey, prices: [{ id: t.catalogId, std_price: t.std.price }] }) }).catch(() => null);
    }
  };

  /* ── 질문 ── */
  let h = "", lead = "", body: React.ReactNode = null, nextLabel = "다음", alt: React.ReactNode = null, cost: React.ReactNode = null;
  let canNext = !readOnly;

  if (step === "client") {
    h = "누구에게 보내는 견적서인가요?";
    lead = head.rfqNo ? "받은 요청에서 만든 견적서라 채워져 있어요." : "견적서 표지에 들어가요.";
    body = (
      <>
        <div className="qf__q">
          <label className="qf__lab" htmlFor="qf-client">의뢰자</label>
          <input id="qf-client" className="inp" value={head.client} maxLength={200} placeholder="회사명" disabled={readOnly} onChange={(e) => setH({ client: e.target.value })} />
        </div>
        <div className="qf__q">
          <label className="qf__lab" htmlFor="qf-sub">시험물질 <span className="qf__opt">선택</span></label>
          <input id="qf-sub" className="inp" value={head.substance} maxLength={200} placeholder="예: 물질 코드" disabled={readOnly} onChange={(e) => setH({ substance: e.target.value })} />
          <span className="qf__help">이름을 밝히기 어려우면 코드명으로 적어요.</span>
        </div>
      </>
    );
    canNext = canNext && !!head.client.trim();
  }

  if (step === "tests") {
    h = "어떤 시험을 넣을까요?";
    lead = "시험 목록에 적어 둔 조건과 표준가로 채워져요.";
    body = <TestsQ catalog={catalog} rates={rates} tests={data.tests} readOnly={readOnly} onChange={(tests) => setDoc({ tests })} />;
    nextLabel = data.tests.length ? `${data.tests.length}개 넣기` : "시험을 골라 주세요";
    canNext = canNext && data.tests.length > 0 && !busy;
    if (busy) nextLabel = "만드는 중…";
  }

  if (step === "price") {
    // 적는 동안 줄이 사라지지 않게, 이 단계에서 금액을 적은 시험도 함께 둔다
    const list = data.tests.filter((t) => t.std.price == null || (saveToList[t.uid] !== undefined));
    h = list.length ? `표준가가 없는 시험이 ${list.length}개 있어요` : "모든 시험에 금액이 있어요";
    lead = "이 견적서에 쓸 금액을 적어 주세요. 시험 목록에도 저장하면 다음 견적서부터 바로 채워져요.";
    body = (
      <div className="qf__list">
        {list.map((t) => (
          <div key={t.uid} className="qf__mrow">
            <div>
              <b>{t.title}</b>
              <span className="qf__sub">{t.subtitle || "조건 미입력"}</span>
              {t.catalogId && canSave(t) && (
                <label className="qf__save">
                  <input type="checkbox" checked={saveToList[t.uid] !== false} disabled={readOnly} onChange={(e) => setSaveToList((s) => ({ ...s, [t.uid]: e.target.checked }))} />
                  시험 목록 표준가로도 저장
                </label>
              )}
            </div>
            <div className="numin qf__money">
              <input type="text" inputMode="numeric" aria-label={`${t.title} 금액`} placeholder="금액" disabled={readOnly} value={t.std.price != null ? n(t.std.price) : ""} onChange={(e) => { const v = digits(e.target.value); setSaveToList((s) => (t.uid in s ? s : { ...s, [t.uid]: true })); setTest(t.uid, (x) => ({ ...x, std: { ...x.std, price: v ? Number(v) : null } })); }} />
              <span>원</span>
            </div>
          </div>
        ))}
      </div>
    );
    const left = noPrice.length;
    nextLabel = left ? `${left}개 남았어요` : "다음";
    canNext = canNext && left === 0;
  }

  if (step === "change") {
    h = "표준과 다르게 할 시험이 있나요?";
    lead = "의뢰자 요청이 표준 설계와 다른 시험만 골라요. 나머지는 표준가 그대로 들어가요.";
    body = (
      <div className="qf__list" role="group" aria-label="바꿀 시험">
        {data.tests.map((t) => {
          const on = changeIds.includes(t.uid);
          return (
            <button key={t.uid} type="button" className="qf__prow" aria-pressed={on} onClick={() => setChangeIds((s) => (on ? s.filter((x) => x !== t.uid) : [...s, t.uid]))}>
              <span className="qf__box" aria-hidden="true">{on && <Check size={13} weight="bold" />}</span>
              <span className="qf__pt"><b>{t.title}</b><span className="qf__sub">{t.subtitle}</span></span>
              <span className="qf__amt tnum">{n(testLines(t).total)}원</span>
            </button>
          );
        })}
      </div>
    );
    nextLabel = changeIds.length ? `${changeIds.length}개 바꾸기` : "모두 표준대로";
    if (changeIds.length) alt = <button type="button" className="b2" onClick={() => { setChangeIds([]); go("terms"); }}>모두 표준대로</button>;
  }

  if (step === "detail" && cur) {
    const c = testLines(cur);
    h = `${cur.title}, 무엇이 다른가요?`;
    lead = changing.length > 1 ? `바꿀 시험 ${changing.length}개 중 ${at + 1}번째예요. 바꾼 곳만 추가 비용으로 더해요.` : "바꾼 곳만 추가 비용으로 더해요. 단가는 시험 목록에 적은 값이에요.";
    body = <DetailQ key={cur.uid} t={cur} readOnly={readOnly} set={(p) => setTest(cur.uid, p)} />;
    const zero = c.lines.filter((l) => l.amount === 0 && l.kind !== "extra");
    cost = (
      <div className="qf__cost" aria-live="polite">
        <span className="qf__help tnum">{[`표준가 ${cur.std.price != null ? n(cur.std.price) : "없음"}`, ...c.lines.map((l) => `${l.label} ${l.amount < 0 ? `- ${n(-l.amount)}` : n(l.amount)}`)].join(" + ").replace(/\+ -/g, "-")}</span>
        <b>이 시험 금액 <mark className="tnum">{n(c.total)}원</mark></b>
        {zero.length > 0 && <span className="qf__warn">{zero.map((l) => l.label.split(" · ")[0]).join(", ")} 단가가 비어 있어 0원이에요. <Link href={`/cro/catalog?item=${encodeURIComponent(cur.itemKey)}`}>시험 목록에서 적기</Link></span>}
      </div>
    );
    nextLabel = at < changing.length - 1 ? "다음 시험" : "다음";
  }

  if (step === "terms") {
    h = "거래 조건을 확인해 주세요";
    lead = "기관 기본값이 들어가 있어요. 이 견적서에서만 바뀌어요.";
    body = <TermsQ head={head} data={data} setH={setH} setDoc={setDoc} readOnly={readOnly} />;
  }

  if (step === "review") {
    const weeks = scheduleWeeks(data);
    h = "견적서가 준비됐어요";
    lead = `시험 ${data.tests.length}개${weeks ? `, 착수부터 최종 보고서까지 ${weeks}주` : ""}예요.`;
    body = (
      <>
        <p className="qf__big tnum">{n(totals.grand)}원<small>VAT 포함</small></p>
        <div className="qf__sum">
          {data.tests.map((t) => <div key={t.uid}><span>{t.title}</span><span className="tnum">{n(totals.tests.find((x) => x.uid === t.uid)?.total ?? 0)}</span></div>)}
          {totals.discount > 0 && <div><span>할인</span><span className="tnum">- {n(totals.discount)}</span></div>}
          <div><span>부가세 (10%)</span><span className="tnum">{n(totals.vat)}</span></div>
        </div>
        <div className="qf__acts">
          <Link className="b2" href={`/cro/docs/${head.id}/print`}>PDF 받기</Link>
          <a className="b2" href={`/api/cro/docs/${head.id}/xlsx`}>엑셀 받기</a>
          <Link className="qf__lk" href={`/cro/docs/${head.id}`}>문서에서 직접 고치기</Link>
        </div>
      </>
    );
  }

  const ix = ORDER.indexOf(step);
  const showBack = ix > 0;
  const primary = step === "review"
    ? replyHref ? <Link className="b1" href={replyHref}>회신에 붙이기</Link> : <Link className="b1" href="/cro/docs">견적서 목록으로</Link>
    : <button type="button" className="b1" disabled={!canNext} onClick={next}>{nextLabel}</button>;
  const savedLabel = readOnly ? "읽기 전용" : isNew ? "시험을 고르면 저장돼요" : saved === "saving" ? "저장 중…" : saved === "failed" ? "저장 실패" : "자동 저장됨";
  const preview = step === "client" ? <Cover head={head} data={data} style={style} i={1} total={3 + data.tests.length} /> : <QuotePage head={head} data={data} style={style} i={2} total={3 + data.tests.length} />;

  return (
    <div className="qf">
      <header className="qf__top">
        <Link className="qf__x" href="/cro/docs" aria-label="닫기"><X size={20} aria-hidden="true" /></Link>
        <span className="qf__t">{isNew ? "새 견적서" : head.title}</span>
        <span role="status" className="qf__sv" data-s={saved}>{savedLabel}</span>
        {saved === "failed" && <button type="button" className="b2 bsm" onClick={() => queue(head, data)}>다시 저장</button>}
        <span className="qf__sp" />
        {head.id && <Link className="qf__lk qf__pc" href={`/cro/docs/${head.id}`}>문서에서 직접 고치기</Link>}
        <button type="button" className="qf__lk qf__m" aria-pressed={peek} onClick={() => setPeek((v) => !v)}>{peek ? "질문으로" : "미리보기"}</button>
      </header>

      <div className="qf__split" data-peek={peek ? "1" : undefined}>
        <section className="qf__ask" aria-labelledby="qf-h">
          <div className="qf__body" ref={bodyRef}>
            <div className="qf__steps" aria-label={`6단계 중 ${BAR[step]}단계`}>{[1, 2, 3, 4, 5, 6].map((i) => <span key={i} data-on={i <= BAR[step] ? "1" : undefined} />)}</div>
            <h1 id="qf-h" className="qf__h">{h}</h1>
            <p className="qf__lead">{lead}</p>
            {body}
          </div>
          {cost}
          <div className="qf__foot">
            {err && <span role="alert" className="qf__err">{err}</span>}
            {showBack && <button type="button" className="b2" onClick={back}>이전</button>}
            <span className="qf__sp" />
            {alt}
            {primary}
          </div>
        </section>
        <aside className="qf__desk" aria-label="견적서 미리보기">
          <Paper>{preview}</Paper>
        </aside>
      </div>
    </div>
  );
}

/** 표준 설계와 같은 조건이거나 시험 목록에 조건이 하나뿐일 때만 시험 목록 표준가로 저장할 수 있다 */
function canSave(t: DocTest): boolean {
  const ch = t.std.choices;
  if (!ch) return true;
  return (ch.species[0] ?? "") === t.cond.species && (ch.routes[0] ?? "") === t.cond.route;
}

/** A4 한 장을 칸 너비에 맞게 줄여 보여 준다 */
function Paper({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(0.6);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setZ(Math.min(1, Math.max(0.3, (el.clientWidth - 8) / 794)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div className="qf__paper" ref={ref}><div className="qf__zoom" style={{ zoom: z }}>{children}</div></div>;
}

/* ── 2. 시험 ── */
function TestsQ({ catalog, rates, tests, readOnly, onChange }: { catalog: CatalogRow[]; rates: Record<string, Rate[]>; tests: DocTest[]; readOnly: boolean; onChange: (t: DocTest[]) => void }) {
  const [q, setQ] = useState("");
  const [own, setOwn] = useState("");
  const cats = useMemo(() => {
    const m = new Map<string, CatalogRow[]>();
    for (const c of catalog) {
      if (q && !`${c.category} ${c.item} ${c.species.join(" ")} ${(c.routes ?? []).join(" ")} ${c.dosing ?? ""}`.toLowerCase().includes(q.toLowerCase())) continue;
      m.set(c.category, [...(m.get(c.category) ?? []), c]);
    }
    return m;
  }, [catalog, q]);
  const toggle = (c: CatalogRow) => {
    const had = tests.find((t) => t.catalogId === c.id);
    onChange(had ? tests.filter((t) => t !== had) : [...tests, testFromCatalog(c, rates[c.item_key] ?? [])]);
  };
  const manual = tests.filter((t) => !t.catalogId);
  if (!catalog.length) {
    return (
      <div className="qf__empty">
        <b>시험 목록에 담은 시험이 없어요</b>
        <span>시험 목록에 조건과 표준가를 적어 두면 여기에서 고를 수 있어요. 아래에서 시험 이름을 직접 적어도 돼요.</span>
        <Link className="b2 bsm" href="/cro/catalog">시험 목록 열기</Link>
        <Own value={own} setValue={setOwn} onAdd={(name) => onChange([...tests, blankTest(name)])} disabled={readOnly} />
        {manual.length > 0 && <ManualList tests={manual} onRemove={(u) => onChange(tests.filter((t) => t.uid !== u))} />}
      </div>
    );
  }
  return (
    <>
      {catalog.length > 8 && <input className="inp qf__search" type="search" aria-label="시험 찾기" placeholder="시험 이름, 동물종, 투여경로로 찾기" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="qf__list">
        {[...cats.entries()].map(([cat, rows]) => (
          <div key={cat} className="qf__cat">
            <h3>{cat}</h3>
            {rows.map((c) => {
              const on = tests.some((t) => t.catalogId === c.id);
              const cond = [c.species.join("·"), (c.routes?.length ? c.routes.join("·") : c.route), c.dosing].filter(Boolean).join(", ");
              return (
                <button key={c.id} type="button" className="qf__prow" aria-pressed={on} disabled={readOnly} onClick={() => toggle(c)}>
                  <span className="qf__box" aria-hidden="true">{on && <Check size={13} weight="bold" />}</span>
                  <span className="qf__pt"><b>{c.item}</b><span className="qf__sub">{cond || "조건 미입력"}</span></span>
                  <span className="qf__amt tnum">{c.std_price != null ? `${n(c.std_price)}원` : <span className="qf__tag">표준가 없음</span>}</span>
                </button>
              );
            })}
          </div>
        ))}
        {!cats.size && <p className="qf__help">찾는 시험이 없어요. 아래에서 직접 적어요.</p>}
      </div>
      {manual.length > 0 && <ManualList tests={manual} onRemove={(u) => onChange(tests.filter((t) => t.uid !== u))} />}
      <Own value={own} setValue={setOwn} onAdd={(name) => onChange([...tests, blankTest(name)])} disabled={readOnly} />
    </>
  );
}

function Own({ value, setValue, onAdd, disabled }: { value: string; setValue: (v: string) => void; onAdd: (name: string) => void; disabled: boolean }) {
  const add = () => { const s = value.trim().slice(0, 120); if (s) { onAdd(s); setValue(""); } };
  return (
    <div className="qf__q">
      <label className="qf__lab" htmlFor="qf-own">시험 목록에 없는 시험</label>
      <div className="qf__own">
        <input id="qf-own" className="inp" value={value} placeholder="시험 이름" disabled={disabled} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="b2" disabled={disabled || !value.trim()} onClick={add}>넣기</button>
      </div>
    </div>
  );
}

function ManualList({ tests, onRemove }: { tests: DocTest[]; onRemove: (uid: string) => void }) {
  return (
    <div className="qf__cat">
      <h3>직접 적은 시험</h3>
      {tests.map((t) => (
        <div key={t.uid} className="qf__prow" aria-pressed="true">
          <span className="qf__box" aria-hidden="true"><Check size={13} weight="bold" /></span>
          <span className="qf__pt"><b>{t.title}</b><span className="qf__sub">다음 질문에서 금액을 적어요</span></span>
          <button type="button" className="qf__lk" onClick={() => onRemove(t.uid)}>빼기</button>
        </div>
      ))}
    </div>
  );
}

/* ── 4-1. 바꾸기 ── */
type Tab = "groups" | "cond" | "evals";
function DetailQ({ t, readOnly, set }: { t: DocTest; readOnly: boolean; set: (p: Partial<DocTest> | ((t: DocTest) => DocTest)) => void }) {
  const hasGroups = t.std.groups.length > 0 || t.groups.length > 0;
  const extraEvals = t.evals.filter((e) => !e.base);
  const qty = t.rates.filter((r) => r.kind === "qty");
  const tabs: [Tab, string][] = [...(hasGroups ? [["groups", "동물 수·군 구성"] as [Tab, string]] : []), ["cond", "조건"], ...(extraEvals.length || qty.length ? [["evals", "평가항목"] as [Tab, string]] : [])];
  const [tab, setTab] = useState<Tab>(tabs[0][0]);
  const stdById = new Map(t.std.groups.map((g) => [g.id, g]));
  const setG = (id: string, p: Partial<DocGroup>) => set((x) => ({ ...x, groups: x.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) }));
  const total0 = mainAnimals(t.std.groups) + recoveryAnimals(t.std.groups);
  const total1 = mainAnimals(t.groups) + recoveryAnimals(t.groups);
  const recStd = recoveryAnimals(t.std.groups);
  const ch = t.std.choices;

  return (
    <>
      {tabs.length > 1 && (
        <div className="chips qf__tabs" role="tablist" aria-label="바꿀 곳">
          {tabs.map(([k, label]) => <button key={k} type="button" role="tab" className="chip" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>)}
        </div>
      )}

      {tab === "groups" && (
        <div className="qf__q">
          <div className="qf__grp qf__grp--hd" aria-hidden="true"><span>군</span><span>암수 각</span><span>회복군 암수 각</span><span className="qf__c3">용량</span></div>
          {t.groups.map((g) => {
            const s = stdById.get(g.id);
            return (
              <div key={g.id} className="qf__grp">
                <span className="qf__gname">{g.label.replace(/^G\d+\s*/, "") || g.label}{!s && <button type="button" className="qf__gx" aria-label={`${g.label} 빼기`} disabled={readOnly} onClick={() => set((x) => ({ ...x, groups: x.groups.filter((y) => y.id !== g.id) }))}><X size={12} aria-hidden="true" /></button>}</span>
                <Stepper label={`${g.label} 암수 각`} value={g.m} was={s ? s.m : undefined} disabled={readOnly} onChange={(v) => setG(g.id, { m: v, f: v })} />
                <Stepper label={`${g.label} 회복군 암수 각`} value={g.rm} was={s ? s.rm : 0} disabled={readOnly} onChange={(v) => setG(g.id, { rm: v, rf: v })} />
                <input className="inp qf__dose qf__c3" aria-label={`${g.label} 용량`} value={g.dose} placeholder="mg/kg" disabled={readOnly} onChange={(e) => setG(g.id, { dose: e.target.value.slice(0, 40) })} />
              </div>
            );
          })}
          <span className="qf__help tnum">
            {total0 !== total1 ? `동물 ${total0}마리에서 ${total1}마리로 ${total1 > total0 ? "늘었어요" : "줄었어요"}` : `동물 ${total1}마리, 표준 그대로예요`}
            {recoveryAnimals(t.groups) !== recStd ? ` (회복군 ${recoveryAnimals(t.groups)}마리)` : ""}.
          </span>
          {!readOnly && (
            <button type="button" className="qf__lk qf__self" onClick={() => {
              const per = t.std.groups[0]?.m ?? t.groups[t.groups.length - 1]?.m ?? 0;
              set((x) => ({ ...x, groups: [...x.groups, { id: uid("g"), label: `G${x.groups.length + 1} 시험군`, dose: "", m: per, f: per, rm: 0, rf: 0 }] }));
            }}><Plus size={14} aria-hidden="true" /> 투여군 추가</button>
          )}
        </div>
      )}

      {tab === "cond" && (
        <div className="qf__grid2">
          <CondField label="동물종" value={t.cond.species} was={t.std.choices ? undefined : t.std.cond.species} opts={ch?.species} disabled={readOnly} onChange={(v) => (ch && ch.species.length > 1 ? set((x) => switchCond(x, { species: v })) : set((x) => ({ ...x, cond: { ...x.cond, species: v } })))} />
          <CondField label="투여경로" value={t.cond.route} was={t.std.choices ? undefined : t.std.cond.route} opts={ch?.routes} disabled={readOnly} onChange={(v) => (ch && ch.routes.length > 1 ? set((x) => switchCond(x, { route: v })) : set((x) => ({ ...x, cond: { ...x.cond, route: v } })))} />
          <CondField label="투여 기간" value={t.cond.dosing} was={t.std.cond.dosing} disabled={readOnly} onChange={(v) => set((x) => ({ ...x, cond: { ...x.cond, dosing: v } }))} />
          <CondField label="회복 기간" value={t.cond.recovery} was={t.std.cond.recovery} disabled={readOnly} onChange={(v) => set((x) => ({ ...x, cond: { ...x.cond, recovery: v } }))} />
          <CondField label="GLP" value={t.cond.glp} was={t.std.cond.glp} opts={["GLP", "Non-GLP"]} disabled={readOnly} onChange={(v) => set((x) => ({ ...x, cond: { ...x.cond, glp: v } }))} />
          <CondField label="시험 기준" value={t.cond.guideline} was={t.std.cond.guideline} disabled={readOnly} onChange={(v) => set((x) => ({ ...x, cond: { ...x.cond, guideline: v } }))} />
          {ch && t.std.price == null && <p className="qf__warn qf__span">시험 목록에 {[t.cond.species, t.cond.route].join(" · ")} 조건의 표준가가 없어요. <Link href={`/cro/catalog?item=${encodeURIComponent(t.itemKey)}`}>표준가 정하기</Link></p>}
          {ch && <p className="qf__help qf__span">동물종·투여경로를 바꾸면 시험 목록의 그 조건 표준가와 동물종 단가로 다시 계산해요.</p>}
        </div>
      )}

      {tab === "evals" && (
        <>
          {extraEvals.length > 0 && (
            <div className="qf__q">
              <span className="qf__lab">평가항목 추가</span>
              <div className="chips">
                {t.evals.map((e, k) => e.base ? null : (
                  <button key={`${e.name}-${k}`} type="button" className="chip" aria-pressed={e.on} disabled={readOnly} onClick={() => set((x) => ({ ...x, evals: x.evals.map((y, j) => (j === k ? { ...y, on: !y.on } : y)) }))}>
                    {e.name}{(() => { const r = e.rateId ? t.rates.find((x) => x.id === e.rateId) : undefined; return r?.add ? <small className="tnum"> +{n(r.add)}</small> : null; })()}
                  </button>
                ))}
              </div>
            </div>
          )}
          {qty.map((r) => (
            <div key={r.id} className="qf__q qf__qty">
              <span className="qf__lab">{r.shown}</span>
              <Stepper label={`${r.shown} 수량`} value={t.qty[r.id] ?? 0} was={0} min={-99} disabled={readOnly} unit={r.unit} onChange={(v) => set((x) => ({ ...x, qty: { ...x.qty, [r.id]: v } }))} />
            </div>
          ))}
        </>
      )}
    </>
  );
}

function CondField({ label, value, was, opts, disabled, onChange }: { label: string; value: string; was?: string; opts?: string[]; disabled: boolean; onChange: (v: string) => void }) {
  const changed = was !== undefined && was !== value;
  const id = `qf-c-${label}`;
  return (
    <div className="qf__q">
      <label className="qf__lab" htmlFor={id}>{label}{changed && <s className="qf__was">{was || "없음"}</s>}</label>
      {opts && opts.length > 1 ? (
        <select id={id} className={`inp qf__sel${changed ? " is-ch" : ""}`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {(opts.includes(value) ? opts : [value, ...opts]).map((o) => <option key={o} value={o}>{o || "없음"}</option>)}
        </select>
      ) : (
        <input id={id} className={`inp${changed ? " is-ch" : ""}`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value.slice(0, 160))} />
      )}
    </div>
  );
}

function Stepper({ label, value, was, onChange, disabled, min = 0, unit }: { label: string; value: number; was?: number; onChange: (v: number) => void; disabled: boolean; min?: number; unit?: string }) {
  const changed = was !== undefined && was !== value;
  return (
    <span className={`qf__step${changed ? " is-ch" : ""}`} role="group" aria-label={label}>
      <button type="button" aria-label="줄이기" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}><Minus size={14} aria-hidden="true" /></button>
      <span className="tnum">{changed && <s>{was}</s>}{value}{unit ? <small> {unit}</small> : null}</span>
      <button type="button" aria-label="늘리기" disabled={disabled || value >= 999} onClick={() => onChange(value + 1)}><Plus size={14} aria-hidden="true" /></button>
    </span>
  );
}

/* ── 5. 거래 조건 ── */
function TermsQ({ head, data, setH, setDoc, readOnly }: { head: DocHead; data: DocData; setH: (p: Partial<DocHead>) => void; setDoc: (p: Partial<DocData>) => void; readOnly: boolean }) {
  const presets: [string, number][] = [["2주", 14], ["30일", 30], ["60일", 60]];
  const days = head.validUntil ? Math.round((Date.parse(head.validUntil) - Date.parse(head.issuedOn)) / 864e5) : null;
  const custom = head.validUntil != null && !presets.some(([, d]) => d === days);
  const v = data.visible;
  return (
    <>
      <div className="qf__q">
        <span className="qf__lab" id="qf-valid">견적 유효기간</span>
        <div className="chips" role="group" aria-labelledby="qf-valid">
          {presets.map(([label, d]) => <button key={label} type="button" className="chip" aria-pressed={days === d} disabled={readOnly} onClick={() => setH({ validUntil: addDays(head.issuedOn, d) })}>{label}</button>)}
          <input type="date" className={`inp qf__date${custom ? " is-on" : ""}`} aria-label="유효기간 날짜 고르기" value={custom ? head.validUntil ?? "" : ""} min={head.issuedOn} disabled={readOnly} onChange={(e) => setH({ validUntil: e.target.value || null })} />
        </div>
        {head.validUntil && <span className="qf__help tnum">{head.validUntil}까지</span>}
      </div>
      <div className="qf__q">
        <label className="qf__lab" htmlFor="qf-pay">결제 조건</label>
        <input id="qf-pay" className="inp" value={data.terms.pay} maxLength={300} placeholder="예: 계약 시 50%, 최종 보고서 제출 시 50%" disabled={readOnly} onChange={(e) => setDoc({ terms: { ...data.terms, pay: e.target.value } })} />
      </div>
      <div className="qf__grid2">
        <div className="qf__q">
          <label className="qf__lab" htmlFor="qf-disc">할인</label>
          <div className="numin"><input id="qf-disc" type="text" inputMode="numeric" value={data.discount ? n(data.discount) : ""} placeholder="0" disabled={readOnly} onChange={(e) => setDoc({ discount: Number(digits(e.target.value) || 0) })} /><span>원</span></div>
        </div>
        <div className="qf__q">
          <label className="qf__lab" htmlFor="qf-extra">별도 비용</label>
          <input id="qf-extra" className="inp" value={data.terms.extra} maxLength={300} placeholder="예: 시험물질 분석 별도" disabled={readOnly} onChange={(e) => setDoc({ terms: { ...data.terms, extra: e.target.value } })} />
        </div>
      </div>
      <div className="qf__q">
        <span className="qf__lab" id="qf-vis">의뢰자에게 보일 것</span>
        <div className="chips" role="group" aria-labelledby="qf-vis">
          <button type="button" className="chip" aria-pressed={v.perTest} disabled={readOnly} onClick={() => setDoc({ visible: { ...v, perTest: !v.perTest } })}>시험별 금액</button>
          <button type="button" className="chip" aria-pressed={v.perTest && v.adjust} disabled={readOnly || !v.perTest} onClick={() => setDoc({ visible: { ...v, adjust: !v.adjust } })}>추가 비용 내역</button>
          <button type="button" className="chip" aria-pressed={v.perTest && v.adjust && v.formula} disabled={readOnly || !v.perTest || !v.adjust} onClick={() => setDoc({ visible: { ...v, formula: !v.formula } })}>단가와 계산식</button>
        </div>
      </div>
    </>
  );
}
