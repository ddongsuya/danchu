"use client";

/**
 * 효력시험 의뢰자 설계 반영 (0047 4단계, 시안 v15 "요청 반영" 보드).
 * 왼쪽: 의뢰자 설계 띠 → 표준에서 달라진 곳 → 군 구성(달라진 값 형광펜, 표준 값 옆에) → 평가항목 → 달라진 이유·확인할 것.
 * 오른쪽: 표준가에서 바뀐 사용량만 보이는 금액 장부. 금액은 견적서에 담은 단가 사본(t.prices)으로 계산한다.
 * 상태는 견적서 질문 화면(QuoteFill)이 갖고, 바꾼 값은 같은 자동 저장으로 간다.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import type { DocHead, DocTest } from "@/lib/quote-doc";
import type { PdDesign, PdEval, PdGroup, PdUse } from "@/lib/kind-design";
import { PRICE_UNIT_LABEL, type PriceItem, type PriceUnit } from "@/lib/price-book";
import { pdQuote, snapFor, snapWith } from "@/lib/pd-quote";
import { NIn, TIn, UseEdit, isNormal, nid } from "@/components/cro/catalog/ModelStandard";
import { ReportField, SampleCell, ScaleEditor, newScale } from "@/components/cro/catalog/PdEvalParts";
import "@/components/cro/catalog/model.css";

const won = (n: number) => n.toLocaleString("ko-KR");
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${won(Math.abs(n))}`;
const USAGE: Record<PriceUnit, string> = { head: "마리", head_day: "마리·일", cage_day: "케이지·일", head_time: "마리·회", head_hour: "마리·시간", sample_item: "검체·항목", sample_panel: "검체·패널", slide: "장", lot: "식", each: "개" };

type Book = { items: PriceItem[]; marginPct: number } | null;
type Props = {
  head: DocHead;
  t: DocTest;
  book: Book;
  readOnly: boolean;
  set: (p: Partial<DocTest> | ((t: DocTest) => DocTest)) => void;
  onNext: () => void;
  onPreview: () => void;
  nextLabel: string;
};

export function PdReflect({ head, t, book, readOnly, set, onNext, onPreview, nextLabel }: Props) {
  const std = t.std.kd!.pd!;
  const pd = t.kd!.pd!;
  const [all, setAll] = useState(false);
  const [openUse, setOpenUse] = useState<number | null>(null);

  // 사본이 없는 시험(질문 화면에서 새로 담은 시험)은 처음 열 때 지금 단가표로 사본을 만든다
  useEffect(() => {
    if (!t.prices && book && !readOnly) set((x) => ({ ...x, prices: snapFor(book, x.std.kd?.pd, x.kd?.pd) }));
  }, [t.prices, book, readOnly, set]);

  const q = useMemo(() => pdQuote(t), [t]);
  const items = useMemo(() => {
    const own = t.prices?.items ?? [];
    const more = (book?.items ?? []).filter((i) => !i.archived && !own.some((o) => o.id === i.id));
    return [...own, ...more];
  }, [t.prices, book]);

  const setPd = (f: (p: PdDesign) => PdDesign) => set((x) => ({ ...x, kd: { ...x.kd, pd: f(x.kd!.pd!) } }));
  const setGroup = (id: string, p: Partial<PdGroup>) => setPd((x) => ({ ...x, groups: x.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) }));
  const setEval = (id: string, p: Partial<PdEval>) => setPd((x) => ({ ...x, evals: (x.evals ?? []).map((e) => (e.id === id ? { ...e, ...p } : e)) }));
  const setUse = (i: number, p: Partial<PdUse>) => set((x) => {
    const pick = p.itemId ? book?.items.find((b) => b.id === p.itemId) : undefined;
    return { ...x, prices: x.prices ? snapWith(x.prices, pick) : x.prices, kd: { ...x.kd, pd: { ...x.kd!.pd!, uses: (x.kd!.pd!.uses ?? []).map((u, j) => (j === i ? { ...u, ...p } : u)) } } };
  });
  const addUse = () => {
    const first = items[0];
    if (!first) return;
    set((x) => ({ ...x, prices: x.prices ? snapWith(x.prices, first) : x.prices, kd: { ...x.kd, pd: { ...x.kd!.pd!, uses: [...(x.kd!.pd!.uses ?? []), { itemId: first.id, who: first.unit === "lot" || first.unit === "each" ? "none" : "all", times: 1, per: 1 }] } } }));
    setOpenUse(pd.uses?.length ?? 0);
    setAll(true);
  };

  const stdById = new Map(std.groups.map((g) => [g.id, g]));
  const animals = pd.groups.reduce((a, g) => a + (g.n || 0), 0);
  const stdAnimals = std.groups.reduce((a, g) => a + (g.n || 0), 0);
  const stdEvals = new Set((std.evals ?? []).filter((e) => !e.optional).map((e) => e.item.trim()));
  const orig = t.orig?.lines ?? [];
  const asks = (t.asks ?? []).join("\n");
  const uses = pd.uses ?? [];
  const missing = q ? q.cur.missing : 0;

  return (
    <div className="ms rf">
      <header className="ms__head">
        <div>
          <p className="ms__crumb">
            {head.rfqNo ? <><Link href="/cro/requests">받은 요청</Link> / <span className="ms__num">{head.rfqNo}</span></> : <><Link href="/cro/docs">견적서</Link> / <span className="ms__num">{head.docNo}</span></>} / 견적 작성
          </p>
          <h1 className="rf__h1">{pd.model || t.title}, {orig.length ? "의뢰자 설계 반영" : "이번 견적 설계"}</h1>
        </div>
        <div className="rf__acts">
          <button type="button" className="b2" disabled={readOnly} onClick={() => { set((x) => ({ ...x, kd: { ...x.kd, pd: structuredClone(std) } })); setOpenUse(null); }}>표준으로 되돌리기</button>
          <button type="button" className="b2" onClick={onPreview}>견적서 미리보기</button>
        </div>
      </header>

      {orig.length > 0 && (
        <section className="rf__orig" aria-labelledby="rf-orig">
          <div className="ms__sec"><h2 id="rf-orig">의뢰자 설계</h2></div>
          <dl className="rf__band">
            {orig.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>
      )}

      <div className="ms__grid">
        <div className="ms__main">
          <section aria-labelledby="rf-diff">
            <div className="ms__sec"><h2 id="rf-diff">표준에서 달라진 곳</h2><span className="ms__mut">{q?.changes.length ? `${q.changes.length}곳` : ""}</span></div>
            {q?.changes.length ? (
              <div className="ms__tw">
                <table className="ms__t rf__dt">
                  <thead><tr><th scope="col">항목</th><th scope="col">기관 표준</th><th scope="col">이번 견적</th><th scope="col" className="r">금액 영향</th></tr></thead>
                  <tbody>
                    {q.changes.map((c) => (
                      <tr key={c.item}>
                        <td>{c.item}</td>
                        <td className="ms__mut rf__b">{c.before}</td>
                        <td className="rf__a"><mark>{c.after}</mark></td>
                        {c.span > 0 && <td className="r ms__num rf__amt" rowSpan={c.span}>{c.amount != null ? signed(c.amount) : ""}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="ms__empty">기관 표준과 같음</div>
            )}
          </section>

          <section aria-labelledby="rf-groups">
            <div className="ms__sec">
              <h2 id="rf-groups">군 구성</h2>
              <span className="ms__secr">
                <span className="ms__mut ms__num">{pd.groups.length}군 · {animals}마리{stdAnimals !== animals ? `  표준 ${stdAnimals}` : ""}</span>
                {!readOnly && <button type="button" className="b2 bsm" onClick={() => setPd((p) => ({ ...p, groups: [...p.groups, { id: nid("g"), label: "시험물질군", role: "test", treat: "시험물질", n: p.groups.at(-1)?.n ?? 0, dose: "", induce: p.groups.find((g) => g.role !== "normal")?.induce ?? "" }] }))}>군 추가</button>}
              </span>
            </div>
            <div className="ms__tw">
              <table className="ms__t rf__gt">
                <thead><tr><th scope="col">군</th><th scope="col">이름</th><th scope="col">유발</th><th scope="col">처치</th><th scope="col">용량</th><th scope="col" className="r">마리</th><th scope="col"><span className="sr-only">빼기</span></th></tr></thead>
                <tbody>
                  {pd.groups.map((g, i) => {
                    const s = stdById.get(g.id);
                    return (
                      <tr key={g.id} data-new={s ? undefined : "1"}>
                        <td className="ms__num">G{i + 1}</td>
                        <td><TIn label={`G${i + 1} 이름`} value={g.label} max={40} onChange={(v) => setGroup(g.id, { label: v })} disabled={readOnly} /></td>
                        <td><TIn label={`G${i + 1} 유발`} value={g.induce ?? (g.role === "normal" ? "없음" : "")} max={40} onChange={(v) => setGroup(g.id, { induce: v, role: isNormal(v) ? "normal" : g.role === "normal" ? "test" : g.role })} disabled={readOnly} /></td>
                        <td><TIn label={`G${i + 1} 처치`} value={g.treat} max={80} onChange={(v) => setGroup(g.id, { treat: v })} disabled={readOnly} /></td>
                        <td><TIn label={`G${i + 1} 용량`} value={g.dose} max={40} placeholder="-" muted={!g.dose || g.dose === s?.dose} onChange={(v) => setGroup(g.id, { dose: v })} disabled={readOnly} /></td>
                        <td className="r">
                          <span className="rf__n" data-on={s && s.n !== g.n ? "1" : undefined}>
                            <NIn label={`G${i + 1} 마리`} value={g.n} max={200} onChange={(v) => setGroup(g.id, { n: v })} disabled={readOnly} />
                            {s ? s.n !== g.n && <span className="ms__mut ms__num">{s.n}</span> : <span className="ms__mut">새 군</span>}
                          </span>
                        </td>
                        <td className="ms__xc">{!readOnly && <button type="button" className="btxt ms__x" aria-label={`G${i + 1} 빼기`} onClick={() => setPd((p) => ({ ...p, groups: p.groups.filter((x) => x.id !== g.id) }))}><X size={14} aria-hidden="true" /></button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="rf-evals">
            <div className="ms__sec">
              <h2 id="rf-evals">평가항목</h2>
              {!readOnly && <button type="button" className="b2 bsm" onClick={() => setPd((p) => ({ ...p, evals: [...(p.evals ?? []), { id: nid("e"), item: "평가항목", when: "", freq: "", method: "", target: "전 군" }] }))}>평가항목 추가</button>}
            </div>
            {(pd.evals ?? []).length ? (
              <div className="ms__tw">
                <table className="ms__t ms__et">
                  <thead><tr><th scope="col">항목</th><th scope="col">시점</th><th scope="col">빈도</th><th scope="col">방법</th><th scope="col" className="r">검체</th><th scope="col"><span className="sr-only">선택 항목, 기준표, 빼기</span></th></tr></thead>
                  <tbody>
                    {(pd.evals ?? []).map((e) => (
                      <tr key={e.id} data-opt={e.optional ? "1" : undefined} data-new={!e.optional && !stdEvals.has(e.item.trim()) ? "1" : undefined}>
                        <td className="ms__item"><TIn label="항목" value={e.item} max={60} onChange={(v) => setEval(e.id, { item: v })} disabled={readOnly} /></td>
                        <td><TIn label={`${e.item} 시점`} value={e.when} max={40} placeholder="D10" mono onChange={(v) => setEval(e.id, { when: v })} disabled={readOnly} /></td>
                        <td><TIn label={`${e.item} 빈도`} value={e.freq} max={40} placeholder="1회" onChange={(v) => setEval(e.id, { freq: v })} disabled={readOnly} /></td>
                        <td className="ms__wide"><TIn label={`${e.item} 방법`} value={e.method} max={160} onChange={(v) => setEval(e.id, { method: v })} disabled={readOnly} /></td>
                        <td className="r"><SampleCell pd={pd} e={e} items={items} onChange={(use) => setEval(e.id, { use })} disabled={readOnly} /></td>
                        <td className="ms__xc">
                          {!readOnly && (
                            <span className="ms__ea">
                              <button type="button" className="ms__opt" aria-pressed={!!e.optional} onClick={() => setEval(e.id, { optional: !e.optional })}>선택</button>
                              <button type="button" className="ms__opt" aria-pressed={!!e.scale} onClick={() => setEval(e.id, { scale: e.scale ? undefined : newScale() })}>기준표</button>
                              <button type="button" className="btxt ms__x" aria-label={`${e.item} 빼기`} onClick={() => setPd((p) => ({ ...p, evals: (p.evals ?? []).filter((x) => x.id !== e.id) }))}><X size={14} aria-hidden="true" /></button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="ms__empty">평가항목 없음</div>
            )}
            {(pd.evals ?? []).filter((e) => e.scale).map((e) => <ScaleEditor key={e.id} e={e} onChange={(scale) => setEval(e.id, { scale })} disabled={readOnly} />)}
          </section>

          <ReportField value={pd.report ?? ""} onChange={(v) => setPd((p) => ({ ...p, report: v }))} disabled={readOnly} />

          <div className="rf__notes">
            <label className="fld">
              <span className="rf__lab">달라진 이유</span>
              <textarea className="inp rf__ta" maxLength={1000} value={t.why ?? ""} disabled={readOnly} onChange={(e) => set({ why: e.target.value })} />
            </label>
            <label className="fld">
              <span className="rf__lab">의뢰자에게 확인할 것</span>
              <textarea className="inp rf__ta" maxLength={2000} value={asks} disabled={readOnly} onChange={(e) => set({ asks: e.target.value.split("\n").slice(0, 10) })} />
            </label>
          </div>
        </div>

        <aside className="ms__led" aria-labelledby="rf-led">
          <div className="ms__lh">
            <span id="rf-led">금액</span>
            <button type="button" className="btxt rf__all" aria-pressed={all} onClick={() => { setAll((v) => !v); setOpenUse(null); }}>{all ? "모든 항목" : "바뀐 사용량만"}</button>
          </div>
          {!q ? (
            <p className="ms__mut">단가표가 비어 있어요. <Link href="/cro/prices">단가표</Link>에 단가를 넣으면 계산돼요.</p>
          ) : (
            <table className="ms__lt">
              <tbody>
                <tr><td className="ms__mut">표준가</td><td className="r ms__num ms__mut">{won(q.std.total)}</td></tr>
                {all
                  ? q.cur.lines.map((l, i) => (
                    <tr key={`${l.itemId}-${i}`} data-missing={l.missing ? "1" : undefined}>
                      <td colSpan={2}>
                        <LedgerBtn name={l.name} sub={l.missing ? "단가표에 없음" : l.formula} amount={l.missing ? "-" : won(l.amount)} open={openUse === i} disabled={readOnly} onClick={() => setOpenUse(openUse === i ? null : i)} />
                        {openUse === i && !readOnly && uses[i] && <UseEdit use={uses[i]} items={items} onChange={(p) => setUse(i, p)} onRemove={() => { setPd((p) => ({ ...p, uses: (p.uses ?? []).filter((_, j) => j !== i) })); setOpenUse(null); }} />}
                      </td>
                    </tr>
                  ))
                  : q.diff.lines.map((l) => {
                    const i = uses.findIndex((u) => u.itemId === l.itemId);
                    return (
                      <tr key={l.itemId} data-new={l.usageBefore === 0 ? "1" : undefined}>
                        <td colSpan={2}>
                          <LedgerBtn name={l.name} sub={`${won(l.usageBefore)} → ${won(l.usageAfter)} ${USAGE[l.unit] ?? PRICE_UNIT_LABEL[l.unit]}`} amount={signed(Math.round(l.delta))} open={openUse === i} disabled={readOnly || i < 0} onClick={() => setOpenUse(openUse === i ? null : i)} />
                          {openUse === i && i >= 0 && !readOnly && <UseEdit use={uses[i]} items={items} onChange={(p) => setUse(i, p)} onRemove={() => { setPd((p) => ({ ...p, uses: (p.uses ?? []).filter((_, j) => j !== i) })); setOpenUse(null); }} />}
                        </td>
                      </tr>
                    );
                  })}
                {!readOnly && items.length > 0 && (
                  <tr><td colSpan={2}><button type="button" className="btxt ms__addu" onClick={addUse}><Plus size={14} aria-hidden="true" />단가 항목</button></td></tr>
                )}
                <tr>
                  <td>단가 합계<span className="ms__f">{won(q.std.sum)} → {won(q.cur.sum)}</span></td>
                  <td className="r ms__num">{signed(q.diff.sumDelta)}</td>
                </tr>
                <tr><td>관리비·이익 {q.cur.marginPct}%</td><td className="r ms__num">{signed(q.diff.marginDelta)}</td></tr>
              </tbody>
            </table>
          )}
          <div className="ms__total">
            <span>견적 금액</span>
            <span className="ms__num">{q && !missing ? won(q.cur.total) : "-"}</span>
          </div>
          {missing > 0 && <p className="fld__err">단가표에 없는 항목 {missing}개. 견적 금액을 비워 둬요.</p>}
          {q && <p className="ms__mut">표준가 대비 {signed(q.diff.totalDelta)} · 부가세 별도</p>}
          <button type="button" className="b1 ms__save" onClick={onNext}>{nextLabel}</button>
        </aside>
      </div>
    </div>
  );
}

function LedgerBtn({ name, sub, amount, open, disabled, onClick }: { name: string; sub: string; amount: string; open: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="ms__lb" aria-expanded={open} onClick={onClick} disabled={disabled}>
      <span>{name}<span className="ms__f">{sub}</span></span>
      <span className="ms__num">{amount}</span>
    </button>
  );
}
