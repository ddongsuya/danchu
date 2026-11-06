"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, X } from "@phosphor-icons/react";
import { defaultRates, standardGroups, uid, type Rate, type RateKind } from "@/lib/quote-doc";
import type { CatalogRow } from "@/lib/catalog";

const n = (v: number) => v.toLocaleString("ko-KR");
const digits = (s: string) => s.replace(/[^\d]/g, "").slice(0, 12);
const money = (v: number | null) => (v == null ? "" : n(v));

type Props = { catalog: CatalogRow[]; rates: Record<string, Rate[]>; usage: Record<string, number>; initialItem?: string; readOnly?: boolean };

/**
 * 견적서 단가: 시험(카탈로그 항목)마다 조건별 표준가와 추가 비용 단가를 정한다.
 * 표준가는 카탈로그 조합(동물종·경로·시험법)마다, 추가 비용 단가는 시험마다 하나.
 */
export function RatesEditor({ catalog, rates: rates0, usage, initialItem, readOnly = false }: Props) {
  const items = useMemo(() => {
    const m = new Map<string, { key: string; category: string; item: string; rows: CatalogRow[] }>();
    for (const c of catalog) {
      const it = m.get(c.item_key) ?? { key: c.item_key, category: c.category, item: c.item, rows: [] };
      it.rows.push(c);
      m.set(c.item_key, it);
    }
    return [...m.values()];
  }, [catalog]);
  const [sel, setSel] = useState<string>(initialItem && items.some((i) => i.key === initialItem) ? initialItem : items[0]?.key ?? "");
  const [prices, setPrices] = useState<Record<string, number | null>>(() => Object.fromEntries(catalog.map((c) => [c.id, c.std_price ?? null])));
  const [rates, setRates] = useState<Record<string, Rate[]>>(rates0);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pane, setPane] = useState<"list" | "edit">(initialItem ? "edit" : "list");

  useEffect(() => {
    if (!dirty.size) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const cur = items.find((i) => i.key === sel);
  const hasGroups = !!cur?.rows.some((r) => standardGroups(r).length > 0);
  const list: Rate[] = cur ? rates[cur.key] ?? defaultRates(hasGroups) : [];
  const mark = () => { if (cur) setDirty((d) => new Set(d).add(cur.key)); setMsg(null); };
  const setList = (next: Rate[]) => { if (!cur) return; setRates((r) => ({ ...r, [cur.key]: next })); mark(); };
  const patch = (id: string, p: Partial<Rate>) => setList(list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const addRate = (kind: RateKind) => {
    const base: Record<RateKind, Partial<Rate>> = {
      animal: { label: "본시험 동물 수", unit: "마리", shown: "동물 수 추가 / 차감" },
      recovery: { label: "회복군", unit: "마리", shown: "회복군 추가 / 제외" },
      group: { label: "투여군", unit: "군", shown: "투여군 추가 / 제외" },
      qty: { label: "", unit: "군", shown: "" },
      flat: { label: "", unit: "시험", shown: "" },
    };
    const id = kind === "animal" || kind === "recovery" || kind === "group" ? kind : uid("r");
    setList([...list, { id, kind, label: "", unit: "", add: null, deduct: null, shown: "", ...base[kind] } as Rate]);
  };

  const save = async () => {
    if (!cur) return;
    setBusy(true); setMsg(null);
    const r = await fetch("/api/cro/rates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemKey: cur.key, prices: cur.rows.map((c) => ({ id: c.id, std_price: prices[c.id] ?? null })), rates: list }),
    }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    setBusy(false);
    if (!r?.ok) return setMsg({ ok: false, text: d?.error || "저장하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요." });
    setDirty((s) => { const x = new Set(s); x.delete(cur.key); return x; });
    setMsg({ ok: true, text: "저장했어요. 새로 만드는 견적서부터 적용돼요." });
  };

  if (!items.length) {
    return (
      <div className="empty">
        <b>카탈로그에 등록한 시험이 없어요</b>
        카탈로그에 시험 조건(동물종·투여경로·군 구성)을 먼저 등록하면, 여기에서 조건마다 표준가를 정할 수 있어요.
        <div style={{ marginTop: 14 }}><Link href="/cro/catalog" className="b1 bsm">카탈로그 열기</Link></div>
      </div>
    );
  }

  const byCat = new Map<string, typeof items>();
  for (const it of items) byCat.set(it.category, [...(byCat.get(it.category) ?? []), it]);
  const ex = cur?.rows.find((r) => standardGroups(r).length > 0) ?? cur?.rows[0];
  const exGroups = ex ? standardGroups(ex) : [];
  const exPrice = ex ? prices[ex.id] ?? null : null;
  const r = (k: RateKind) => list.find((x) => x.kind === k);

  return (
    <div className="qrate" data-pane={pane}>
      <aside className="qrate__list" aria-label="시험 목록">
        <h2 className="qed__h">우리 기관 카탈로그 <span className="tnum">{items.length}</span></h2>
        {[...byCat.entries()].map(([cat, its]) => (
          <div key={cat}>
            <p className="qrate__cat">{cat}</p>
            {its.map((it) => (
              <button key={it.key} type="button" aria-current={sel === it.key ? "true" : undefined} onClick={() => { setSel(it.key); setPane("edit"); setMsg(null); }}>
                <span>{it.item}{dirty.has(it.key) ? <i className="qrate__dot" aria-label="저장 안 됨" /> : null}</span>
                <small className="tnum">{it.rows.filter((c) => prices[c.id] != null).length}/{it.rows.length}</small>
              </button>
            ))}
          </div>
        ))}
      </aside>

      {cur && (
        <section className="qrate__main">
          <button type="button" className="qrate__back btxt" onClick={() => setPane("list")}>시험 목록</button>
          <p className="qd__cap">카탈로그 · {cur.category}</p>
          <h1 className="qrate__title">{cur.item}</h1>
          <p className="qrate__lead">시험 조건마다 표준가와 포함 범위를 정해요. 견적서에서 포함 범위와 달라지면 아래 추가 비용 단가로 계산해요.</p>

          <div className="qed__h2row"><h2 className="qrate__h2">조건별 표준가</h2><Link href="/cro/catalog">조건 추가</Link></div>
          <p className="qed__muted">원, VAT 별도</p>
          <div className="qed__tblwrap">
            <table className="qrate__tbl">
              <thead><tr><th>조건</th><th>표준가 포함 범위</th><th>회복</th><th className="r">표준가</th></tr></thead>
              <tbody>
                {cur.rows.map((c) => {
                  const gs = standardGroups(c);
                  const recWho = gs.filter((g) => g.rm + g.rf > 0).map((g) => g.label.split(" ")[0]).join(", ");
                  return (
                    <tr key={c.id}>
                      <td><b>{[c.dosing, c.species.join("·"), c.route].filter(Boolean).join(" · ") || "조건 미입력"}</b>{c.method && <small>{c.method}</small>}{usage[c.id] ? <small>작성 중 견적서 {usage[c.id]}건</small> : null}</td>
                      <td data-label="표준가 포함 범위">{gs.length ? `${gs.length}군 · 군당 성별 ${c.per_sex ?? 0}마리` : "군 구성 없음"}{c.includes.length > 0 && <small>기본 포함 {c.includes.length}개 · {c.includes.slice(0, 3).join(", ")}{c.includes.length > 3 ? " 외" : ""}</small>}</td>
                      <td data-label="회복">{c.recovery_weeks ? `${c.recovery_weeks}주${recWho ? ` · ${recWho}` : ""}` : "없음"}</td>
                      <td className="r" data-label="표준가"><input aria-label={`${c.dosing || c.item} 표준가`} className="qrate__in tnum" inputMode="numeric" disabled={readOnly} value={money(prices[c.id] ?? null)} placeholder="금액" onChange={(e) => { setPrices((p) => ({ ...p, [c.id]: e.target.value ? Number(digits(e.target.value)) : null })); mark(); }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="qed__muted">군 구성·기본 포함 항목은 <Link href="/cro/catalog">카탈로그</Link>에서 고쳐요.</p>

          <div className="qed__h2row"><h2 className="qrate__h2">추가 비용 단가</h2></div>
          <p className="qed__muted">포함 범위보다 늘거나 줄면 이 단가로 계산해요. 견적서에는 &quot;견적서 표시명&quot;으로 들어가요. 차감을 비우면 줄여도 금액이 줄지 않아요.</p>
          <div className="qed__tblwrap">
            <table className="qrate__tbl qrate__rates">
              <thead><tr><th>항목</th><th>단위</th><th className="r">추가</th><th className="r">차감</th><th>견적서 표시명</th><th /></tr></thead>
              <tbody>
                {list.map((x) => {
                  const auto = x.kind === "animal" || x.kind === "recovery" || x.kind === "group";
                  return (
                    <tr key={x.id}>
                      <td>
                        {auto ? <b>{x.label}</b> : <input aria-label="항목 이름" className="qed__in" disabled={readOnly} value={x.label} placeholder={x.kind === "flat" ? "예: 기능관찰 (FOB)" : "예: 조직병리검사 범위"} onChange={(e) => patch(x.id, { label: e.target.value.slice(0, 60) })} />}
                        <small className="qrate__kind">{x.kind === "flat" ? "평가항목" : x.kind === "qty" ? "수량 직접 입력" : x.kind === "group" ? `군당 성별 ${ex?.per_sex ?? "-"}마리 기준` : "자동 계산"}</small>
                      </td>
                      <td data-label="단위">{auto ? x.unit : <input aria-label="단위" className="qed__in qrate__unit" disabled={readOnly} value={x.unit} onChange={(e) => patch(x.id, { unit: e.target.value.slice(0, 12) })} />}</td>
                      <td className="r" data-label="추가"><input aria-label={`${x.label} 추가 단가`} className="qrate__in tnum" inputMode="numeric" disabled={readOnly} value={money(x.add)} placeholder="금액" onChange={(e) => patch(x.id, { add: e.target.value ? Number(digits(e.target.value)) : null })} /></td>
                      <td className="r" data-label="차감">{x.kind === "flat" ? <span className="qed__muted">-</span> : <input aria-label={`${x.label} 차감 단가`} className="qrate__in tnum" inputMode="numeric" disabled={readOnly} value={money(x.deduct)} placeholder="차감 없음" onChange={(e) => patch(x.id, { deduct: e.target.value ? Number(digits(e.target.value)) : null })} />}</td>
                      <td data-label="견적서 표시명"><input aria-label="견적서 표시명" className="qed__in" disabled={readOnly} value={x.shown} placeholder={x.label ? `${x.label} 추가` : "견적서에 보일 이름"} onChange={(e) => patch(x.id, { shown: e.target.value.slice(0, 60) })} /></td>
                      <td className="qrate__xcell">{!readOnly && <button type="button" className="qed__x" aria-label={`${x.label || "항목"} 빼기`} onClick={() => setList(list.filter((y) => y.id !== x.id))}><X size={14} /></button>}</td>
                    </tr>
                  );
                })}
                {!list.length && <tr><td colSpan={6} className="qed__muted">추가 비용 항목이 없어요. 아래에서 추가해요.</td></tr>}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <div className="qed__rowtools">
              <button type="button" className="btxt" onClick={() => addRate("qty")}><Plus size={14} aria-hidden="true" /> 수량 항목</button>
              <button type="button" className="btxt" onClick={() => addRate("flat")}><Plus size={14} aria-hidden="true" /> 평가항목 추가</button>
              {hasGroups && (["animal", "recovery", "group"] as RateKind[]).filter((k) => !r(k)).map((k) => <button key={k} type="button" className="btxt" onClick={() => addRate(k)}><Plus size={14} aria-hidden="true" /> {k === "animal" ? "본시험 동물 수" : k === "recovery" ? "회복군" : "투여군"}</button>)}
            </div>
          )}
          <p className="qed__muted">카탈로그의 &quot;별도 옵션&quot;(이름·금액)은 견적서 평가항목에 &quot;추가 시&quot; 금액으로 함께 들어가요.</p>

          <div className="qrate__save">
            {msg && <span role="status" className={msg.ok ? "qrate__ok" : "qed__warn"}>{msg.text}</span>}
            {!readOnly && <button type="button" className="b1" disabled={busy || !dirty.has(cur.key)} onClick={save}>{busy ? "저장 중…" : "저장"}</button>}
          </div>
        </section>
      )}

      {cur && (
        <aside className="qrate__preview" aria-label="견적서 미리보기">
          <h2 className="qed__h">견적서에서는 이렇게 보여요</h2>
          <p className="qed__muted">지금 적은 단가로 계산한 예시</p>
          <div className="qrate__mini">
            <b>{cur.item}{ex?.dosing ? ` (${ex.dosing})` : ""}</b>
            <div><span>표준가</span><span className="tnum">{exPrice != null ? n(exPrice) : "-"}</span></div>
            {exGroups.length > 0 && r("animal")?.add ? <div className="qrate__sub"><span>동물 수 추가 ({exGroups.length * 4}마리)</span><span className="tnum">+ {n(exGroups.length * 4 * (r("animal")!.add ?? 0))}</span></div> : null}
            <div className="qrate__minitotal"><span>합계</span><span className="tnum">{exPrice != null ? n(exPrice + (exGroups.length && r("animal")?.add ? exGroups.length * 4 * (r("animal")!.add ?? 0) : 0)) : "-"}</span></div>
          </div>
          {exGroups.length > 0 && (
            <ul className="qrate__examples">
              {r("animal")?.add ? <li><span>군당 성별 +2마리, {exGroups.length}군</span><b className="tnum">+ {n(exGroups.length * 4 * (r("animal")!.add ?? 0))}</b></li> : null}
              {r("animal")?.deduct ? <li><span>군당 성별 -2마리, {exGroups.length}군</span><b className="tnum">- {n(exGroups.length * 4 * (r("animal")!.deduct ?? 0))}</b></li> : null}
              {r("recovery")?.add ? <li><span>회복군 추가 (10마리)</span><b className="tnum">+ {n(10 * (r("recovery")!.add ?? 0))}</b></li> : null}
              {r("group")?.add ? <li><span>투여군 추가 (1군)</span><b className="tnum">+ {n(r("group")!.add ?? 0)}</b></li> : null}
            </ul>
          )}
          <p className="qed__muted">단가를 바꿔도 이미 만든 견적서 금액은 그대로예요.</p>
        </aside>
      )}
    </div>
  );
}
