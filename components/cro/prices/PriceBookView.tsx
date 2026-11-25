"use client";

/**
 * 기관 단가표 화면 (0047, 시안 v15 "단가표 동물·투여·분자 분석" 보드). 효력시험 표준가 계산에 쓰고,
 * 기관이 켜면 독성시험 동물 단가에도 쓴다 (0051 apply_tox).
 * 왼쪽 분류 목록 → 가운데 그 분류 칸으로 추가·고치기 + 표 → 오른쪽 관리비·이익 %와 단가 바꾼 기록.
 * 가격은 기관이 넣는다. 고르는 목록(lib/price-lists.ts)에 없으면 직접 적는다.
 */
import { useMemo, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { CAT_FIELDS, PRICE_CATS, PRICE_CAT_LABEL, PRICE_UNIT_LABEL, type PriceCat, type PriceItem, type PriceUnit } from "@/lib/price-book";
import { PRICE_LISTS, type PickList } from "@/lib/price-lists";
import type { PriceBook, PriceLog } from "@/lib/price-book-db";

const won = (n: number) => n.toLocaleString("ko-KR");

/** 고르는 칸 중 드롭다운으로 여는 칸 (목록이 길거나 종별로 묶인 칸). 나머지는 버튼 줄 */
const SELECT_FIELDS = new Set(["animal.species", "animal.strain", "molecular.method", "molecular.matrix"]);
/** 숫자만 받는 칸과 붙는 말 */
const NUM_FIELDS: Record<string, string> = { "animal.weeks": "주", "pathology.organs": "개", "imaging.minutes": "분" };
const MEMO_HINT: Record<PriceCat, string> = {
  animal: "등급, 공급처 등", housing: "케이지당 마리 수 등", model: "시약, 유도 기간 등", dosing: "꼬리 정맥, 존데 등",
  observe: "측정 장비 등", molecular: "키트, 반복 수 등", pathology: "장기, 판독자 등", imaging: "장비 이름 등", report: "분량, 부수 등",
};

type Form = { id: string | null; attrs: Record<string, string>; own: Record<string, boolean>; unit: PriceUnit; price: string; memo: string };
const emptyForm = (cat: PriceCat): Form => ({ id: null, attrs: {}, own: {}, unit: CAT_FIELDS[cat].units[0], price: "", memo: "" });

function listOf(cat: PriceCat, key: string, attrs: Record<string, string>): PickList {
  const l = PRICE_LISTS[cat]?.[key] ?? [];
  // 계통은 고른 종의 묶음만
  if (cat === "animal" && key === "strain" && attrs.species) {
    const g = l.filter((x) => x.group === attrs.species);
    return g.length ? g : l;
  }
  return l;
}
const inPick = (l: PickList, v: string) => l.some((g) => g.values.includes(v));

/** 항목 이름: 분류 칸을 차례로 이어 붙인다 (같은 항목인지 보는 열쇠에도 쓰인다) */
function nameOf(cat: PriceCat, attrs: Record<string, string>): string {
  return CAT_FIELDS[cat].fields
    .map((f) => {
      const v = (attrs[f.key] ?? "").trim();
      const suf = NUM_FIELDS[`${cat}.${f.key}`];
      return v && suf ? `${v}${suf}` : v;
    })
    .filter(Boolean)
    .join(" ")
    .slice(0, 120);
}

const digits = (s: string) => s.replace(/[^\d]/g, "");

/** local: 검토 화면용. 서버에 보내지 않고 화면에서만 바꾼다 */
export function PriceBookView({ initial, readOnly = false, loadError = false, local = false }: { initial: PriceBook; readOnly?: boolean; loadError?: boolean; local?: boolean }) {
  const [items, setItems] = useState<PriceItem[]>(initial.items);
  const [log, setLog] = useState<PriceLog[]>(initial.log);
  const [margin, setMargin] = useState<number>(initial.marginPct);
  const [applyTox, setApplyTox] = useState<boolean>(!!initial.applyTox);
  const [cat, setCat] = useState<PriceCat>("animal");
  const [form, setForm] = useState<Form>(() => emptyForm("animal"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(loadError ? "단가표를 불러오지 못했어요. 새로고침해 주세요." : null);
  const [note, setNote] = useState<string | null>(null);
  /** 휴대폰에서만: 추가·고치기 칸을 전체 화면으로 연다 (넓은 화면은 늘 펼쳐 둔다) */
  const [sheet, setSheet] = useState(false);

  const counts = useMemo(() => {
    const c = Object.fromEntries(PRICE_CATS.map((k) => [k, 0])) as Record<PriceCat, number>;
    for (const i of items) c[i.category]++;
    return c;
  }, [items]);
  const rows = items.filter((i) => i.category === cat);
  const spec = CAT_FIELDS[cat];
  const multiUnit = spec.units.length > 1;

  function pickCat(c: PriceCat) {
    setCat(c);
    setForm(emptyForm(c));
    setSheet(false);
    setErr(null);
    setNote(null);
  }
  function edit(it: PriceItem) {
    const own: Record<string, boolean> = {};
    for (const f of spec.fields) {
      const v = it.attrs[f.key] ?? "";
      const l = listOf(cat, f.key, it.attrs);
      if (v && l.length && !inPick(l, v)) own[f.key] = true;
    }
    setForm({ id: it.id, attrs: { ...it.attrs }, own, unit: it.unit, price: won(it.price), memo: it.memo });
    setSheet(true);
    setErr(null);
    setNote(null);
  }
  const setAttr = (k: string, v: string) => setForm((f) => ({ ...f, attrs: { ...f.attrs, [k]: v } }));
  const setOwn = (k: string, on: boolean) => setForm((f) => ({ ...f, own: { ...f.own, [k]: on }, attrs: { ...f.attrs, [k]: "" } }));

  async function call(method: string, url: string, body: unknown) {
    if (local) return localCall(method, body as Record<string, unknown>);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    return j;
  }
  function localCall(method: string, b: Record<string, unknown>) {
    const now = new Date().toISOString();
    const cur = items.find((x) => x.id === b.id);
    const it = { ...(cur ?? { sort: 0, archived: false }), ...b, id: cur?.id ?? `local-${Date.now()}` } as PriceItem;
    const entry = (before: number | null, after: number | null): PriceLog => ({ id: Date.now(), item_name: cur?.name ?? it.name, before, after, via: "web", changed_at: now });
    if (method === "DELETE" && cur) setLog((l) => [entry(cur.price, null), ...l]);
    else if (method === "POST") setLog((l) => [entry(null, it.price), ...l]);
    else if (cur && cur.price !== it.price) setLog((l) => [entry(cur.price, it.price), ...l]);
    return { item: it, ok: true };
  }
  async function refreshLog() {
    if (local) return;
    try {
      const r = await fetch("/api/cro/price-book");
      if (r.ok) setLog(((await r.json()) as PriceBook).log);
    } catch {
      /* 기록은 다음에 열 때 보인다 */
    }
  }

  async function save() {
    const name = nameOf(cat, form.attrs);
    if (!name) return setErr(`${spec.fields[0].label}부터 적어 주세요.`);
    const price = digits(form.price);
    if (!price) return setErr("단가를 숫자로 적어 주세요. 예: 38,000");
    setBusy(true);
    setErr(null);
    try {
      const payload = { category: cat, name, attrs: form.attrs, unit: form.unit, price: Number(price), memo: form.memo };
      const j = form.id ? await call("PATCH", "/api/cro/price-book", { id: form.id, ...payload }) : await call("POST", "/api/cro/price-book", payload);
      const it = j.item as PriceItem;
      setItems((xs) => (form.id ? xs.map((x) => (x.id === it.id ? it : x)) : [...xs, it]));
      setForm(emptyForm(cat));
      setSheet(false);
      setNote(form.id ? `${it.name} 저장했어요.` : `${it.name} 추가했어요.`);
      void refreshLog();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    if (!form.id) return;
    setBusy(true);
    setErr(null);
    try {
      await call("DELETE", "/api/cro/price-book", { id: form.id });
      const gone = items.find((x) => x.id === form.id);
      setItems((xs) => xs.filter((x) => x.id !== form.id));
      setForm(emptyForm(cat));
      setSheet(false);
      setNote(gone ? `${gone.name} 숨겼어요.` : null);
      void refreshLog();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb">
      <header className="pb__head">
        <div>
          <span className="pb__crumb">{applyTox ? "효력시험, 독성시험 동물" : "효력시험"}</span>
          <h1>단가표</h1>
        </div>
      </header>

      <div className="pb__grid">
        <nav className="pb__cats" aria-label="분류">
          {PRICE_CATS.map((c) => (
            <button key={c} type="button" className="pb__cat" aria-pressed={c === cat} data-empty={counts[c] ? undefined : "1"} onClick={() => pickCat(c)}>
              <span>{PRICE_CAT_LABEL[c]}</span>
              <span className="pb__n">{counts[c]}</span>
            </button>
          ))}
        </nav>

        <section className="pb__main" aria-labelledby="pb-cat">
          <div className="pb__chead">
            <h2 id="pb-cat">{PRICE_CAT_LABEL[cat]}</h2>
            <span className="pb__mut">단위 {spec.units.map((u) => PRICE_UNIT_LABEL[u]).join(", ")}</span>
          </div>

          <button type="button" className="b1 pb__madd" onClick={() => { setForm(emptyForm(cat)); setErr(null); setSheet(true); }} disabled={readOnly}>
            {PRICE_CAT_LABEL[cat]} 추가
          </button>
          <form
            className="pb__form"
            data-open={sheet ? "1" : undefined}
            onKeyDown={(e) => {
              if (e.key === "Escape" && sheet) setSheet(false);
            }}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <b className="pb__ftitle">{form.id ? `${PRICE_CAT_LABEL[cat]} 고치기` : `${PRICE_CAT_LABEL[cat]} 추가`}</b>
            <div className="pb__fields">
              {spec.fields.map((f) => (
                <Field key={`${cat}.${f.key}`} cat={cat} fkey={f.key} label={f.label} form={form} setAttr={setAttr} setOwn={setOwn} disabled={readOnly || busy} />
              ))}
              {multiUnit && (
                <div className="fld pb__wide">
                  <span className="fld__lab" id="pb-unit">기준</span>
                  <div className="seg" role="group" aria-labelledby="pb-unit">
                    {spec.units.map((u) => (
                      <button key={u} type="button" aria-pressed={form.unit === u} onClick={() => setForm((x) => ({ ...x, unit: u }))} disabled={readOnly || busy}>
                        {PRICE_UNIT_LABEL[u]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="fld">
                <span className="fld__lab">단가</span>
                <span className="pb__won">
                  <input
                    className="inp pb__num"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={form.price}
                    onChange={(e) => setForm((x) => ({ ...x, price: e.target.value }))}
                    onBlur={() => setForm((x) => ({ ...x, price: digits(x.price) ? won(Number(digits(x.price))) : "" }))}
                    disabled={readOnly || busy}
                  />
                  <span aria-hidden="true">원</span>
                </span>
              </label>
              <label className="fld pb__wide">
                <span className="fld__lab">규격 메모</span>
                <input className="inp" maxLength={200} placeholder={MEMO_HINT[cat]} value={form.memo} onChange={(e) => setForm((x) => ({ ...x, memo: e.target.value }))} disabled={readOnly || busy} />
              </label>
            </div>
            {err && <p className="fld__err" role="alert">{err}</p>}
            <div className="pb__acts">
              {form.id && (
                <button type="button" className="btxt pb__hide" onClick={() => void archive()} disabled={readOnly || busy}>
                  숨기기
                </button>
              )}
              {(sheet || form.id || Object.values(form.attrs).some(Boolean) || form.price || form.memo) && (
                <button type="button" className="b2" onClick={() => { setForm(emptyForm(cat)); setErr(null); setSheet(false); }} disabled={busy}>
                  취소
                </button>
              )}
              <button type="submit" className="b1" disabled={readOnly || busy} aria-busy={busy}>
                {busy ? "저장 중" : form.id ? "저장" : "추가"}
              </button>
            </div>
          </form>
          <p className="pb__note" aria-live="polite">{note}</p>

          {rows.length ? (
            <div className="pb__tablewrap">
              <table className="pb__table">
                <thead>
                  <tr>
                    {spec.fields.map((f) => <th key={f.key} scope="col">{f.label}</th>)}
                    {multiUnit && <th scope="col">기준</th>}
                    <th scope="col">규격 메모</th>
                    <th scope="col" className="r">단가</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((it) => (
                    <tr key={it.id} data-on={form.id === it.id ? "1" : undefined} onClick={() => edit(it)}>
                      {spec.fields.map((f, i) => {
                        const v = it.attrs[f.key] ?? "";
                        const suf = NUM_FIELDS[`${cat}.${f.key}`];
                        const text = v ? (suf ? `${v}${suf}` : v) : i === 0 ? it.name : "-";
                        return (
                          <td key={f.key} className={suf ? "pb__num" : undefined}>
                            {i === 0 ? <button type="button" className="pb__rowbtn" onClick={(e) => { e.stopPropagation(); edit(it); }} aria-label={`${it.name} 고치기`}>{text}</button> : text}
                          </td>
                        );
                      })}
                      {multiUnit && <td>{PRICE_UNIT_LABEL[it.unit]}</td>}
                      <td className="pb__mut">{it.memo}</td>
                      <td className="r pb__num">{won(it.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="pb__empty">
              <b>{PRICE_CAT_LABEL[cat]} 단가 없음</b>
            </div>
          )}
        </section>

        <aside className="pb__side">
          <MarginCard value={margin} onSaved={setMargin} readOnly={readOnly} local={local} />
          <ToxCard on={applyTox} onSaved={setApplyTox} readOnly={readOnly} local={local} />
          <section className="pb__log" aria-labelledby="pb-log">
            <h2 id="pb-log">단가 바꾼 기록</h2>
            {log.length ? (
              <ul>
                {log.map((l) => (
                  <li key={l.id}>
                    <time dateTime={l.changed_at}>{l.changed_at.slice(0, 10)}</time>
                    <span>
                      {l.item_name}{" "}
                      <span className="pb__num">
                        {l.before === null ? `추가 ${won(l.after ?? 0)}` : l.after === null ? "숨김" : `${won(l.before)} → ${won(l.after)}`}
                      </span>
                      {l.via === "agent" && <span className="pb__tag">에이전트</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pb__mut">기록 없음</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({ cat, fkey, label, form, setAttr, setOwn, disabled }: { cat: PriceCat; fkey: string; label: string; form: Form; setAttr: (k: string, v: string) => void; setOwn: (k: string, on: boolean) => void; disabled: boolean }) {
  const id = `pb-${cat}-${fkey}`;
  const v = form.attrs[fkey] ?? "";
  const num = NUM_FIELDS[`${cat}.${fkey}`];
  const list = listOf(cat, fkey, form.attrs);
  const own = !!form.own[fkey];

  if (num) {
    return (
      <label className="fld pb__short" htmlFor={id}>
        <span className="fld__lab">{label}</span>
        <span className="pb__won">
          <input id={id} className="inp pb__num" inputMode="decimal" autoComplete="off" value={v} onChange={(e) => setAttr(fkey, e.target.value.replace(/[^\d.]/g, "").slice(0, 6))} disabled={disabled} />
          <span aria-hidden="true">{num}</span>
        </span>
      </label>
    );
  }
  if (!list.length || own) {
    return (
      <div className="fld">
        <label className="fld__lab" htmlFor={id}>{label}</label>
        <input id={id} className="inp" maxLength={60} value={v} onChange={(e) => setAttr(fkey, e.target.value)} disabled={disabled} autoFocus={own} />
        {own && (
          <button type="button" className="btxt pb__back" onClick={() => setOwn(fkey, false)} disabled={disabled}>
            목록에서 고르기
          </button>
        )}
      </div>
    );
  }
  if (SELECT_FIELDS.has(`${cat}.${fkey}`)) {
    return (
      <div className="fld">
        <label className="fld__lab" htmlFor={id}>{label}</label>
        <span className="selwrap">
          <select
            id={id}
            className="sel"
            value={v}
            onChange={(e) => (e.target.value === "__own" ? setOwn(fkey, true) : setAttr(fkey, e.target.value))}
            disabled={disabled}
          >
            <option value="">고르기</option>
            {list.map((g, i) =>
              g.group ? (
                <optgroup key={g.group} label={g.group}>
                  {g.values.map((x) => <option key={x} value={x}>{x}</option>)}
                </optgroup>
              ) : (
                g.values.map((x) => <option key={`${i}-${x}`} value={x}>{x}</option>)
              ),
            )}
            <option value="__own">직접 입력</option>
          </select>
          <CaretDown size={16} aria-hidden="true" />
        </span>
      </div>
    );
  }
  const vals = list.flatMap((g) => g.values);
  return (
    <div className={vals.length > 3 ? "fld pb__wide" : "fld"}>
      <span className="fld__lab" id={id}>{label}</span>
      <div className="pb__chips" role="group" aria-labelledby={id}>
        {vals.map((x) => (
          <button key={x} type="button" className="chip" aria-pressed={v === x} onClick={() => setAttr(fkey, v === x ? "" : x)} disabled={disabled}>
            {x}
          </button>
        ))}
        <button type="button" className="chip" onClick={() => setOwn(fkey, true)} disabled={disabled}>
          직접 입력
        </button>
      </div>
    </div>
  );
}

function MarginCard({ value, onSaved, readOnly, local }: { value: number; onSaved: (n: number) => void; readOnly: boolean; local: boolean }) {
  const [draft, setDraft] = useState(String(value));
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = draft.trim() !== String(value);

  async function save() {
    if (!dirty) return;
    setState("saving");
    setMsg(null);
    try {
      if (local) {
        const n = Math.round(Number(draft) * 100) / 100;
        if (!Number.isFinite(n) || n < 0 || n > 300) throw new Error("관리비·이익은 0~300 사이 숫자로 적어 주세요.");
        onSaved(n);
        setDraft(String(n));
        setState("idle");
        return;
      }
      const res = await fetch("/api/cro/price-book", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ margin_pct: draft }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "저장하지 못했어요.");
      onSaved(j.margin_pct);
      setDraft(String(j.margin_pct));
      setState("idle");
    } catch (e) {
      setState("error");
      setMsg((e as Error).message);
    }
  }

  return (
    <section className="pb__margin" aria-labelledby="pb-margin">
      <h2 id="pb-margin">관리비·이익</h2>
      <form
        className="pb__mrow"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <input
          className="pb__mval pb__num"
          inputMode="decimal"
          aria-label="관리비·이익 %"
          style={{ width: `${Math.max(1, draft.length) * 0.62 + 0.2}em` }}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, "").slice(0, 6))}
          onBlur={() => void save()}
          disabled={readOnly || state === "saving"}
        />
        <span>%</span>
        {dirty && <button type="submit" className="b1 bsm" disabled={readOnly || state === "saving"}>저장</button>}
      </form>
      {msg ? <p className="fld__err" role="alert">{msg}</p> : <p className="pb__mut">단가 합계에 더함<br />의뢰자 비공개</p>}
    </section>
  );
}

/** 단가표를 독성시험 동물 단가에도 쓰기 (0051). 기관마다 다르게 정한다 */
function ToxCard({ on, onSaved, readOnly, local }: { on: boolean; onSaved: (v: boolean) => void; readOnly: boolean; local: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function flip() {
    const next = !on;
    setBusy(true);
    setMsg(null);
    try {
      if (!local) {
        const res = await fetch("/api/cro/price-book", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ apply_tox: next }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "저장하지 못했어요.");
      }
      onSaved(next);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pb__margin pb__tox" aria-labelledby="pb-tox">
      <div className="pb__toxrow">
        <h2 id="pb-tox">독성시험 동물 단가에도 쓰기</h2>
        <button type="button" className="tgl" aria-pressed={on} aria-labelledby="pb-tox" onClick={() => void flip()} disabled={readOnly || busy}><span /></button>
      </div>
      {msg ? <p className="fld__err" role="alert">{msg}</p> : <p className="pb__mut">시험 목록의 독성 동물·회복군 단가가 빈 칸이면 동물 분류 단가로 계산해요.</p>}
    </section>
  );
}
