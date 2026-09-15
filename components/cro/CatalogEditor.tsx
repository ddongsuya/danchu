"use client";

import { useMemo, useState } from "react";
import { Chevron } from "@/components/Chevron";
import { RfqField } from "@/components/RfqField";
import { CATEGORY_ORDER, EXTRA_FIELDS, INCLUDE_KEYS, OPTION_SUGGEST, PER_SAMPLE_CATS, ROUTES, SPECIES, designSummary, type CatalogItem, type CatalogRow } from "@/lib/catalog";
import type { Cat, Values } from "@/lib/rfq-schema";
import { won, ymd } from "@/lib/format";

type Props = { items: CatalogItem[]; initialRows: CatalogRow[]; orgCategories: string[] };

/** 대분류별 접기 패널 안에 항목 행 편집기를 놓는다. 저장은 대분류 단위. */
export function CatalogEditor({ items, initialRows, orgCategories }: Props) {
  const [rows, setRows] = useState<Record<string, CatalogRow>>(() => Object.fromEntries(initialRows.map((r) => [r.item_key, r])));
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});

  const byCat = useMemo(() => {
    const m = new Map<string, CatalogItem[]>();
    for (const it of items) m.set(it.category, [...(m.get(it.category) ?? []), it]);
    return m;
  }, [items]);
  const cats = [...CATEGORY_ORDER].sort((a, b) => Number(orgCategories.includes(b)) - Number(orgCategories.includes(a)));

  const patch = (key: string, p: Partial<CatalogRow>) => {
    setRows((s) => ({ ...s, [key]: { ...s[key], ...p } }));
    setDirty((d) => new Set(d).add(rows[key].category));
  };

  const save = async (cat: string) => {
    setBusy(cat);
    setMsg((m) => ({ ...m, [cat]: { ok: true, text: "" } }));
    try {
      const payload = (byCat.get(cat) ?? []).map((it) => rows[it.key]);
      const res = await fetch("/api/cro/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: payload }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; saved?: number };
      if (!res.ok) throw new Error(d.error || "저장하지 못했습니다.");
      setDirty((s) => { const n = new Set(s); n.delete(cat); return n; });
      setMsg((m) => ({ ...m, [cat]: { ok: true, text: `저장했습니다 (${d.saved}개 항목)` } }));
    } catch (e) {
      setMsg((m) => ({ ...m, [cat]: { ok: false, text: e instanceof Error ? e.message : "저장하지 못했습니다." } }));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      {cats.map((cat) => {
        const list = byCat.get(cat) ?? [];
        const inScope = orgCategories.includes(cat);
        const done = list.filter((it) => rows[it.key].source !== "empty" || !rows[it.key].available).length;
        return (
          <details key={cat} className="card" open={inScope && done === 0 && cats[0] === cat}>
            <summary style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", cursor: "pointer", listStyle: "none" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <b style={{ fontSize: 16 }}>{cat}</b>
                <span className="pill pill--sf">{done} / {list.length}</span>
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
                <RowEditor key={it.key} row={rows[it.key]} cat={cat as Cat} onChange={(p) => patch(it.key, p)} />
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

function Num({ id, label, value, onChange, unit, placeholder, max = 9999 }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; unit?: string; placeholder?: string; max?: number }) {
  return (
    <div className="fld">
      <label className="fld__lab" htmlFor={id}>{label}</label>
      <div className="numin">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, "").slice(0, 7);
            onChange(v ? Math.min(max, Number(v)) : null);
          }}
        />
        {unit && <span>{unit}</span>}
      </div>
    </div>
  );
}

function RowEditor({ row, cat, onChange }: { row: CatalogRow; cat: Cat; onChange: (p: Partial<CatalogRow>) => void }) {
  const [open, setOpen] = useState(false);
  const perSample = row.unit === "per_sample";
  const extras = EXTRA_FIELDS[cat] ?? [];
  const summary = designSummary(row);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const srcPill = row.source === "manual" ? <span className="pill pill--ok">직접 입력</span> : row.source === "learned" ? <span className="pill pill--tint">최근 회신에서</span> : <span className="pill pill--sf">미입력</span>;

  return (
    <div style={{ border: "1px solid var(--cline)", borderRadius: 12, background: row.available ? "var(--wh)" : "var(--sf)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
        <button type="button" className="tgl" aria-pressed={row.available} aria-label={`${row.item} 수행 여부`} onClick={() => onChange({ available: !row.available })}>
          <span />
        </button>
        <button type="button" onClick={() => setOpen(!open)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: 0, padding: 0, color: "var(--ink)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <b style={{ fontSize: 15, color: row.available ? "var(--ink)" : "var(--muted)" }}>{row.item}</b>
            {row.available ? srcPill : <span className="pill pill--sf">수행하지 않음 · 배포 제외</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
            {row.available ? (summary || "표준 설계 미입력") : ""}
            {row.available && row.weeks ? ` · ${row.weeks}주` : ""}
            {row.available && (row.price_min != null) ? ` · ${perSample ? `검체당 ${row.price_min.toLocaleString("ko-KR")}원` : won(row.price_min) + (row.price_max ? ` ~ ${won(row.price_max)}` : "")}` : ""}
          </div>
        </button>
        <button type="button" className="btxt" style={{ flex: "none" }} onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "접기" : "편집"}</button>
      </div>

      {open && row.available && (
        <div style={{ padding: "0 14px 16px", display: "flex", flexDirection: "column", gap: 16, borderTop: "1px solid var(--track)" }}>
          {row.last_amount != null && (
            <p className="note note--tint" style={{ marginTop: 14 }}>
              최근 회신 {ymd(row.last_quoted_at)} · {perSample ? `검체당 ${row.last_amount.toLocaleString("ko-KR")}원` : won(row.last_amount)}{row.last_weeks ? ` · ${row.last_weeks}주` : ""}. 아래 값을 비워 두면 이 값이 초안에 들어갑니다.
            </p>
          )}
          <div className="fld" style={{ marginTop: row.last_amount != null ? 0 : 14 }}>
            <span className="fld__lab">동물종·계통</span>
            <div className="chips">
              {SPECIES.map((s) => (
                <button key={s} type="button" className="chip chip--sm" aria-pressed={row.species.includes(s)} onClick={() => onChange({ species: toggle(row.species, s) })}>{s}</button>
              ))}
            </div>
          </div>
          <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <Num id={`${row.item_key}-gc`} label="대조군 수" value={row.groups_ctrl} onChange={(v) => onChange({ groups_ctrl: v })} unit="군" placeholder="1" max={20} />
            <Num id={`${row.item_key}-gt`} label="시험군 수" value={row.groups_test} onChange={(v) => onChange({ groups_test: v })} unit="군" placeholder="4" max={20} />
            <Num id={`${row.item_key}-ps`} label="군당 마릿수 (암/수 각)" value={row.per_sex} onChange={(v) => onChange({ per_sex: v })} unit="마리" placeholder="5" max={200} />
            <Num id={`${row.item_key}-rw`} label="회복 기간" value={row.recovery_weeks} onChange={(v) => onChange({ recovery_weeks: v })} unit="주" placeholder="없음" max={52} />
            <Num id={`${row.item_key}-rp`} label="회복 추가 마릿수 (암/수 각)" value={row.recovery_per_sex} onChange={(v) => onChange({ recovery_per_sex: v })} unit="마리" placeholder="대조·최고용량군에" max={100} />
            <Num id={`${row.item_key}-wk`} label="리드타임" value={row.weeks} onChange={(v) => onChange({ weeks: v })} unit="주" placeholder="동물 입고~보고서(안)" max={200} />
          </div>
          <div className="grid2">
            <div className="fld">
              <label className="fld__lab" htmlFor={`${row.item_key}-route`}>표준 투여 경로</label>
              <div className="selwrap">
                <select id={`${row.item_key}-route`} className="sel" value={row.route ?? ""} onChange={(e) => onChange({ route: e.target.value || null })}>
                  <option value="">선택</option>
                  {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <Chevron size={16} className="" />
              </div>
            </div>
            <div className="fld">
              <label className="fld__lab" htmlFor={`${row.item_key}-dosing`}>투여 기간·횟수</label>
              <input id={`${row.item_key}-dosing`} className="inp" value={row.dosing ?? ""} onChange={(e) => onChange({ dosing: e.target.value.slice(0, 120) || null })} placeholder="예: 28일 · 1일 1회" />
            </div>
            <div className="fld">
              <label className="fld__lab" htmlFor={`${row.item_key}-glp`}>GLP 수행</label>
              <div className="selwrap">
                <select id={`${row.item_key}-glp`} className="sel" value={row.glp} onChange={(e) => onChange({ glp: e.target.value as CatalogRow["glp"] })}>
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
              {INCLUDE_KEYS.map((k) => (
                <button key={k} type="button" className="chip chip--sm" aria-pressed={row.includes.includes(k)} onClick={() => onChange({ includes: toggle(row.includes, k) })}>{k}</button>
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
            <Num id={`${row.item_key}-pmin`} label={perSample ? "검체당 참고 단가 (선택)" : "참고 단가 하한 (선택)"} value={row.price_min} onChange={(v) => onChange({ price_min: v })} unit="원" placeholder="비공개 · 초안에만" max={99999999999} />
            {!perSample && <Num id={`${row.item_key}-pmax`} label="참고 단가 상한 (선택)" value={row.price_max} onChange={(v) => onChange({ price_max: v })} unit="원" max={99999999999} />}
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
            <label className="fld__lab" htmlFor={`${row.item_key}-note`}>비고</label>
            <input id={`${row.item_key}-note`} className="inp" style={{ height: 40 }} value={row.note ?? ""} onChange={(e) => onChange({ note: e.target.value.slice(0, 500) || null })} placeholder="초안에 함께 표시할 메모 (예: 표준품 의뢰자 제공 원칙)" />
          </div>
        </div>
      )}
    </div>
  );
}
