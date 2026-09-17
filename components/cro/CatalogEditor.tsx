"use client";

import { useMemo, useState } from "react";
import { Chevron } from "@/components/Chevron";
import { RfqField } from "@/components/RfqField";
import { CATEGORY_ORDER, EXTRA_FIELDS, INCLUDE_KEYS, OPTION_SUGGEST, PER_SAMPLE_CATS, ROUTES, SPECIES, designSummary, methodOptions, newVariant, variantLabel, type CatalogItem, type CatalogRow } from "@/lib/catalog";
import { PRESETS, presetItems, type Preset } from "@/lib/presets";
import type { OrgPreset } from "@/lib/catalog-db";
import type { Cat, Values } from "@/lib/rfq-schema";
import { won, ymd } from "@/lib/format";

type Props = { items: CatalogItem[]; initialRows: CatalogRow[]; orgCategories: string[]; orgPresets: OrgPreset[] };

/**
 * 카탈로그 편집기.
 * 대분류 패널 → 항목 → 조합(동물종 × 경로 × 시험법) 행. 저장은 대분류 단위, 프리셋으로 여러 분류에 조합을 한 번에 만들 수 있다.
 */
export function CatalogEditor({ items, initialRows, orgCategories, orgPresets }: Props) {
  const [rows, setRows] = useState<CatalogRow[]>(initialRows);
  const [removed, setRemoved] = useState<string[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set(orgCategories.length ? [orgCategories[0]] : []));

  const byCat = useMemo(() => {
    const m = new Map<string, CatalogItem[]>();
    for (const it of items) m.set(it.category, [...(m.get(it.category) ?? []), it]);
    return m;
  }, [items]);
  const itemByKey = useMemo(() => new Map(items.map((it) => [it.key, it])), [items]);
  const cats = [...CATEGORY_ORDER].sort((a, b) => Number(orgCategories.includes(b)) - Number(orgCategories.includes(a)));
  const rowsOf = (key: string) => rows.filter((r) => r.item_key === key);

  const markDirty = (cat: string) => setDirty((d) => new Set(d).add(cat));
  const patch = (id: string, p: Partial<CatalogRow>) => {
    setRows((s) => s.map((r) => (r.id === id ? { ...r, ...p } : r)));
    const r = rows.find((x) => x.id === id);
    if (r) markDirty(r.category);
  };
  const addVariant = (it: CatalogItem, init: Partial<CatalogRow> = {}) => {
    const v = newVariant(it, init);
    setRows((s) => [...s, v]);
    markDirty(it.category);
    setOpenCats((o) => new Set(o).add(it.category));
    return v;
  };
  const duplicate = (r: CatalogRow) => {
    const it = itemByKey.get(r.item_key);
    if (!it) return;
    const { id: _id, last_amount: _a, last_weeks: _w, last_quoted_at: _q, ...rest } = r;
    void _id; void _a; void _w; void _q;
    addVariant(it, { ...rest, source: "manual" });
  };
  const remove = (r: CatalogRow) => {
    if (!window.confirm(`"${variantLabel(r)}" 조합을 삭제할까요?`)) return;
    setRows((s) => s.filter((x) => x.id !== r.id));
    if (!r.id.startsWith("new-")) setRemoved((s) => [...s, r.id]);
    markDirty(r.category);
  };

  const save = async (cat: string) => {
    setBusy(cat);
    setMsg((m) => ({ ...m, [cat]: { ok: true, text: "" } }));
    try {
      const payload = rows.filter((r) => r.category === cat);
      const catRemoved = removed.filter((id) => initialRows.some((r) => r.id === id && r.category === cat) || !initialRows.some((r) => r.id === id));
      const res = await fetch("/api/cro/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: payload, removed: catRemoved }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; saved?: number; rows?: CatalogRow[] };
      if (!res.ok) throw new Error(d.error || "저장하지 못했습니다.");
      if (d.rows) {
        // 서버가 돌려준 행으로 이 분류를 교체 (새 id 반영). 다른 분류의 미저장 편집은 유지
        setRows((s) => [...s.filter((r) => r.category !== cat), ...d.rows!.filter((r) => r.category === cat)]);
      }
      setRemoved((s) => s.filter((id) => !catRemoved.includes(id)));
      setDirty((s) => { const n = new Set(s); n.delete(cat); return n; });
      setMsg((m) => ({ ...m, [cat]: { ok: true, text: `저장했습니다 (조합 ${d.saved}개)` } }));
    } catch (e) {
      setMsg((m) => ({ ...m, [cat]: { ok: false, text: e instanceof Error ? e.message : "저장하지 못했습니다." } }));
    } finally {
      setBusy("");
    }
  };
  const saveAll = async () => {
    for (const cat of cats) if (dirty.has(cat)) await save(cat);
  };

  /** 프리셋의 항목마다 같은 축(종·경로·시험법)의 조합이 없으면 새로 만든다 */
  const applyPreset = (p: Preset) => {
    let made = 0;
    for (const pi of presetItems(p)) {
      const it = itemByKey.get(pi.key);
      if (!it) continue;
      const exists = rowsOf(pi.key).some((r) => (!pi.species?.length || pi.species.some((s) => r.species.includes(s))) && (!pi.route || r.route === pi.route) && (!pi.method || r.method === pi.method));
      if (exists) continue;
      addVariant(it, { species: pi.species ?? [], route: pi.route ?? null, method: pi.method ?? null, note: pi.note ?? null, source: "manual" });
      made++;
    }
    setMsg((m) => ({ ...m, __preset: { ok: true, text: made ? `${p.name}: 조합 ${made}개를 만들었습니다. 각 분류에서 설계·리드타임·단가를 채우고 저장하세요.` : `${p.name}: 이미 모든 조합이 있습니다.` } }));
  };

  const totalVariants = rows.length;
  const filledItems = new Set(rows.filter((r) => r.source !== "empty").map((r) => r.item_key)).size;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PresetPanel orgPresets={orgPresets} rows={rows} onApply={applyPreset} note={msg.__preset?.text} />

      {dirty.size > 1 && (
        <div className="note note--tint" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>저장 안 된 분류 {dirty.size}개</span>
          <button type="button" className="b1 bsm" disabled={!!busy} onClick={saveAll}>{busy ? "저장 중…" : "변경된 분류 모두 저장"}</button>
        </div>
      )}

      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>조합 {totalVariants}개 · 항목 {filledItems} / {items.length}. 항목 하나에 동물종·투여경로·시험법이 다른 조합을 여러 개 둘 수 있습니다.</p>

      {cats.map((cat) => {
        const list = byCat.get(cat) ?? [];
        const inScope = orgCategories.includes(cat);
        const catRows = rows.filter((r) => r.category === cat);
        const done = new Set(catRows.map((r) => r.item_key)).size;
        const open = openCats.has(cat);
        return (
          <details key={cat} className="card" open={open} onToggle={(e) => { const o = (e.target as HTMLDetailsElement).open; setOpenCats((s) => { const n = new Set(s); if (o) n.add(cat); else n.delete(cat); return n; }); }}>
            <summary style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", cursor: "pointer", listStyle: "none" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexWrap: "wrap" }}>
                <b style={{ fontSize: 16 }}>{cat}</b>
                <span className="pill pill--sf">항목 {done} / {list.length} · 조합 {catRows.length}</span>
                {!inScope && <span className="pill pill--warn">수행 분야에 없음</span>}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {dirty.has(cat) && <span className="pill pill--tint">저장 안 됨</span>}
                <Chevron size={18} className="" />
              </span>
            </summary>
            <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              {!inScope && <p className="note note--warn">이 분야는 기관 정보의 수행 분야에 없어 요청서가 배포되지 않습니다. 수행하려면 기관 탭에서 분야를 추가하세요.</p>}
              {list.map((it) => (
                <ItemBlock key={it.key} item={it} rows={rowsOf(it.key)} cat={cat as Cat} onAdd={() => addVariant(it)} onPatch={patch} onDuplicate={duplicate} onRemove={remove} />
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button type="button" className="b1" disabled={!dirty.has(cat) || busy === cat} onClick={() => save(cat)}>{busy === cat ? "저장 중…" : `${cat} 저장`}</button>
                {msg[cat]?.text && <span style={{ fontSize: 13, color: msg[cat].ok ? "var(--ok)" : "var(--err)" }}>{msg[cat].text}</span>}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

/* ── 프리셋 ─────────────────────────────────────────────── */

function PresetPanel({ orgPresets, rows, onApply, note }: { orgPresets: OrgPreset[]; rows: CatalogRow[]; onApply: (p: Preset) => void; note?: string }) {
  const [sel, setSel] = useState<string>("");
  const [offered, setOffered] = useState<Record<string, OrgPreset>>(() => Object.fromEntries(orgPresets.map((p) => [p.preset_key, p])));
  const [saving, setSaving] = useState("");
  const p = PRESETS.find((x) => x.key === sel);
  const audiences = [...new Set(PRESETS.map((x) => x.audience))];

  const coverage = (preset: Preset) => {
    const its = presetItems(preset);
    const have = its.filter((pi) => rows.some((r) => r.item_key === pi.key && r.available)).length;
    return { have, total: its.length };
  };

  const saveOffer = async (key: string, patch: Partial<OrgPreset>) => {
    const cur = offered[key] ?? { preset_key: key, offered: false, package_price: null, note: null };
    const next = { ...cur, ...patch };
    setOffered((s) => ({ ...s, [key]: next }));
    setSaving(key);
    try {
      await fetch("/api/cro/presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ presetKey: key, offered: next.offered, packagePrice: next.package_price, note: next.note }) });
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="card card--pad stack" style={{ gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>패키지 프리셋</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>자주 묶이는 시험 세트입니다. 고르면 해당 항목의 조합이 한 번에 만들어져 설계·단가만 채우면 됩니다. "제공"을 켜 두면 의뢰자가 패키지로 요청할 때 우선 안내됩니다.</p>
      </div>
      {audiences.map((a) => (
        <div key={a} className="fld" style={{ gap: 6 }}>
          <span className="fld__lab" style={{ fontSize: 12 }}>{a}</span>
          <div className="chips">
            {PRESETS.filter((x) => x.audience === a).map((x) => {
              const c = coverage(x);
              return (
                <button key={x.key} type="button" className="chip chip--sm" aria-pressed={sel === x.key} onClick={() => setSel(sel === x.key ? "" : x.key)}>
                  {x.name} <span style={{ opacity: 0.7, marginLeft: 4 }}>{c.have}/{c.total}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {p && (
        <div style={{ border: "1px solid var(--cline)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <b>{p.name}</b>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>{p.desc}</p>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, columns: 2, columnGap: 24 }}>
            {presetItems(p).map((pi, i) => {
              const has = rows.some((r) => r.item_key === pi.key && r.available);
              return (
                <li key={i} style={{ breakInside: "avoid", color: has ? "var(--ink)" : "var(--muted)" }}>
                  {pi.item} <span style={{ color: "var(--muted)" }}>· {[pi.species?.join("·"), pi.route, pi.method].filter(Boolean).join(" · ")}</span>{has ? " ✓" : ""}
                </li>
              );
            })}
          </ul>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="b1 bsm" onClick={() => onApply(p)}>없는 조합 만들기</button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <button type="button" className="tgl" aria-pressed={!!offered[p.key]?.offered} aria-label="패키지 제공" disabled={saving === p.key} onClick={() => saveOffer(p.key, { offered: !offered[p.key]?.offered })}><span /></button>
              이 패키지 제공
            </label>
            {offered[p.key]?.offered && (
              <div className="numin" style={{ width: 220 }}>
                <input type="text" inputMode="numeric" style={{ height: 38 }} placeholder="패키지 참고 총액 (선택)" value={offered[p.key]?.package_price != null ? Number(offered[p.key].package_price).toLocaleString("ko-KR") : ""} onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, "").slice(0, 13); setOffered((s) => ({ ...s, [p.key]: { ...s[p.key], package_price: v ? Number(v) : null } })); }} onBlur={() => saveOffer(p.key, {})} />
                <span>원</span>
              </div>
            )}
          </div>
        </div>
      )}
      {note && <p className="note note--ok" role="status" style={{ margin: 0 }}>{note}</p>}
    </div>
  );
}

/* ── 항목 블록: 조합 목록 ────────────────────────────────── */

function ItemBlock({ item, rows, cat, onAdd, onPatch, onDuplicate, onRemove }: { item: CatalogItem; rows: CatalogRow[]; cat: Cat; onAdd: () => void; onPatch: (id: string, p: Partial<CatalogRow>) => void; onDuplicate: (r: CatalogRow) => void; onRemove: (r: CatalogRow) => void }) {
  return (
    <div style={{ border: "1px solid var(--cline)", borderRadius: 12, background: "var(--wh)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <b style={{ fontSize: 15 }}>{item.item}</b>
          {rows.length ? <span className="pill pill--sf">조합 {rows.length}</span> : <span className="pill pill--sf">조합 없음 · 회신 때 직접 입력</span>}
        </span>
        <button type="button" className="b2 bsm" onClick={onAdd}>+ 조합 추가</button>
      </div>
      {rows.length > 0 && (
        <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => (
            <VariantEditor key={r.id} row={r} cat={cat} onChange={(p) => onPatch(r.id, p)} onDuplicate={() => onDuplicate(r)} onRemove={() => onRemove(r)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Num({ id, label, value, onChange, unit, placeholder, max = 9999 }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; unit?: string; placeholder?: string; max?: number }) {
  return (
    <div className="fld">
      <label className="fld__lab" htmlFor={id}>{label}</label>
      <div className="numin">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value != null ? (max > 9999 ? value.toLocaleString("ko-KR") : String(value)) : ""}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, "").slice(0, String(max).length);
            onChange(v ? Math.min(max, Number(v)) : null);
          }}
        />
        {unit && <span>{unit}</span>}
      </div>
    </div>
  );
}

/* ── 조합 편집 ──────────────────────────────────────────── */

function VariantEditor({ row, cat, onChange, onDuplicate, onRemove }: { row: CatalogRow; cat: Cat; onChange: (p: Partial<CatalogRow>) => void; onDuplicate: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(row.id.startsWith("new-") && !row.method && !row.species.length);
  const perSample = row.unit === "per_sample";
  const extras = EXTRA_FIELDS[cat] ?? [];
  const methods = methodOptions(row.category, row.item);
  const customMethod = !!row.method && !methods.includes(row.method);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const design = designSummary({ ...row, species: [], route: null, method: null });
  const srcPill = row.source === "manual" ? <span className="pill pill--ok">직접 입력</span> : row.source === "learned" ? <span className="pill pill--tint">최근 회신에서</span> : <span className="pill pill--sf">미입력</span>;
  const k = row.id;

  return (
    <div style={{ border: "1px solid var(--cline)", borderRadius: 10, background: row.available ? "var(--sf)" : "var(--track)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        <button type="button" className="tgl" aria-pressed={row.available} aria-label="수행 여부" onClick={() => onChange({ available: !row.available })}><span /></button>
        <button type="button" onClick={() => setOpen(!open)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: 0, padding: 0, color: "var(--ink)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: row.available ? "var(--ink)" : "var(--muted)" }}>{variantLabel(row)}</span>
            {row.available ? srcPill : <span className="pill pill--sf">수행하지 않음</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
            {row.available ? (design || "표준 설계 미입력") : ""}
            {row.available && row.weeks ? ` · ${row.weeks}주` : ""}
            {row.available && row.price_min != null ? ` · ${perSample ? `검체당 ${row.price_min.toLocaleString("ko-KR")}원` : won(row.price_min) + (row.price_max ? ` ~ ${won(row.price_max)}` : "")}` : ""}
          </div>
        </button>
        <span style={{ display: "flex", gap: 6, flex: "none" }}>
          <button type="button" className="btxt" onClick={onDuplicate} title="이 조합을 복제해 동물종만 바꾸기">복제</button>
          <button type="button" className="btxt" onClick={onRemove} style={{ color: "var(--err)" }}>삭제</button>
          <button type="button" className="btxt" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "접기" : "편집"}</button>
        </span>
      </div>

      {open && (
        <div style={{ padding: "0 12px 14px", display: "flex", flexDirection: "column", gap: 14, borderTop: "1px solid var(--track)" }}>
          {row.last_amount != null && (
            <p className="note note--tint" style={{ marginTop: 12 }}>
              최근 회신 {ymd(row.last_quoted_at)} · {perSample ? `검체당 ${row.last_amount.toLocaleString("ko-KR")}원` : won(row.last_amount)}{row.last_weeks ? ` · ${row.last_weeks}주` : ""}. 아래 값을 비워 두면 이 값이 초안에 들어갑니다.
            </p>
          )}

          <div className="fld" style={{ marginTop: row.last_amount != null ? 0 : 12 }}>
            <span className="fld__lab">동물종·계통 <span style={{ fontWeight: 400, color: "var(--muted)" }}>· 설계·단가가 같은 종만 함께 두세요</span></span>
            <div className="chips">
              {SPECIES.map((s) => (
                <button key={s} type="button" className="chip chip--sm" aria-pressed={row.species.includes(s)} onClick={() => onChange({ species: toggle(row.species, s) })}>{s}</button>
              ))}
            </div>
          </div>
          <div className="grid2">
            <div className="fld">
              <label className="fld__lab" htmlFor={`${k}-route`}>투여 경로</label>
              <div className="selwrap">
                <select id={`${k}-route`} className="sel" value={row.route ?? ""} onChange={(e) => onChange({ route: e.target.value || null })}>
                  <option value="">선택</option>
                  {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <Chevron size={16} className="" />
              </div>
            </div>
            <div className="fld">
              <label className="fld__lab" htmlFor={`${k}-method`}>시험법·가이드라인</label>
              <div className="selwrap">
                <select id={`${k}-method`} className="sel" value={customMethod ? "__custom" : row.method ?? ""} onChange={(e) => onChange({ method: e.target.value === "__custom" ? row.method || " " : e.target.value || null })}>
                  <option value="">선택</option>
                  {methods.map((m) => <option key={m} value={m}>{m}</option>)}
                  <option value="__custom">직접 입력…</option>
                </select>
                <Chevron size={16} className="" />
              </div>
              {(customMethod || row.method === " ") && (
                <input className="inp" style={{ height: 40, marginTop: 6 }} autoFocus value={row.method?.trim() ?? ""} onChange={(e) => onChange({ method: e.target.value.slice(0, 120) || " " })} placeholder="예: OECD TG 402 급성경피독성" />
              )}
            </div>
          </div>

          <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <Num id={`${k}-gc`} label="대조군 수" value={row.groups_ctrl} onChange={(v) => onChange({ groups_ctrl: v })} unit="군" placeholder="1" max={20} />
            <Num id={`${k}-gt`} label="시험군 수" value={row.groups_test} onChange={(v) => onChange({ groups_test: v })} unit="군" placeholder="4" max={20} />
            <Num id={`${k}-ps`} label="군당 마릿수 (암/수 각)" value={row.per_sex} onChange={(v) => onChange({ per_sex: v })} unit="마리" placeholder="5" max={200} />
            <Num id={`${k}-rw`} label="회복 기간" value={row.recovery_weeks} onChange={(v) => onChange({ recovery_weeks: v })} unit="주" placeholder="없음" max={52} />
            <Num id={`${k}-rp`} label="회복 추가 마릿수 (암/수 각)" value={row.recovery_per_sex} onChange={(v) => onChange({ recovery_per_sex: v })} unit="마리" placeholder="대조·최고용량군에" max={100} />
            <Num id={`${k}-wk`} label="리드타임" value={row.weeks} onChange={(v) => onChange({ weeks: v })} unit="주" placeholder="동물 입고~보고서(안)" max={200} />
          </div>
          <div className="grid2">
            <div className="fld">
              <label className="fld__lab" htmlFor={`${k}-dosing`}>투여 기간·횟수</label>
              <input id={`${k}-dosing`} className="inp" value={row.dosing ?? ""} onChange={(e) => onChange({ dosing: e.target.value.slice(0, 120) || null })} placeholder="예: 28일 · 1일 1회" />
            </div>
            <div className="fld">
              <label className="fld__lab" htmlFor={`${k}-glp`}>GLP 수행</label>
              <div className="selwrap">
                <select id={`${k}-glp`} className="sel" value={row.glp} onChange={(e) => onChange({ glp: e.target.value as CatalogRow["glp"] })}>
                  <option value="both">GLP · Non-GLP 모두</option>
                  <option value="GLP">GLP만</option>
                  <option value="Non-GLP">Non-GLP만</option>
                </select>
                <Chevron size={16} className="" />
              </div>
            </div>
          </div>

          <div className="fld">
            <span className="fld__lab">기본 포함 항목</span>
            <span className="fld__help">총액 안에 든 것만 고르세요. 조직병리는 검경까지 포함이 기본입니다.</span>
            <div className="chips">
              {INCLUDE_KEYS.map((key) => (
                <button key={key} type="button" className="chip chip--sm" aria-pressed={row.includes.includes(key)} onClick={() => onChange({ includes: toggle(row.includes, key) })}>{key}</button>
              ))}
            </div>
          </div>

          <div className="fld">
            <span className="fld__lab">별도 옵션과 금액</span>
            <div className="stack" style={{ gap: 6 }}>
              {row.options.map((o, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 160px 36px", gap: 8, alignItems: "center" }}>
                  <input className="inp" style={{ height: 40 }} value={o.name} onChange={(e) => onChange({ options: row.options.map((x, j) => (j === i ? { ...x, name: e.target.value.slice(0, 80) } : x)) })} placeholder="옵션명" />
                  <div className="numin">
                    <input type="text" inputMode="numeric" style={{ height: 40 }} value={o.amount != null ? o.amount.toLocaleString("ko-KR") : ""} onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, "").slice(0, 13); onChange({ options: row.options.map((x, j) => (j === i ? { ...x, amount: v ? Number(v) : null } : x)) }); }} placeholder="금액" />
                    <span>원</span>
                  </div>
                  <button type="button" className="btxt" aria-label="옵션 삭제" onClick={() => onChange({ options: row.options.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
              <div className="chips">
                {OPTION_SUGGEST.filter((s) => !row.options.some((o) => o.name === s)).map((s) => (
                  <button key={s} type="button" className="chip chip--sm" onClick={() => onChange({ options: [...row.options, { name: s, amount: null }] })}>+ {s}</button>
                ))}
                <button type="button" className="chip chip--sm" onClick={() => onChange({ options: [...row.options, { name: "", amount: null }] })}>+ 직접 입력</button>
              </div>
            </div>
          </div>

          <div className="grid2">
            {PER_SAMPLE_CATS.includes(cat) && (
              <div className="fld">
                <span className="fld__lab">단가 방식</span>
                <div className="seg">
                  <button type="button" aria-pressed={perSample} onClick={() => onChange({ unit: "per_sample" })}>검체당</button>
                  <button type="button" aria-pressed={!perSample} onClick={() => onChange({ unit: "total" })}>총액</button>
                </div>
              </div>
            )}
            <Num id={`${k}-pmin`} label={perSample ? "검체당 참고 단가 (선택)" : "참고 단가 하한 (선택)"} value={row.price_min} onChange={(v) => onChange({ price_min: v })} unit="원" placeholder="비공개 · 초안에만" max={99999999999} />
            {!perSample && <Num id={`${k}-pmax`} label="참고 단가 상한 (선택)" value={row.price_max} onChange={(v) => onChange({ price_max: v })} unit="원" max={99999999999} />}
          </div>

          {extras.length > 0 && (
            <div className="fld" style={{ gap: 14 }}>
              <span className="fld__lab">{cat} 추가 조건</span>
              {extras.map((f) => (
                <RfqField key={f.id} field={f} id={f.id} values={row.extra as Values} onChange={(id, v) => onChange({ extra: { ...row.extra, [id]: v as string | string[] } })} />
              ))}
            </div>
          )}

          <div className="fld">
            <label className="fld__lab" htmlFor={`${k}-note`}>비고</label>
            <input id={`${k}-note`} className="inp" style={{ height: 40 }} value={row.note ?? ""} onChange={(e) => onChange({ note: e.target.value.slice(0, 500) || null })} placeholder="초안에 함께 표시할 메모 (예: 표준품 의뢰자 제공 원칙)" />
          </div>
        </div>
      )}
    </div>
  );
}
