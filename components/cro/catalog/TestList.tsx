"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CaretRight, CheckSquare, MagnifyingGlass, Plus, Square, X } from "@phosphor-icons/react";
import { RfqField } from "@/components/RfqField";
import { Chevron } from "@/components/Chevron";
import { EXTRA_FIELDS, INCLUDE_KEYS, OPTION_SUGGEST, PER_SAMPLE_CATS, ROUTES, SPECIES, isNewId, methodOptions, newVariant, type CatalogItem, type CatalogRow, type CondPrice } from "@/lib/catalog";
import { PRESETS, presetItems } from "@/lib/presets";
import { defaultRates, standardGroups, uid, type Rate } from "@/lib/quote-doc";
import type { Cat, Values } from "@/lib/rfq-schema";
import { won, ymd } from "@/lib/format";

/**
 * 시험 목록 (기관 카탈로그, 2026-11-06 재구성).
 * - 처음: 수행 분야의 시험을 골라 담는다 (Pick)
 * - 목록: 시험 한 줄 = 조건·기간·표준가. 줄을 누르면 오른쪽 서랍(Drawer)에서 고친다
 * - 방금 담은 시험은 질문 하나씩(Wizard)으로 채운다
 * 표준가는 한 칸(std_price)이고, 저장할 때 회신 초안이 쓰는 price_min 에도 같은 값이 들어간다 (lib/catalog-db toDb).
 */

type Props = { items: CatalogItem[]; initialRows: CatalogRow[]; initialRates: Record<string, Rate[]>; orgCategories: string[]; readOnly?: boolean; /** 검토 화면용: 처음 보기를 고정 */ startView?: "list" | "pick" | "wizard" };
type View = { kind: "list" } | { kind: "pick" } | { kind: "wizard"; queue: string[]; at: number };

const priceOf = (r: CatalogRow) => r.std_price ?? r.price_min ?? null;
const digits = (s: string, n = 13) => s.replace(/[^\d]/g, "").slice(0, n);
const COMMON_SPECIES = ["SD 랫드", "Wistar 랫드", "ICR 마우스", "C57BL/6 마우스", "비글", "NZW 토끼", "원숭이(영장류)", "in vitro(동물 없음)"];
const COMMON_ROUTES = ["경구(PO)", "정맥(IV)", "피하(SC)", "근육(IM)", "복강(IP)", "경피·피부", "흡입", "해당 없음"];
const routesOf = (r: CatalogRow) => (r.routes?.length ? r.routes : r.route ? [r.route] : []);
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** 설계 한 줄 (목록·서랍 요약) */
function designLine(r: CatalogRow): string {
  const p: string[] = [];
  const g = (r.groups_ctrl ?? 0) + (r.groups_test ?? 0);
  if (g) p.push(`${g}군`);
  if (r.per_sex != null) p.push(`군당 암수 각 ${r.per_sex}마리`);
  if (r.recovery_weeks) p.push(`회복 ${r.recovery_weeks}주`);
  if (r.dosing) p.push(r.dosing);
  return p.join(", ");
}
function condLine(r: CatalogRow): string {
  return [r.species.join(", "), routesOf(r).join(", "), designLine(r)].filter(Boolean).join(", ");
}

async function postJson<T>(url: string, body: unknown): Promise<T & { error?: string; ok?: boolean }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) throw new Error("연결이 끊겼어요. 네트워크를 확인하고 다시 저장해 주세요.");
  const d = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(d.error || "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  return d;
}

export function TestList({ items, initialRows, initialRates, orgCategories, readOnly = false, startView }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [rows, setRows] = useState<CatalogRow[]>(initialRows);
  const [rates, setRates] = useState<Record<string, Rate[]>>(initialRates);
  const [view, setView] = useState<View>(() => startView === "wizard" && initialRows.length ? { kind: "wizard", queue: initialRows.slice(0, 3).map((r) => r.id), at: 0 } : startView === "pick" || !initialRows.length ? { kind: "pick" } : { kind: "list" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");

  // ?item=대분류::시험 으로 들어오면 그 시험의 첫 줄을 연다 (견적서·회신 화면의 "표준가 정하기" 링크)
  useEffect(() => {
    const key = sp.get("item");
    if (!key) return;
    const r = initialRows.find((x) => x.item_key === key);
    if (r) setOpenId(r.id);
  }, [sp, initialRows]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  /** 시험 하나의 줄들을 저장하고, 서버가 돌려준 전체 목록으로 바꾼다. 새 줄의 id 를 돌려준다 */
  const saveRow = async (draft: CatalogRow, itemRates?: Rate[]): Promise<string> => {
    const same = rows.filter((r) => r.item_key === draft.item_key);
    const payload = same.some((r) => r.id === draft.id) ? same.map((r) => (r.id === draft.id ? draft : r)) : [...same, draft];
    const before = new Set(rows.map((r) => r.id));
    const d = await postJson<{ rows?: CatalogRow[] }>("/api/cro/catalog", { rows: payload, removed: [] });
    const next = d.rows ?? rows;
    const id = isNewId(draft.id) ? next.find((r) => r.item_key === draft.item_key && !before.has(r.id))?.id ?? draft.id : draft.id;
    if (itemRates) {
      await postJson("/api/cro/rates", { itemKey: draft.item_key, prices: [], rates: itemRates });
      setRates((s) => ({ ...s, [draft.item_key]: itemRates }));
    }
    setRows(next);
    router.refresh();
    return id;
  };

  const removeRow = async (r: CatalogRow) => {
    if (!isNewId(r.id)) await postJson("/api/cro/catalog", { rows: [], removed: [r.id] });
    setRows((s) => s.filter((x) => x.id !== r.id));
    setOpenId(null);
    setToast(`${r.item}을(를) 목록에서 뺐어요.`);
    router.refresh();
  };

  /** 고른 시험을 빈 줄로 담고, 질문 하나씩 채우기로 넘어간다 */
  const addPicked = async (keys: string[], fromPreset: Map<string, Partial<CatalogRow>>) => {
    const byKey = new Map(items.map((it) => [it.key, it]));
    const fresh = keys.map((k) => byKey.get(k)).filter((x): x is CatalogItem => !!x).map((it) => newVariant(it, { source: "manual", ...(fromPreset.get(it.key) ?? {}) }));
    if (!fresh.length) return;
    const before = new Set(rows.map((r) => r.id));
    const d = await postJson<{ rows?: CatalogRow[] }>("/api/cro/catalog", { rows: [...rows.filter((r) => keys.includes(r.item_key)), ...fresh], removed: [] });
    const next = d.rows ?? rows;
    setRows(next);
    const queue = next.filter((r) => !before.has(r.id)).map((r) => r.id);
    setView(queue.length ? { kind: "wizard", queue, at: 0 } : { kind: "list" });
    router.refresh();
  };

  /* ── 보기 ── */
  if (view.kind === "pick") {
    return (
      <Pick
        items={items}
        rows={rows}
        orgCategories={orgCategories}
        first={rows.length === 0}
        readOnly={readOnly}
        onBack={rows.length ? () => setView({ kind: "list" }) : undefined}
        onAdd={addPicked}
      />
    );
  }
  if (view.kind === "wizard") {
    const row = rows.find((r) => r.id === view.queue[view.at]);
    const done = () => { setView({ kind: "list" }); setToast("시험 목록에 담았어요."); };
    if (!row) return ListView();
    return (
      <Wizard
        key={row.id}
        row={row}
        index={view.at}
        total={view.queue.length}
        rates={rates[row.item_key]}
        readOnly={readOnly}
        onSave={async (draft, r) => { await saveRow(draft, r); }}
        onNext={() => (view.at + 1 < view.queue.length ? setView({ ...view, at: view.at + 1 }) : done())}
        onClose={done}
      />
    );
  }
  return ListView();

  function ListView() {
    const shownCats = [...new Set(rows.map((r) => r.category))];
    const term = q.trim().toLowerCase();
    const list = rows.filter((r) => (!cat || r.category === cat) && (!term || `${r.item} ${r.method ?? ""} ${r.species.join(" ")} ${routesOf(r).join(" ")}`.toLowerCase().includes(term)));
    const groups = shownCats.filter((c) => !cat || c === cat).map((c) => ({ cat: c, rows: list.filter((r) => r.category === c) })).filter((g) => g.rows.length);
    const open = rows.find((r) => r.id === openId) ?? null;
    return (
      <div className="tl">
        <div className="tl__head">
          <div>
            <h1>시험 목록</h1>
            <p>여기 적은 조건과 표준가로 회신 초안과 견적서가 채워져요. 다른 기관과 의뢰자에게는 보이지 않아요.</p>
          </div>
          <button type="button" className="b1 tl__add" onClick={() => setView({ kind: "pick" })} disabled={readOnly}><Plus size={18} weight="bold" aria-hidden="true" />시험 추가</button>
        </div>

        <div className="tl__tools">
          <div className="tl__chips" role="group" aria-label="분야">
            <button type="button" className="chip" aria-pressed={!cat} onClick={() => setCat("")}>전체 <span>{rows.length}</span></button>
            {shownCats.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(cat === c ? "" : c)}>{c} <span>{rows.filter((r) => r.category === c).length}</span></button>
            ))}
          </div>
          <label className="tl__search">
            <MagnifyingGlass size={16} aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="시험 이름, 동물종으로 찾기" aria-label="시험 찾기" />
          </label>
        </div>

        {groups.length === 0 ? (
          <div className="tl__none"><b>찾는 시험이 없어요</b><p>검색어를 바꾸거나 "시험 추가"로 담아 주세요.</p></div>
        ) : groups.map((g) => (
          <section key={g.cat} className="tl__grp" aria-labelledby={`g-${g.cat}`}>
            <h2 id={`g-${g.cat}`}>{g.cat} <span>{g.rows.length}개</span></h2>
            <div className="tl__thead" aria-hidden="true"><span>시험</span><span>자주 하는 조건</span><span className="r">소요 기간</span><span className="r">표준가 (VAT 별도)</span><span /></div>
            {g.rows.map((r) => {
              const p = priceOf(r);
              const perSample = r.unit === "per_sample";
              return (
                <button key={r.id} type="button" className="tl__row" data-off={r.available ? undefined : "1"} onClick={() => setOpenId(r.id)}>
                  <span className="tl__name">
                    <b>{r.item}</b>
                    <span className="tl__sub">
                      {r.method && <span>{r.method}</span>}
                      {!r.available && <span className="tl__tag">지금 안 받음</span>}
                      {r.available && r.source === "learned" && <span className="tl__tag tl__tag--hl">최근 회신에서</span>}
                    </span>
                  </span>
                  <span className="tl__cond">{condLine(r) || <em>조건을 적어 주세요</em>}</span>
                  <span className="tl__weeks r tnum">{r.weeks ? `${r.weeks}주` : r.last_weeks ? `${r.last_weeks}주` : "-"}</span>
                  <span className="tl__price r tnum">
                    {!r.available ? "-" : p != null ? (perSample ? `검체당 ${p.toLocaleString("ko-KR")}원` : `${p.toLocaleString("ko-KR")}원`) : <u>표준가 적기</u>}
                  </span>
                  <CaretRight size={18} className="tl__go" aria-hidden="true" />
                </button>
              );
            })}
          </section>
        ))}
        <p className="tl__foot">회신을 보내면 그 조건이 이 목록에 저절로 쌓여요. &quot;최근 회신에서&quot; 표시가 붙은 줄은 확인만 하면 돼요.</p>

        {open && (
          <Drawer
            key={open.id}
            row={open}
            rates={rates[open.item_key]}
            readOnly={readOnly}
            onClose={() => setOpenId(null)}
            onSave={async (draft, r) => { await saveRow(draft, r); setOpenId(null); setToast("저장했어요."); }}
            onRemove={() => removeRow(open)}
          />
        )}
        {toast && <div className="tl__toast" role="status">{toast}</div>}
      </div>
    );
  }
}

/* ── 처음: 시험 고르기 ───────────────────────────────────── */

function Pick({ items, rows, orgCategories, first, readOnly, onBack, onAdd }: {
  items: CatalogItem[]; rows: CatalogRow[]; orgCategories: string[]; first: boolean; readOnly: boolean;
  onBack?: () => void; onAdd: (keys: string[], fromPreset: Map<string, Partial<CatalogRow>>) => Promise<void>;
}) {
  const allCats: string[] = [...new Set(items.map((it) => it.category as string))];
  const mine = orgCategories.length ? allCats.filter((c) => orgCategories.includes(c)) : allCats;
  const others = allCats.filter((c) => !mine.includes(c));
  const [cat, setCat] = useState<string>(mine[0] ?? allCats[0]);
  const [more, setMore] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [preset, setPreset] = useState<Map<string, Partial<CatalogRow>>>(new Map());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const have = new Set(rows.map((r) => r.item_key));
  const list = items.filter((it) => it.category === cat);
  const shown = more ? list : list.slice(0, 6);

  const applyPreset = (key: string) => {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    const m = new Map(preset);
    const keys: string[] = [];
    for (const pi of presetItems(p)) {
      if (have.has(pi.key)) continue;
      keys.push(pi.key);
      m.set(pi.key, { species: pi.species ?? [], route: pi.route ?? null, routes: pi.route ? [pi.route] : [], method: pi.method ?? null, note: pi.note ?? null });
    }
    setPreset(m);
    setPicked((s) => [...new Set([...s, ...keys])]);
  };

  const submit = async () => {
    setBusy(true); setErr("");
    try { await onAdd(picked, preset); } catch (e) { setErr(e instanceof Error ? e.message : "담지 못했어요."); setBusy(false); }
  };

  return (
    <div className="tp">
      {onBack && <button type="button" className="tp__back" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />시험 목록</button>}
      <h1>{first ? "자주 하는 시험부터 골라 주세요" : "시험 추가"}</h1>
      <p className="tp__lead">고른 시험에 조건과 표준가를 적어 두면 회신 초안과 견적서가 그 값으로 채워져요. 적은 값은 다른 기관과 의뢰자에게 보이지 않아요.</p>

      <div className="tp__cats" role="group" aria-label="분야">
        {mine.map((c) => {
          const n = picked.filter((k) => k.startsWith(`${c}::`)).length;
          return <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => { setCat(c); setMore(false); }}>{c}{n > 0 && <span>{n}</span>}</button>;
        })}
        {others.length > 0 && (
          <div className="selwrap tp__other">
            <select className="sel" aria-label="다른 분야" value={others.includes(cat) ? cat : ""} onChange={(e) => { if (e.target.value) { setCat(e.target.value); setMore(false); } }}>
              <option value="">다른 분야</option>
              {others.map((c) => <option key={c} value={c}>{c}</option>)}
            </select><Chevron size={16} className="" />
          </div>
        )}
      </div>

      <div className="tp__opts">
        {shown.map((it) => {
          const on = picked.includes(it.key);
          const exists = have.has(it.key);
          return (
            <button key={it.key} type="button" className="tp__opt" aria-pressed={on} disabled={exists} onClick={() => setPicked((s) => toggle(s, it.key))}>
              {on || exists ? <CheckSquare size={20} aria-hidden="true" /> : <Square size={20} aria-hidden="true" />}
              <span>{it.item}</span>
              {exists && <small>목록에 있음</small>}
            </button>
          );
        })}
      </div>
      {list.length > 6 && <button type="button" className="tp__more" onClick={() => setMore(!more)}>{more ? "접기" : `${cat} ${list.length - 6}개 더 보기`}</button>}

      <details className="tp__bundle">
        <summary>자주 묶는 시험을 한 번에 고르기</summary>
        <div className="chips">
          {PRESETS.map((p) => <button key={p.key} type="button" className="chip" onClick={() => applyPreset(p.key)}>{p.name}</button>)}
        </div>
      </details>

      <div className="tp__bar">
        <p>{err ? <span role="alert" className="tp__err">{err}</span> : first ? "안 골라도 돼요. 회신을 보내면 그 조건이 목록에 저절로 쌓여요." : picked.length ? `${picked.length}개 골랐어요` : "담을 시험을 골라 주세요"}</p>
        <button type="button" className="b1" disabled={!picked.length || busy || readOnly} onClick={submit}>{busy ? "담는 중…" : picked.length ? `${picked.length}개 담기` : "담기"}</button>
      </div>
    </div>
  );
}

/* ── 공통 입력 ──────────────────────────────────────────── */

function Money({ id, label, value, onChange, unit = "원", help, big }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; unit?: string; help?: string; big?: boolean }) {
  return (
    <div className="fld">
      <label className="fld__lab" htmlFor={id}>{label}</label>
      <div className={`numin${big ? " numin--big" : ""}`}>
        <input id={id} type="text" inputMode="numeric" autoComplete="off" value={value != null ? value.toLocaleString("ko-KR") : ""} onChange={(e) => { const v = digits(e.target.value); onChange(v ? Number(v) : null); }} />
        <span>{unit}</span>
      </div>
      {help && <span className="fld__help">{help}</span>}
    </div>
  );
}
function Int({ id, label, value, onChange, unit, max, placeholder }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; unit: string; max: number; placeholder?: string }) {
  return (
    <div className="fld">
      <label className="fld__lab" htmlFor={id}>{label}</label>
      <div className="numin">
        <input id={id} type="text" inputMode="numeric" autoComplete="off" placeholder={placeholder} value={value != null ? String(value) : ""} onChange={(e) => { const v = digits(e.target.value, String(max).length); onChange(v ? Math.min(max, Number(v)) : null); }} />
        <span>{unit}</span>
      </div>
    </div>
  );
}

/** 표준가 기준(대표) 조건: 첫 번째 동물종 · 첫 번째 경로 */
function baseLabel(r: CatalogRow): string {
  return [r.species[0], routesOf(r)[0]].filter(Boolean).join(", ");
}
const multi = (r: CatalogRow) => r.species.length > 1 || routesOf(r).length > 1;
const front = (list: string[], v: string) => [v, ...list.filter((x) => x !== v)];

/** 가능한 동물종·투여 경로 (여러 개 체크). 2개 이상이면 표준가 기준을 고른다 */
function CondPick({ row, onChange, k, small }: { row: CatalogRow; onChange: (p: Partial<CatalogRow>) => void; k: string; small?: boolean }) {
  const [allSpecies, setAllSpecies] = useState(false);
  const [allRoutes, setAllRoutes] = useState(false);
  const routes = routesOf(row);
  const setRoutes = (list: string[]) => onChange({ routes: list, route: list[0] ?? null });
  const chip = small ? "chip chip--md" : "chip";
  const speciesList = allSpecies ? SPECIES : [...new Set([...row.species, ...COMMON_SPECIES])];
  const routeList = allRoutes ? ROUTES : [...new Set([...routes, ...COMMON_ROUTES])];
  return (
    <>
      <div className="fld">
        <span className="fld__lab" id={`${k}-sp`}>가능한 동물종 <em className="tc__n">{row.species.length ? `${row.species.length}개` : ""}</em></span>
        <div className="chips" role="group" aria-labelledby={`${k}-sp`}>
          {speciesList.map((x) => <button key={x} type="button" className={chip} aria-pressed={row.species.includes(x)} onClick={() => onChange({ species: toggle(row.species, x) })}>{x}</button>)}
          {!allSpecies && <button type="button" className={`${chip} tc__more`} onClick={() => setAllSpecies(true)}>다른 동물종</button>}
        </div>
      </div>
      <div className="fld">
        <span className="fld__lab" id={`${k}-rt`}>가능한 투여 경로 <em className="tc__n">{routes.length ? `${routes.length}개` : ""}</em></span>
        <div className="chips" role="group" aria-labelledby={`${k}-rt`}>
          {routeList.map((x) => <button key={x} type="button" className={chip} aria-pressed={routes.includes(x)} onClick={() => setRoutes(toggle(routes, x))}>{x}</button>)}
          {!allRoutes && <button type="button" className={`${chip} tc__more`} onClick={() => setAllRoutes(true)}>다른 경로</button>}
        </div>
      </div>
      {multi(row) && (
        <div className="tc__base">
          <span className="fld__lab">표준가 기준</span>
          <div className="tc__baserow">
            {row.species.length > 1 && (
              <div className="selwrap">
                <select className="sel" aria-label="표준가 기준 동물종" value={row.species[0]} onChange={(e) => onChange({ species: front(row.species, e.target.value) })}>
                  {row.species.map((x) => <option key={x} value={x}>{x}</option>)}
                </select><Chevron size={16} className="" />
              </div>
            )}
            {routes.length > 1 && (
              <div className="selwrap">
                <select className="sel" aria-label="표준가 기준 투여 경로" value={routes[0]} onChange={(e) => setRoutes(front(routes, e.target.value))}>
                  {routes.map((x) => <option key={x} value={x}>{x}</option>)}
                </select><Chevron size={16} className="" />
              </div>
            )}
          </div>
          <span className="fld__help">표준가는 이 조건 금액이에요. 다른 동물종·경로 금액은 표준가 아래에 따로 적어요. 비워 두면 그 조건 요청은 초안 금액을 비우고 &quot;금액 확인&quot; 표시를 붙여요.</span>
        </div>
      )}
    </>
  );
}

/** 기준이 아닌 동물종·경로일 때 표준가. 동물종은 기준 경로, 경로는 기준 동물종일 때 금액 */
function CondPrices({ row, onChange, k, perSample }: { row: CatalogRow; onChange: (p: Partial<CatalogRow>) => void; k: string; perSample: boolean }) {
  const routes = routesOf(row);
  const list = row.cond_prices ?? [];
  const lines = [
    ...row.species.slice(1).map((x) => ({ key: { species: x }, label: x, base: routes[0] })),
    ...routes.slice(1).map((x) => ({ key: { route: x }, label: x, base: row.species[0] })),
  ];
  if (!lines.length) return null;
  const same = (c: CondPrice, key: { species?: string; route?: string }) => ("species" in key ? c.species === key.species : c.route === key.route);
  const setPrice = (key: { species?: string; route?: string }, v: number | null) => {
    const rest = list.filter((c) => !same(c, key));
    onChange({ cond_prices: v == null ? rest : [...rest, { ...key, price: v }] });
  };
  return (
    <div className="tc__prices">
      <span className="fld__lab">다른 조건일 때 {perSample ? "검체당 단가" : "표준가"} <em className="tc__n">선택</em></span>
      {lines.map((l, i) => (
        <div key={l.label} className="tc__price">
          <label htmlFor={`${k}-cp${i}`}><b>{l.label}</b>{l.base ? <span>{l.base} 기준</span> : null}</label>
          <div className="numin">
            <input id={`${k}-cp${i}`} type="text" inputMode="numeric" autoComplete="off" placeholder="비우면 확인 표시" value={(() => { const c = list.find((x) => same(x, l.key)); return c ? c.price.toLocaleString("ko-KR") : ""; })()} onChange={(e) => { const v = digits(e.target.value); setPrice(l.key, v ? Number(v) : null); }} />
            <span>원</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MethodField({ id, row, onChange, chips }: { id: string; row: CatalogRow; onChange: (p: Partial<CatalogRow>) => void; chips?: boolean }) {
  const methods = methodOptions(row.category, row.item);
  const custom = !!row.method && !methods.includes(row.method);
  const [typing, setTyping] = useState(custom);
  if (chips) {
    return (
      <div className="fld">
        <span className="fld__lab">시험법</span>
        <div className="chips">
          {[...new Set([...(row.method && methods.includes(row.method) ? [row.method] : []), ...methods])].slice(0, 5).map((m) => <button key={m} type="button" className="chip" aria-pressed={row.method === m} onClick={() => { setTyping(false); onChange({ method: row.method === m ? null : m }); }}>{m}</button>)}
          <button type="button" className="chip" aria-pressed={typing} onClick={() => setTyping(!typing)}>직접 적기</button>
        </div>
        {typing && <input id={id} className="inp" value={custom ? row.method ?? "" : ""} onChange={(e) => onChange({ method: e.target.value.slice(0, 120) || null })} placeholder="예: OECD TG 402 급성경피독성" aria-label="시험법 직접 적기" />}
      </div>
    );
  }
  return (
    <div className="fld">
      <label className="fld__lab" htmlFor={id}>시험법</label>
      <div className="selwrap">
        <select id={id} className="sel" value={typing || custom ? "__custom" : row.method ?? ""} onChange={(e) => { if (e.target.value === "__custom") setTyping(true); else { setTyping(false); onChange({ method: e.target.value || null }); } }}>
          <option value="">고르지 않음</option>
          {methods.map((m) => <option key={m} value={m}>{m}</option>)}
          <option value="__custom">직접 적기</option>
        </select><Chevron size={16} className="" />
      </div>
      {(typing || custom) && <input className="inp" value={row.method ?? ""} onChange={(e) => onChange({ method: e.target.value.slice(0, 120) || null })} placeholder="예: OECD TG 402 급성경피독성" aria-label="시험법 직접 적기" />}
    </div>
  );
}

function DesignFields({ row, onChange, k }: { row: CatalogRow; onChange: (p: Partial<CatalogRow>) => void; k: string }) {
  return (
    <div className="tf__grid">
      <Int id={`${k}-gc`} label="대조군" value={row.groups_ctrl} onChange={(v) => onChange({ groups_ctrl: v })} unit="군" max={20} />
      <Int id={`${k}-gt`} label="시험군" value={row.groups_test} onChange={(v) => onChange({ groups_test: v })} unit="군" max={20} />
      <Int id={`${k}-ps`} label="군당 마릿수 (암수 각)" value={row.per_sex} onChange={(v) => onChange({ per_sex: v })} unit="마리" max={200} />
      <Int id={`${k}-rw`} label="회복 기간" value={row.recovery_weeks} onChange={(v) => onChange({ recovery_weeks: v })} unit="주" max={52} placeholder="없음" />
      <Int id={`${k}-rp`} label="회복군 마릿수 (암수 각)" value={row.recovery_per_sex} onChange={(v) => onChange({ recovery_per_sex: v })} unit="마리" max={100} />
      <div className="fld">
        <label className="fld__lab" htmlFor={`${k}-dosing`}>투여 기간·횟수</label>
        <input id={`${k}-dosing`} className="inp" value={row.dosing ?? ""} onChange={(e) => onChange({ dosing: e.target.value.slice(0, 120) || null })} placeholder="예: 28일, 1일 1회" />
      </div>
    </div>
  );
}

/* ── A. 서랍 한 장 ─────────────────────────────────────── */

function Drawer({ row, rates, readOnly, onClose, onSave, onRemove }: {
  row: CatalogRow; rates?: Rate[]; readOnly: boolean;
  onClose: () => void; onSave: (draft: CatalogRow, rates?: Rate[]) => Promise<void>; onRemove: () => Promise<void>;
}) {
  const [d, setD] = useState<CatalogRow>({ ...row, std_price: priceOf(row) });
  const [rs, setRs] = useState<Rate[] | null>(rates ?? null);
  const [designOpen, setDesignOpen] = useState(!designLine(row));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [askRemove, setAskRemove] = useState(false);
  const [dirty, setDirty] = useState(false);
  const set = (p: Partial<CatalogRow>) => { setD((s) => ({ ...s, ...p })); setDirty(true); };
  const perSample = d.unit === "per_sample";
  const hasGroups = standardGroups(d).length > 0;
  const list = rs ?? defaultRates(hasGroups);
  const setRate = (id: string, p: Partial<Rate>) => { setRs(list.map((r) => (r.id === id ? { ...r, ...p } : r))); setDirty(true); };
  const extras = EXTRA_FIELDS[d.category as Cat] ?? [];
  const k = d.id;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const save = async () => {
    setBusy(true); setErr("");
    try { await onSave(d, rs ?? (list.some((r) => r.add != null || r.deduct != null) ? list : undefined)); }
    catch (e) { setErr(e instanceof Error ? e.message : "저장하지 못했어요."); setBusy(false); }
  };

  return (
    <div className="td" role="dialog" aria-modal="true" aria-labelledby="td-title">
      <button type="button" className="td__scrim" aria-label="닫기" onClick={onClose} />
      <div className="td__panel">
        <div className="td__head">
          <button type="button" className="td__x" onClick={onClose} aria-label="닫기"><X size={22} aria-hidden="true" /></button>
          <span className="td__crumb">{d.category}</span>
          <h2 id="td-title">{d.item}</h2>
          <label className="td__avail">
            <button type="button" className="tgl" aria-pressed={d.available} aria-label="지금 받는 시험" onClick={() => set({ available: !d.available })}><span /></button>
            {d.available ? "지금 받는 시험이에요" : "지금은 받지 않아요. 회신 초안에 \"불가\"로 채워져요"}
          </label>
        </div>

        <div className="td__body">
          {d.last_amount != null && (
            <p className="td__learned">최근 회신 {ymd(d.last_quoted_at)}, {perSample ? `검체당 ${d.last_amount.toLocaleString("ko-KR")}원` : won(d.last_amount)}{d.last_weeks ? `, ${d.last_weeks}주` : ""}. 표준가를 비워 두면 이 값이 초안에 들어가요.</p>
          )}

          <section className="td__blk">
            <h3>가능한 조건</h3>
            <CondPick row={d} onChange={set} k={k} small />
            <div className="tf__grid">
              <MethodField id={`${k}-method`} row={d} onChange={set} />
              <div className="fld">
                <label className="fld__lab" htmlFor={`${k}-glp`}>GLP</label>
                <div className="selwrap">
                  <select id={`${k}-glp`} className="sel" value={d.glp} onChange={(e) => set({ glp: e.target.value as CatalogRow["glp"] })}>
                    <option value="both">GLP, Non-GLP 모두</option>
                    <option value="GLP">GLP만</option>
                    <option value="Non-GLP">Non-GLP만</option>
                  </select><Chevron size={16} className="" />
                </div>
              </div>
            </div>
          </section>

          <section className="td__blk">
            <h3>설계</h3>
            {!designOpen ? (
              <div className="td__sum">
                <div>
                  <p>{designLine(d)}</p>
                  {d.includes.length > 0 && <p className="td__mut">포함: {d.includes.slice(0, 3).join(", ")}{d.includes.length > 3 ? ` 외 ${d.includes.length - 3}개` : ""}</p>}
                </div>
                <button type="button" className="td__link" onClick={() => setDesignOpen(true)}>고치기</button>
              </div>
            ) : (
              <div className="td__open">
                <DesignFields row={d} onChange={set} k={k} />
                <div className="fld">
                  <span className="fld__lab">표준가에 든 항목</span>
                  <div className="chips">
                    {INCLUDE_KEYS.map((key) => <button key={key} type="button" className="chip chip--md" aria-pressed={d.includes.includes(key)} onClick={() => set({ includes: toggle(d.includes, key) })}>{key}</button>)}
                  </div>
                </div>
                <div className="fld">
                  <span className="fld__lab">따로 받는 항목과 금액</span>
                  {d.options.map((o, i) => (
                    <div key={i} className="td__optrow">
                      <input className="inp" value={o.name} aria-label="항목 이름" placeholder="항목 이름" onChange={(e) => set({ options: d.options.map((x, j) => (j === i ? { ...x, name: e.target.value.slice(0, 80) } : x)) })} />
                      <div className="numin"><input type="text" inputMode="numeric" aria-label={`${o.name || "항목"} 금액`} value={o.amount != null ? o.amount.toLocaleString("ko-KR") : ""} onChange={(e) => { const v = digits(e.target.value); set({ options: d.options.map((x, j) => (j === i ? { ...x, amount: v ? Number(v) : null } : x)) }); }} /><span>원</span></div>
                      <button type="button" className="btxt" aria-label={`${o.name || "항목"} 빼기`} onClick={() => set({ options: d.options.filter((_, j) => j !== i) })}><X size={16} aria-hidden="true" /></button>
                    </div>
                  ))}
                  <div className="chips">
                    {OPTION_SUGGEST.filter((s) => !d.options.some((o) => o.name === s)).slice(0, 5).map((s) => <button key={s} type="button" className="chip chip--md" onClick={() => set({ options: [...d.options, { name: s, amount: null }] })}>+ {s}</button>)}
                    <button type="button" className="chip chip--md" onClick={() => set({ options: [...d.options, { name: "", amount: null }] })}>+ 직접 적기</button>
                  </div>
                </div>
                {extras.length > 0 && (
                  <div className="fld">
                    <span className="fld__lab">{d.category} 추가 조건</span>
                    {extras.map((f) => <RfqField key={f.id} field={f} id={f.id} values={d.extra as Values} onChange={(id, v) => set({ extra: { ...d.extra, [id]: v as string | string[] } })} />)}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="td__blk">
            <h3>표준가와 기간</h3>
            {PER_SAMPLE_CATS.includes(d.category) && (
              <div className="seg" role="group" aria-label="단가 방식">
                <button type="button" aria-pressed={perSample} onClick={() => set({ unit: "per_sample" })}>검체당</button>
                <button type="button" aria-pressed={!perSample} onClick={() => set({ unit: "total" })}>총액</button>
              </div>
            )}
            <div className="tf__grid">
              <Money id={`${k}-price`} label={`${perSample ? "검체당 단가" : "표준가"}${multi(d) ? ` (${baseLabel(d)})` : ""}`} value={d.std_price ?? null} onChange={(v) => set({ std_price: v })} help={perSample ? "VAT 별도" : "위 설계 그대로일 때 금액, VAT 별도"} />
              <div className="fld">
                <label className="fld__lab" htmlFor={`${k}-wk`}>소요 기간</label>
                <div className="numin"><input id={`${k}-wk`} type="text" inputMode="numeric" value={d.weeks != null ? String(d.weeks) : ""} onChange={(e) => { const v = digits(e.target.value, 3); set({ weeks: v ? Math.min(200, Number(v)) : null }); }} /><span>주</span></div>
                <span className="fld__help">동물 입고부터 보고서(안)까지</span>
              </div>
            </div>
            <CondPrices row={d} onChange={set} k={k} perSample={perSample} />
          </section>

          {(hasGroups || list.length > 0) && (
            <section className="td__blk">
              <h3>추가 비용 단가 <span>선택</span></h3>
              <p className="td__mut">의뢰자 조건이 설계와 다르면 견적서 금액을 이 단가로 맞춰요. 차감을 비우면 줄여도 금액이 줄지 않아요.</p>
              <div className="td__rates">
                <span aria-hidden="true" /><span className="td__rh" aria-hidden="true">1{list[0]?.unit ?? "마리"}당 추가</span><span className="td__rh" aria-hidden="true">차감</span>
                {list.map((r) => (
                  <RateRow key={r.id} r={r} species={d.species} onChange={(p) => setRate(r.id, p)} />
                ))}
              </div>
              {d.species.length > 1 && hasGroups && <p className="td__mut">동물종마다 단가가 다르면 동물종 줄에 적어요. 비워 두면 {d.species[0]} 단가로 계산해요.</p>}
              <button type="button" className="td__link" onClick={() => { setRs([...list, { id: uid("r"), kind: "flat", label: "", unit: "시험", add: null, deduct: null, shown: "" }]); setDirty(true); }}>+ 항목 추가</button>
            </section>
          )}

          <section className="td__blk">
            <div className="fld">
              <label className="fld__lab" htmlFor={`${k}-note`}>비고</label>
              <input id={`${k}-note`} className="inp" value={d.note ?? ""} onChange={(e) => set({ note: e.target.value.slice(0, 500) || null })} placeholder="초안에 함께 적을 말 (예: 표준품은 의뢰자 제공)" />
            </div>
          </section>
        </div>

        <div className="td__foot">
          {askRemove ? (
            <span className="td__ask">
              목록에서 뺄까요?
              <button type="button" className="td__link td__link--err" onClick={() => onRemove().catch((e) => setErr(e instanceof Error ? e.message : "빼지 못했어요."))} disabled={readOnly}>빼기</button>
              <button type="button" className="td__link" onClick={() => setAskRemove(false)}>그대로 두기</button>
            </span>
          ) : (
            <button type="button" className="td__link td__link--err" onClick={() => setAskRemove(true)} disabled={readOnly}>목록에서 빼기</button>
          )}
          {err && <span role="alert" className="td__err">{err}</span>}
          <span className="td__btns">
            <button type="button" className="b2 td__close" onClick={onClose}>닫기</button>
            <button type="button" className="b1" onClick={save} disabled={busy || readOnly || (!dirty && !isNewId(d.id))}>{busy ? "저장 중…" : "저장"}</button>
          </span>
        </div>
      </div>
    </div>
  );
}

function RateRow({ r, species, onChange }: { r: Rate; species: string[]; onChange: (p: Partial<Rate>) => void }) {
  const auto = r.kind === "animal" || r.kind === "recovery" || r.kind === "group";
  const name = r.kind === "animal" ? "본시험 동물" : r.kind === "recovery" ? "회복군 동물" : r.kind === "group" ? "투여군" : r.label;
  const others = auto ? species.slice(1) : [];
  const setSp = (sp: string, key: "add" | "deduct", raw: string) => {
    const v = digits(raw, 12);
    const cur = r.bySpecies?.[sp] ?? { add: null, deduct: null };
    const next = { ...(r.bySpecies ?? {}), [sp]: { ...cur, [key]: v ? Number(v) : null } };
    if (next[sp].add == null && next[sp].deduct == null) delete next[sp];
    onChange({ bySpecies: next });
  };
  const fmtW = (v: number | null | undefined) => (v != null ? v.toLocaleString("ko-KR") : "");
  return (
    <>
      {auto ? <span className="td__rl">{name} <small>1{r.unit}{others.length ? ` · ${species[0]}` : ""}</small></span> : <input className="inp" value={r.label} placeholder="항목 이름 (예: 추가 장기 조직병리)" aria-label="추가 항목 이름" onChange={(e) => onChange({ label: e.target.value.slice(0, 60), shown: e.target.value.slice(0, 60) })} />}
      <div className="numin"><input type="text" inputMode="numeric" aria-label={`${name || "항목"} 추가 단가`} value={r.add != null ? r.add.toLocaleString("ko-KR") : ""} onChange={(e) => { const v = digits(e.target.value, 12); onChange({ add: v ? Number(v) : null }); }} /><span>원</span></div>
      {r.kind === "flat" ? <span /> : <div className="numin"><input type="text" inputMode="numeric" aria-label={`${name || "항목"} 차감 단가`} placeholder="없음" value={r.deduct != null ? r.deduct.toLocaleString("ko-KR") : ""} onChange={(e) => { const v = digits(e.target.value, 12); onChange({ deduct: v ? Number(v) : null }); }} /><span>원</span></div>}
      {others.map((sp) => (
        <Fragment key={sp}>
          <span className="td__rl td__rl--sp">{sp}</span>
          <div className="numin"><input type="text" inputMode="numeric" aria-label={`${sp} ${name} 추가 단가`} placeholder={fmtW(r.add) || "대표와 같음"} value={fmtW(r.bySpecies?.[sp]?.add)} onChange={(e) => setSp(sp, "add", e.target.value)} /><span>원</span></div>
          <div className="numin"><input type="text" inputMode="numeric" aria-label={`${sp} ${name} 차감 단가`} placeholder={fmtW(r.deduct) || "없음"} value={fmtW(r.bySpecies?.[sp]?.deduct)} onChange={(e) => setSp(sp, "deduct", e.target.value)} /><span>원</span></div>
        </Fragment>
      ))}
    </>
  );
}

/* ── B. 질문 하나씩 (방금 담은 시험) ───────────────────── */

function Wizard({ row, index, total, rates, readOnly, onSave, onNext, onClose }: {
  row: CatalogRow; index: number; total: number; rates?: Rate[]; readOnly: boolean;
  onSave: (draft: CatalogRow, rates?: Rate[]) => Promise<void>; onNext: () => void; onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<CatalogRow>({ ...row, std_price: priceOf(row) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (p: Partial<CatalogRow>) => setD((s) => ({ ...s, ...p }));
  const perSample = d.unit === "per_sample";
  const k = d.id;
  const steps = ["조건", "설계", "금액"];

  const finish = async () => {
    setBusy(true); setErr("");
    try { await onSave(d, rates); setBusy(false); onNext(); }
    catch (e) { setErr(e instanceof Error ? e.message : "저장하지 못했어요."); setBusy(false); }
  };

  return (
    <div className="tw">
      <div className="tw__top">
        <button type="button" className="tw__x" onClick={onClose} aria-label="채우기 그만하고 목록으로"><X size={22} aria-hidden="true" /></button>
        <span>담은 시험 {total}개 중 {index + 1}번째</span>
      </div>
      <div className="tw__steps" aria-label={`${steps.length}단계 중 ${step + 1}단계, ${steps[step]}`}>{steps.map((s, i) => <span key={s} data-on={i <= step ? "1" : undefined} />)}</div>

      {step === 0 && (
        <>
          <h1>{d.item}, 가능한 조건을 모두 골라 주세요</h1>
          <p className="tw__lead">할 수 있는 동물종과 투여 경로를 모두 체크해요. 시험은 한 줄로 남고, 요청 조건에 맞춰 회신 초안이 채워져요.</p>
          <div className="tw__q tw__cond"><CondPick row={d} onChange={set} k={`${k}-w`} /></div>
          {methodOptions(d.category, d.item).length > 0 && <div className="tw__q"><MethodField id={`${k}-wm`} row={d} onChange={set} chips /></div>}
        </>
      )}
      {step === 1 && (
        <>
          <h1>표준 설계를 적어 주세요</h1>
          <p className="tw__lead">표준가가 어떤 설계 기준인지 알려 주는 값이에요. 모르는 칸은 비워 두세요.</p>
          <div className="tw__q"><DesignFields row={d} onChange={set} k={k} /></div>
        </>
      )}
      {step === 2 && (
        <>
          <h1>{baseLabel(d) ? `${baseLabel(d)} 기준 ` : "이 조건의 "}{perSample ? "검체당 단가" : "표준가"}를 적어 주세요</h1>
          <p className="tw__lead">앞에서 고른 설계 그대로일 때 금액이에요. {multi(d) ? "다른 동물종·경로 금액도 아래에 적어 두면 그 조건 요청에 그대로 들어가요." : "회신 초안과 견적서에 이 금액이 먼저 들어가요."}</p>
          <div className="tw__q"><Money id={`${k}-wp`} label={`${perSample ? "검체당 단가" : "표준가"} (VAT 별도)`} value={d.std_price ?? null} onChange={(v) => set({ std_price: v })} big /></div>
          {multi(d) && <div className="tw__q"><CondPrices row={d} onChange={set} k={`${k}-w`} perSample={perSample} /></div>}
          <div className="tw__q tw__weeks">
            <Int id={`${k}-ww`} label="소요 기간" value={d.weeks} onChange={(v) => set({ weeks: v })} unit="주" max={200} />
            <span className="fld__help">동물 입고부터 보고서(안)까지</span>
          </div>
          <p className="tw__lead">추가 비용 단가는 목록에서 이 시험을 열어 적을 수 있어요.</p>
        </>
      )}

      {err && <p role="alert" className="tw__err">{err}</p>}
      <div className="tw__nav">
        {step === 0 ? <button type="button" className="td__link" onClick={onNext}>이 시험 건너뛰기</button> : <button type="button" className="td__link" onClick={() => setStep(step - 1)}>이전</button>}
        {step < 2
          ? <button type="button" className="b1" onClick={() => setStep(step + 1)}>다음</button>
          : <button type="button" className="b1" onClick={finish} disabled={busy || readOnly}>{busy ? "저장 중…" : index + 1 < total ? "저장하고 다음 시험" : "저장하고 목록 보기"}</button>}
      </div>
    </div>
  );
}
