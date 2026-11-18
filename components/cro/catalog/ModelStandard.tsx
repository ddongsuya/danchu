"use client";

/**
 * 효력 모델 표준 설계 (0047, 시안 v15 "모델 표준" 보드).
 * 왼쪽: 머리 요약 → 시험 스키마(일 단위) → 군 구성 → 평가항목. 오른쪽: 단가표로 계산한 표준가 장부.
 * 금액은 화면에서 미리 보여 주기만 하고, 저장할 때 서버가 단가표로 다시 계산한다 (lib/catalog-db priceFromBook).
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import type { CatalogRow } from "@/lib/catalog";
import type { DayLane, PdDesign, PdEval, PdGroup, PdUse } from "@/lib/kind-design";
import { PRICE_CATS, PRICE_CAT_LABEL, PRICE_UNIT_LABEL, type PriceItem, type PriceUnit } from "@/lib/price-book";
import { pdPrice } from "@/lib/pd-price";
import type { PriceBook } from "@/lib/price-book-db";

const won = (n: number) => n.toLocaleString("ko-KR");
let seq = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}${(++seq).toString(36)}`;
const dLabel = (d: number) => `D${d}`;
const isNormal = (induce: string) => !induce.trim() || induce.trim() === "없음";

/** 횟수 칸을 묻는 단위, 곱(검체당 항목 수 등)을 묻는 단위 */
const TIMES_UNITS: PriceUnit[] = ["head_day", "cage_day", "head_time", "head_hour", "lot", "each"];
const PER_UNITS: PriceUnit[] = ["sample_item", "sample_panel", "slide"];
const WHO_LABEL: Record<PdUse["who"], string> = { all: "전 군", induced: "유발군", dosed: "투여군", none: "동물 무관" };

type Other = { id: string; name: string; pd: PdDesign };
type Props = { row: CatalogRow; siblings: CatalogRow[]; others: Other[]; book: PriceBook; readOnly?: boolean; /** 검토 화면용: 서버에 보내지 않는다 */ local?: boolean };

export function ModelStandard({ row: initialRow, siblings, others, book, readOnly = false, local = false }: Props) {
  const [row, setRow] = useState<CatalogRow>(initialRow);
  const [pd, setPdRaw] = useState<PdDesign>(() => structuredClone(initialRow.kd!.pd!));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editSchema, setEditSchema] = useState(false);
  const [openUse, setOpenUse] = useState<number | null>(null);

  const setPd = (f: (p: PdDesign) => PdDesign) => {
    setPdRaw((p) => f(p));
    setDirty(true);
    setNote(null);
  };
  const days = pd.days ?? [];
  const evals = pd.evals ?? [];
  const uses = useMemo(() => pd.uses ?? [], [pd.uses]);
  const brief = pd.brief ?? { animal: "", dosing: "", period: "" };

  const price = useMemo(() => pdPrice(pd.groups.map((g) => ({ id: g.id, role: g.role, n: g.n })), uses, book.items, book.marginPct), [pd.groups, uses, book]);
  const animals = pd.groups.reduce((a, g) => a + (g.n || 0), 0);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const next: CatalogRow = { ...row, method: pd.model || row.method, kd: { ...row.kd, pd } };
      if (local) {
        setRow(next);
        setDirty(false);
        setNote("표준으로 저장했어요.");
        return;
      }
      const send = siblings.map((r) => (r.id === row.id ? next : r));
      const res = await fetch("/api/cro/catalog", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: send }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      const saved = (j.rows as CatalogRow[] | undefined)?.find((r) => r.id === row.id);
      if (saved) setRow(saved);
      setDirty(false);
      setNote("표준으로 저장했어요.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function copyFrom(id: string) {
    const o = others.find((x) => x.id === id);
    if (!o) return;
    setPd((p) => ({ ...structuredClone(o.pd), model: p.model || o.pd.model, costs: p.costs, perGroup: p.perGroup, perAnimal: p.perAnimal }));
    setNote(`${o.name} 설계를 가져왔어요. 저장 전이에요.`);
  }

  const setGroup = (id: string, p: Partial<PdGroup>) => setPd((x) => ({ ...x, groups: x.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) }));
  const setEval = (id: string, p: Partial<PdEval>) => setPd((x) => ({ ...x, evals: (x.evals ?? []).map((e) => (e.id === id ? { ...e, ...p } : e)) }));
  const setLane = (id: string, p: Partial<DayLane>) => setPd((x) => ({ ...x, days: (x.days ?? []).map((l) => (l.id === id ? { ...l, ...p } : l)) }));
  const setUse = (i: number, p: Partial<PdUse>) => setPd((x) => ({ ...x, uses: (x.uses ?? []).map((u, j) => (j === i ? { ...u, ...p } : u)) }));

  return (
    <div className="ms">
      <header className="ms__head">
        <div>
          <span className="ms__crumb"><Link href="/cro/catalog">시험 목록</Link> / {row.category} / {row.item}</span>
          <div className="ms__title">
            <h1>
              <input className="ms__h1" aria-label="모델 이름" value={pd.model} placeholder={row.item} onChange={(e) => setPd((p) => ({ ...p, model: e.target.value.slice(0, 120) }))} disabled={readOnly} />
            </h1>
            <span className="ms__chip">표준 설계</span>
          </div>
        </div>
        {others.length > 0 && (
          <span className="selwrap ms__copy">
            <select className="b2" aria-label="다른 모델 복사해 만들기" value="" onChange={(e) => e.target.value && copyFrom(e.target.value)} disabled={readOnly}>
              <option value="">다른 모델 복사해 만들기</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </span>
        )}
      </header>

      <div className="ms__grid">
        <div className="ms__main">
          <div className="ms__brief">
            <Cell label="동물" value={brief.animal} onChange={(v) => setPd((p) => ({ ...p, brief: { ...brief, animal: v } }))} hint="C57BL/6 마우스, 수컷 8주령" disabled={readOnly} />
            <Cell label="유발" value={pd.induction} onChange={(v) => setPd((p) => ({ ...p, induction: v }))} hint="DSS 3%, 음수 7일" disabled={readOnly} />
            <Cell label="투여" value={brief.dosing} onChange={(v) => setPd((p) => ({ ...p, brief: { ...brief, dosing: v } }))} hint="경구, 1일 1회, 10일" disabled={readOnly} />
            <Cell label="기간" value={brief.period} onChange={(v) => setPd((p) => ({ ...p, brief: { ...brief, period: v } }))} hint="순화 7일 + 시험 11일" disabled={readOnly} />
          </div>

          <section aria-labelledby="ms-schema">
            <div className="ms__sec">
              <h2 id="ms-schema">시험 스키마</h2>
              <span className="ms__secr">
                {days.length > 0 && <span className="ms__mut ms__num">{dLabel(Math.min(...days.map((l) => l.from)))}~{dLabel(Math.max(...days.map((l) => l.to)))}, {Math.max(...days.map((l) => l.to)) - Math.min(...days.map((l) => l.from)) + 1}일</span>}
                {!readOnly && <button type="button" className="b2 bsm" aria-expanded={editSchema} onClick={() => setEditSchema((v) => !v)}>{editSchema ? "고치기 닫기" : "스키마 고치기"}</button>}
              </span>
            </div>
            {days.length ? <Schema days={days} /> : <div className="ms__empty">단계 없음</div>}
            {editSchema && (
              <div className="ms__lanes">
                <div className="ms__lane ms__lhd" aria-hidden="true"><span>단계</span><span>시작</span><span>끝</span><span>표시</span><span /></div>
                {days.map((l) => (
                  <div key={l.id} className="ms__lane">
                    <input className="inp" aria-label="단계 이름" value={l.name} onChange={(e) => setLane(l.id, { name: e.target.value.slice(0, 40) })} />
                    <DayIn label={`${l.name} 시작일`} value={l.from} onChange={(v) => setLane(l.id, { from: v, to: Math.max(v, l.to) })} />
                    <DayIn label={`${l.name} 끝일`} value={l.to} onChange={(v) => setLane(l.id, { to: Math.max(v, l.from) })} />
                    <span className="selwrap">
                      <select className="sel" aria-label={`${l.name} 표시`} value={l.mark} onChange={(e) => setLane(l.id, { mark: e.target.value as DayLane["mark"] })}>
                        <option value="bar">기간</option>
                        <option value="dots">매일</option>
                        <option value="point">한 시점</option>
                      </select>
                    </span>
                    <button type="button" className="btxt ms__x" aria-label={`${l.name} 빼기`} onClick={() => setPd((p) => ({ ...p, days: (p.days ?? []).filter((x) => x.id !== l.id) }))}><X size={16} aria-hidden="true" /></button>
                  </div>
                ))}
                <button type="button" className="b2 bsm ms__add" onClick={() => setPd((p) => { const last = (p.days ?? []).at(-1); const from = last ? last.to + 1 : 0; return { ...p, days: [...(p.days ?? []), { id: nid("d"), name: "단계", from, to: from, mark: "bar" }] }; })}><Plus size={14} aria-hidden="true" />단계 추가</button>
              </div>
            )}
          </section>

          <section aria-labelledby="ms-groups">
            <div className="ms__sec">
              <h2 id="ms-groups">군 구성</h2>
              <span className="ms__secr">
                <span className="ms__mut">{pd.groups.length}군, {animals}마리</span>
                {!readOnly && <button type="button" className="b2 bsm" onClick={() => setPd((p) => ({ ...p, groups: [...p.groups, { id: nid("g"), label: "시험물질군", role: "test", treat: "시험물질", n: p.groups.at(-1)?.n ?? 0, dose: "의뢰자 지정", induce: p.groups.find((g) => g.role !== "normal")?.induce ?? "" }] }))}>군 추가</button>}
              </span>
            </div>
            <div className="ms__tw">
              <table className="ms__t">
                <thead><tr><th scope="col">군</th><th scope="col">이름</th><th scope="col">유발</th><th scope="col">처치</th><th scope="col">용량</th><th scope="col" className="r">마리</th><th scope="col"><span className="sr-only">빼기</span></th></tr></thead>
                <tbody>
                  {pd.groups.map((g, i) => (
                    <tr key={g.id}>
                      <td className="ms__num">G{i + 1}</td>
                      <td><TIn label={`G${i + 1} 이름`} value={g.label} max={40} onChange={(v) => setGroup(g.id, { label: v })} disabled={readOnly} /></td>
                      <td><TIn label={`G${i + 1} 유발`} value={g.induce ?? (g.role === "normal" ? "없음" : "")} max={40} onChange={(v) => setGroup(g.id, { induce: v, role: isNormal(v) ? "normal" : g.role === "normal" ? "test" : g.role })} disabled={readOnly} /></td>
                      <td><TIn label={`G${i + 1} 처치`} value={g.treat} max={80} onChange={(v) => setGroup(g.id, { treat: v })} disabled={readOnly} /></td>
                      <td><TIn label={`G${i + 1} 용량`} value={g.dose} max={40} placeholder="-" muted onChange={(v) => setGroup(g.id, { dose: v })} disabled={readOnly} /></td>
                      <td className="r"><NIn label={`G${i + 1} 마리`} value={g.n} max={200} onChange={(v) => setGroup(g.id, { n: v })} disabled={readOnly} /></td>
                      <td className="ms__xc">{!readOnly && <button type="button" className="btxt ms__x" aria-label={`G${i + 1} 빼기`} onClick={() => setPd((p) => ({ ...p, groups: p.groups.filter((x) => x.id !== g.id) }))}><X size={14} aria-hidden="true" /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="ms-evals">
            <div className="ms__sec">
              <h2 id="ms-evals">평가항목</h2>
              {!readOnly && <button type="button" className="b2 bsm" onClick={() => setPd((p) => ({ ...p, evals: [...(p.evals ?? []), { id: nid("e"), item: "평가항목", when: "", freq: "", method: "", target: "전 군" }] }))}>평가항목 추가</button>}
            </div>
            {evals.length ? (
              <div className="ms__tw">
                <table className="ms__t">
                  <thead><tr><th scope="col">항목</th><th scope="col">시점</th><th scope="col">빈도</th><th scope="col">방법</th><th scope="col">대상</th><th scope="col"><span className="sr-only">선택 항목, 빼기</span></th></tr></thead>
                  <tbody>
                    {evals.map((e) => (
                      <tr key={e.id} data-opt={e.optional ? "1" : undefined}>
                        <td className="ms__item"><TIn label="항목" value={e.item} max={60} onChange={(v) => setEval(e.id, { item: v })} disabled={readOnly} /></td>
                        <td><TIn label={`${e.item} 시점`} value={e.when} max={40} placeholder="D10" mono onChange={(v) => setEval(e.id, { when: v })} disabled={readOnly} /></td>
                        <td><TIn label={`${e.item} 빈도`} value={e.freq} max={40} placeholder="1회" onChange={(v) => setEval(e.id, { freq: v })} disabled={readOnly} /></td>
                        <td className="ms__wide"><TIn label={`${e.item} 방법`} value={e.method} max={160} onChange={(v) => setEval(e.id, { method: v })} disabled={readOnly} /></td>
                        <td><TIn label={`${e.item} 대상`} value={e.optional ? "선택 항목" : e.target} max={40} onChange={(v) => setEval(e.id, { target: v })} disabled={readOnly || !!e.optional} /></td>
                        <td className="ms__xc">
                          {!readOnly && (
                            <span className="ms__ea">
                              <button type="button" className="ms__opt" aria-pressed={!!e.optional} onClick={() => setEval(e.id, { optional: !e.optional })}>선택</button>
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
          </section>
        </div>

        <aside className="ms__led" aria-labelledby="ms-led">
          <div className="ms__lh"><span id="ms-led">표준가 계산</span><span className="ms__mut"><Link href="/cro/prices">단가표</Link> 기준</span></div>
          {book.items.length === 0 ? (
            <p className="ms__mut">단가표가 비어 있어요. <Link href="/cro/prices">단가표</Link>에 단가를 넣으면 계산돼요.</p>
          ) : (
            <table className="ms__lt">
              <tbody>
                {price.lines.map((l, i) => (
                  <tr key={`${l.itemId}-${i}`} data-missing={l.missing ? "1" : undefined}>
                    <td colSpan={2}>
                      <button type="button" className="ms__lb" aria-expanded={openUse === i} onClick={() => setOpenUse(openUse === i ? null : i)} disabled={readOnly}>
                        <span>
                          {l.name}
                          <span className="ms__f">{l.missing ? "단가표에 없음" : l.formula}</span>
                        </span>
                        <span className="ms__num">{l.missing ? "-" : won(l.amount)}</span>
                      </button>
                      {openUse === i && !readOnly && (
                        <UseEdit use={uses[i]} items={book.items} onChange={(p) => setUse(i, p)} onRemove={() => { setPd((p) => ({ ...p, uses: (p.uses ?? []).filter((_, j) => j !== i) })); setOpenUse(null); }} />
                      )}
                    </td>
                  </tr>
                ))}
                {!readOnly && (
                  <tr>
                    <td colSpan={2}>
                      <button type="button" className="btxt ms__addu" onClick={() => { setPd((p) => ({ ...p, uses: [...(p.uses ?? []), { itemId: book.items[0].id, who: book.items[0].unit === "lot" || book.items[0].unit === "each" ? "none" : "all", times: 1, per: 1 }] })); setOpenUse(uses.length); }}><Plus size={14} aria-hidden="true" />단가 항목</button>
                    </td>
                  </tr>
                )}
                <tr className="ms__lsum"><td>단가 합계</td><td className="r ms__num">{won(price.sum)}</td></tr>
                <tr><td>관리비·이익 {price.marginPct}%</td><td className="r ms__num">{won(price.margin)}</td></tr>
              </tbody>
            </table>
          )}
          <div className="ms__total">
            <span>표준가</span>
            <span className="ms__num">{price.lines.length && !price.missing ? won(price.total) : "-"}</span>
          </div>
          {price.missing > 0 && <p className="fld__err">단가표에 없는 항목 {price.missing}개. 표준가를 비워 둬요.</p>}
          <p className="ms__mut ms__weeks">
            착수부터 최종 보고서까지{" "}
            <input className="ms__wk ms__num" inputMode="numeric" aria-label="소요 기간(주)" value={row.weeks ?? ""} onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, "").slice(0, 3); setRow((r) => ({ ...r, weeks: v ? Math.min(200, Number(v)) : null })); setDirty(true); }} disabled={readOnly} />
            주, 부가세 별도
          </p>
          {err && <p className="fld__err" role="alert">{err}</p>}
          <p className="ms__note" aria-live="polite">{note}</p>
          <button type="button" className="b1 ms__save" onClick={() => void save()} disabled={readOnly || busy || !dirty} aria-busy={busy}>
            {busy ? "저장 중" : "표준으로 저장"}
          </button>
        </aside>
      </div>
    </div>
  );
}

function Cell({ label, value, onChange, hint, disabled }: { label: string; value: string; onChange: (v: string) => void; hint: string; disabled: boolean }) {
  return (
    <label className="ms__cell">
      <span className="ms__mut">{label}</span>
      <input className="ms__in" value={value} placeholder={hint} onChange={(e) => onChange(e.target.value.slice(0, 80))} disabled={disabled} />
    </label>
  );
}

function TIn({ label, value, onChange, max, placeholder, muted, mono, disabled }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string; muted?: boolean; mono?: boolean; disabled: boolean }) {
  return <input className={`ms__in${muted ? " ms__inm" : ""}${mono ? " ms__num" : ""}`} aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value.slice(0, max))} disabled={disabled} />;
}

function NIn({ label, value, onChange, max, disabled }: { label: string; value: number; onChange: (v: number) => void; max: number; disabled: boolean }) {
  return <input className="ms__in ms__num r" inputMode="numeric" aria-label={label} value={value ? String(value) : ""} placeholder="0" onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, "").slice(0, 3); onChange(v ? Math.min(max, Number(v)) : 0); }} disabled={disabled} />;
}

function DayIn({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [t, setT] = useState(String(value));
  return (
    <span className="ms__day">
      <span aria-hidden="true">D</span>
      <input
        className="inp ms__num"
        inputMode="numeric"
        aria-label={label}
        value={t}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "").slice(0, 4);
          setT(v);
          if (/^-?\d+$/.test(v)) onChange(Math.max(-60, Math.min(400, Number(v))));
        }}
        onBlur={() => setT(String(value))}
      />
    </span>
  );
}

/** 시험 스키마 그림: 이름 열 + 날짜 축. 기간은 막대, 매일은 점, 한 시점은 네모 */
function Schema({ days }: { days: DayLane[] }) {
  const min = Math.min(...days.map((l) => l.from));
  const max = Math.max(...days.map((l) => l.to));
  const span = max - min + 1;
  const x = (d: number) => ((d - min) / span) * 100;
  const w = (a: number, b: number) => ((b - a + 1) / span) * 100;
  const ticks = [...new Set([min, ...(min <= 0 && max >= 0 ? [0] : []), ...Array.from({ length: Math.floor(Math.max(0, max - 1) / 3) + 1 }, (_, i) => i * 3).filter((d) => d > 0 && d < max - 1 && d - min > 1), max])].sort((a, b) => a - b);
  let barN = 0;
  return (
    <figure className="ms__sch" aria-label={`시험 스키마 ${dLabel(min)}부터 ${dLabel(max)}까지`}>
      {days.map((l) => {
        const tone = l.mark === "bar" ? ["1", "2", "3"][Math.min(2, barN++)] : undefined;
        return (
          <div key={l.id} className="ms__row">
            <span className="ms__ln">{l.name}</span>
            <span className="ms__track">
              {l.mark === "bar" && <i className="ms__bar" data-tone={tone} style={{ left: `${x(l.from)}%`, width: `${w(l.from, l.to)}%` }} />}
              {l.mark === "dots" && Array.from({ length: l.to - l.from + 1 }, (_, k) => <b key={k} className="ms__dot" style={{ left: `${x(l.from + k) + w(0, 0) / 2}%` }} />)}
              {l.mark === "point" && <em className="ms__pt" style={{ left: `${x(l.from) + w(0, 0) / 2}%` }} />}
            </span>
          </div>
        );
      })}
      <div className="ms__row ms__axis" aria-hidden="true">
        <span />
        <span className="ms__track">
          {ticks.map((d) => <span key={d} className="ms__tick" style={{ left: `${x(d) + w(0, 0) / 2}%` }}>{dLabel(d)}</span>)}
        </span>
      </div>
    </figure>
  );
}

function UseEdit({ use, items, onChange, onRemove }: { use: PdUse; items: PriceItem[]; onChange: (p: Partial<PdUse>) => void; onRemove: () => void }) {
  const it = items.find((i) => i.id === use.itemId);
  const unit = it?.unit;
  return (
    <div className="ms__ue">
      <label className="fld">
        <span className="fld__lab">단가 항목</span>
        <span className="selwrap">
          <select
            className="sel"
            value={use.itemId}
            onChange={(e) => {
              const u = items.find((i) => i.id === e.target.value)?.unit;
              // 단위가 바뀌면 그 단위가 쓰지 않는 칸은 1로 (숨은 곱이 남지 않게)
              onChange({ itemId: e.target.value, ...(u && !TIMES_UNITS.includes(u) ? { times: 1 } : {}), ...(u && !PER_UNITS.includes(u) ? { per: 1 } : {}), ...(u === "lot" || u === "each" ? { who: "none" as const } : {}) });
            }}
          >
            {!it && <option value={use.itemId}>단가표에 없는 항목</option>}
            {PRICE_CATS.map((c) => {
              const xs = items.filter((i) => i.category === c);
              return xs.length ? (
                <optgroup key={c} label={PRICE_CAT_LABEL[c]}>
                  {xs.map((i) => <option key={i.id} value={i.id}>{i.name} ({PRICE_UNIT_LABEL[i.unit]} {won(i.price)})</option>)}
                </optgroup>
              ) : null;
            })}
          </select>
        </span>
      </label>
      <label className="fld">
        <span className="fld__lab">장부 이름</span>
        <input className="inp" value={use.label ?? ""} placeholder={it?.name ?? ""} maxLength={60} onChange={(e) => onChange({ label: e.target.value })} />
      </label>
      <div className="fld">
        <span className="fld__lab" id={`who-${use.itemId}`}>대상</span>
        <div className="seg" role="group" aria-labelledby={`who-${use.itemId}`}>
          {(Object.keys(WHO_LABEL) as PdUse["who"][]).map((k) => <button key={k} type="button" aria-pressed={use.who === k} onClick={() => onChange({ who: k })}>{WHO_LABEL[k]}</button>)}
        </div>
      </div>
      <div className="ms__ue2">
        {(!unit || TIMES_UNITS.includes(unit)) && (
          <label className="fld">
            <span className="fld__lab">{unit === "head_day" || unit === "cage_day" ? "일수" : unit === "head_hour" ? "시간" : unit === "lot" || unit === "each" ? "수량" : "횟수"}</span>
            <input className="inp ms__num" inputMode="decimal" value={String(use.times)} onChange={(e) => { const v = Number(e.target.value.replace(/[^\d.]/g, "")); onChange({ times: Number.isFinite(v) ? Math.min(100000, v) : 0 }); }} />
          </label>
        )}
        {unit && PER_UNITS.includes(unit) && (
          <label className="fld">
            <span className="fld__lab">{unit === "slide" ? "마리당 장 수" : "검체당 수"}</span>
            <input className="inp ms__num" inputMode="decimal" value={String(use.per)} onChange={(e) => { const v = Number(e.target.value.replace(/[^\d.]/g, "")); onChange({ per: Number.isFinite(v) && v > 0 ? Math.min(100000, v) : 1 }); }} />
          </label>
        )}
      </div>
      <button type="button" className="btxt ms__urm" onClick={onRemove}>이 줄 빼기</button>
    </div>
  );
}
