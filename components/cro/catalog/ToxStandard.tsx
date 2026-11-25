"use client";

/**
 * 독성시험 표준 설계 (2026-11-26). 효력 모델 표준(ModelStandard)과 같은 판.
 * 왼쪽: 조건 → 군 구성(군마다 이름·용량·회복) → 평가항목 → 따로 받는 항목 → 추가 비용 단가 → 기관 설명.
 * 오른쪽: 표준가·소요 기간과 저장. 견적서는 이 설계에서 시작하고(lib/quote-doc standardGroups), 달라진 곳만 단가로 더하거나 뺀다.
 * 군 이름·용량·회복 여부는 cro_catalog.extra.kd.tox 에 둔다 (DB 변경 없음).
 */
import Link from "next/link";
import { useState } from "react";
import { RfqField } from "@/components/RfqField";
import { Chevron } from "@/components/Chevron";
import { EXTRA_FIELDS, isNewId, type CatalogRow } from "@/lib/catalog";
import { defaultGroupNames, defaultRates, standardGroups, uid, type Rate } from "@/lib/quote-doc";
import type { ToxGroup } from "@/lib/kind-design";
import type { PriceItem } from "@/lib/price-book";
import { animalPriceFor } from "@/lib/tox-price";
import type { Cat, Values } from "@/lib/rfq-schema";
import { CondPick, CondPrices, DesignFields, IncludesField, Int, MethodField, Money, OptionsField, RateRow, baseLabel, multi, postJson, priceOf } from "./TestList";
import { TIn } from "./ModelStandard";

type Props = {
  row: CatalogRow;
  /** 같은 시험의 줄들 (저장은 시험 단위로 보낸다) */
  siblings: CatalogRow[];
  rates?: Rate[];
  /** 단가표 (독성 동물 단가에도 쓰는 기관이면 빈 단가 칸에 단가표 금액을 보인다) */
  book: { applyTox: boolean; items: PriceItem[] } | null;
  readOnly?: boolean;
  /** 검토 화면용: 서버에 보내지 않는다 */
  local?: boolean;
};

const won = (n: number) => n.toLocaleString("ko-KR");
const FROM_BOOK = new Set<Rate["kind"]>(["animal", "recovery"]);

export function ToxStandard({ row: initial, siblings, rates, book, readOnly = false, local = false }: Props) {
  const [d, setD] = useState<CatalogRow>({ ...initial, std_price: priceOf(initial) });
  const [rs, setRs] = useState<Rate[] | null>(rates?.length ? rates : null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const set = (p: Partial<CatalogRow>) => { setD((s) => ({ ...s, ...p })); setDirty(true); setNote(null); };

  const groups = standardGroups(d);
  const hasGroups = groups.length > 0;
  const list = rs ?? defaultRates(hasGroups);
  const setRate = (id: string, p: Partial<Rate>) => { setRs(list.map((r) => (r.id === id ? { ...r, ...p } : r))); setDirty(true); setNote(null); };
  const nc = d.groups_ctrl ?? 0;
  const names = defaultGroupNames(nc, d.groups_test ?? 0);
  const recOn = !!d.recovery_weeks && !!d.recovery_per_sex;
  const main = groups.reduce((a, g) => a + g.m + g.f, 0);
  const rec = groups.reduce((a, g) => a + g.rm + g.rf, 0);
  const extras = EXTRA_FIELDS[d.category as Cat] ?? [];
  const perSample = d.unit === "per_sample";

  /** 군 이름·용량·회복 여부. 고친 칸만 남는다 (회복 여부를 건드리지 않은 군은 기본 규칙을 따른다) */
  const setGroup = (i: number, p: Partial<ToxGroup>) => {
    const cur = d.kd?.tox?.groups ?? [];
    const next = names.map((name, j) => {
      const g = cur[j] ?? { label: name, dose: j < nc ? "0" : "" };
      return j === i ? { ...g, ...p } : g;
    });
    set({ kd: { ...d.kd, tox: { groups: next } } });
  };

  // 단가표에서 채울 동물 단가 (설정이 켜져 있을 때만, 견적서에서 빈 칸을 이 금액으로 채운다)
  const fromBook = book?.applyTox ? d.species.flatMap((sp) => { const it = animalPriceFor(book.items, sp); return it ? [{ sp, price: it.price }] : []; }) : [];
  const empty = (r: Rate) => FROM_BOOK.has(r.kind) && r.add == null;
  const hintFor = (r: Rate) => (empty(r) && fromBook[0]?.sp === d.species[0] ? won(fromBook[0].price) : undefined);
  const spHintsFor = (r: Rate) => (empty(r) ? Object.fromEntries(fromBook.filter((x) => x.sp !== d.species[0]).map((x) => [x.sp, won(x.price)])) : undefined);
  const bookUsed = fromBook.length > 0 && list.some(empty);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      // 군 수보다 많이 남은 군 설정은 버린다
      const tox = d.kd?.tox ? { groups: d.kd.tox.groups.slice(0, names.length) } : undefined;
      const next: CatalogRow = { ...d, kd: tox ? { ...d.kd, tox } : d.kd };
      const sendRates = rs ?? (list.some((r) => r.add != null || r.deduct != null) ? list : undefined);
      if (local) {
        setD(next);
        setDirty(false);
        setNote("표준으로 저장했어요.");
        return;
      }
      const same = siblings.map((r) => (r.id === next.id ? next : r));
      const res = await postJson<{ rows?: CatalogRow[] }>("/api/cro/catalog", { rows: same.some((r) => r.id === next.id) ? same : [...same, next], removed: [] });
      if (sendRates) await postJson("/api/cro/rates", { itemKey: next.item_key, prices: [], rates: sendRates });
      const saved = res.rows?.find((r) => r.id === next.id);
      if (saved) setD({ ...saved, std_price: priceOf(saved) });
      setDirty(false);
      setNote("표준으로 저장했어요.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const k = d.id;
  return (
    <div className="ms tx">
      <header className="ms__head">
        <div>
          <span className="ms__crumb"><Link href="/cro/catalog">시험 목록</Link> / {d.category}</span>
          <div className="ms__title">
            <h1 className="tx__h1">{d.item}</h1>
            <span className="ms__chip">표준 설계</span>
          </div>
        </div>
      </header>

      <div className="ms__grid">
        <div className="ms__main">
          <section aria-labelledby="tx-cond" className="tx__sec">
            <div className="ms__sec"><h2 id="tx-cond">조건</h2></div>
            <div className="tx__body">
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
              <CondPrices row={d} onChange={set} k={k} perSample={perSample} />
            </div>
          </section>

          <section aria-labelledby="tx-groups" className="tx__sec">
            <div className="ms__sec">
              <h2 id="tx-groups">군 구성</h2>
              {hasGroups && <span className="ms__mut ms__num">{groups.length}군, {main}마리{rec ? ` + 회복 ${rec}마리` : ""}</span>}
            </div>
            <div className="tx__body">
              <div className="tx__nums"><DesignFields row={d} onChange={set} k={k} /></div>
              {hasGroups ? (
                <div className="ms__tw">
                  <table className="ms__t tx__t">
                    <thead>
                      <tr>
                        <th scope="col">군</th><th scope="col">이름</th><th scope="col">용량</th>
                        <th scope="col" className="r">본시험 (암수 각)</th>
                        {recOn && <th scope="col" className="r">회복 (암수 각)</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g, i) => (
                        <tr key={g.id}>
                          <td className="ms__num">G{i + 1}</td>
                          <td className="tx__name"><TIn label={`G${i + 1} 이름`} value={g.label.replace(/^G\d+\s/, "")} placeholder={names[i]} max={40} onChange={(v) => setGroup(i, { label: v })} disabled={readOnly} /></td>
                          <td className="tx__dose"><TIn label={`G${i + 1} 용량`} value={g.dose} placeholder="예: 100 mg/kg" max={40} onChange={(v) => setGroup(i, { dose: v })} disabled={readOnly} /></td>
                          <td className="r ms__num">{g.m}마리</td>
                          {recOn && (
                            <td className="r">
                              <button type="button" className="ms__opt tx__rec" aria-pressed={g.rm > 0} aria-label={`G${i + 1} 회복 동물`} onClick={() => setGroup(i, { rec: !(g.rm > 0) })} disabled={readOnly}>
                                {g.rm > 0 ? `${g.rm}마리` : "없음"}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="ms__empty">대조군·시험군 수를 적으면 군이 생겨요. 동물을 쓰지 않는 시험은 비워 두세요.</div>
              )}
              {recOn && <p className="ms__mut">회복 동물은 기본으로 대조군과 최고용량군에 둬요. 다른 군에 두려면 회복 칸을 눌러 바꿔요.</p>}
            </div>
          </section>

          <section aria-labelledby="tx-evals" className="tx__sec">
            <div className="ms__sec"><h2 id="tx-evals">평가항목</h2><span className="ms__mut">켠 항목이 표준가에 들어 있어요</span></div>
            <div className="tx__body"><IncludesField row={d} onChange={set} label="" /></div>
          </section>

          <section aria-labelledby="tx-opts" className="tx__sec">
            <div className="ms__sec"><h2 id="tx-opts">따로 받는 항목</h2><span className="ms__mut">견적서에서 켜면 이 금액을 더해요</span></div>
            <div className="tx__body"><OptionsField row={d} onChange={set} label="" /></div>
          </section>

          <section aria-labelledby="tx-rates" className="tx__sec">
            <div className="ms__sec"><h2 id="tx-rates">추가 비용 단가</h2><span className="ms__mut">설계와 달라진 만큼 견적서 금액을 맞춰요</span></div>
            <div className="tx__body">
              {list.length > 0 && (
                <div className="td__rates">
                  <span aria-hidden="true" /><span className="td__rh" aria-hidden="true">1{list[0]?.unit ?? "마리"}당 추가</span><span className="td__rh" aria-hidden="true">차감</span>
                  {list.map((r) => <RateRow key={r.id} r={r} species={d.species} onChange={(p) => setRate(r.id, p)} addHint={hintFor(r)} spHints={spHintsFor(r)} />)}
                </div>
              )}
              <div className="tx__notes">
                <p className="ms__mut">차감을 비우면 추가와 같은 금액을 빼고, 0을 적으면 빼지 않아요.</p>
                {bookUsed && (
                  <p className="tx__book">
                    비워 둔 동물 단가는 <Link href="/cro/prices">단가표</Link> 금액으로 계산해요. {fromBook.map((x) => `${x.sp} ${won(x.price)}원`).join(", ")}
                  </p>
                )}
              </div>
              {!readOnly && (
                <div className="tx__adds">
                  <button type="button" className="td__link" onClick={() => { setRs([...list, { id: uid("r"), kind: "flat", label: "", unit: "시험", add: null, deduct: null, shown: "" }]); setDirty(true); }}>+ 평가항목 추가</button>
                  <button type="button" className="td__link" onClick={() => { setRs([...list, { id: uid("r"), kind: "qty", label: "", unit: "건", add: null, deduct: null, shown: "" }]); setDirty(true); }}>+ 수량 항목 추가</button>
                </div>
              )}
            </div>
          </section>

          {extras.length > 0 && (
            <section aria-labelledby="tx-exp" className="tx__sec">
              <div className="ms__sec"><h2 id="tx-exp">기관 설명</h2><span className="ms__mut">비교표에 기관 설명으로 나란히 보여요</span></div>
              <div className="tx__body tx__exp">
                {extras.map((f) => <RfqField key={f.id} field={f} id={f.id} values={d.extra as Values} onChange={(id, v) => set({ extra: { ...d.extra, [id]: v as string | string[] } })} />)}
              </div>
            </section>
          )}

          <section aria-labelledby="tx-note" className="tx__sec">
            <div className="ms__sec"><h2 id="tx-note">비고</h2></div>
            <input id={`${k}-note`} aria-labelledby="tx-note" className="inp" value={d.note ?? ""} onChange={(e) => set({ note: e.target.value.slice(0, 500) || null })} placeholder="초안에 함께 적을 말 (예: 표준품은 의뢰자 제공)" />
          </section>
        </div>

        <aside className="ms__led tx__led" aria-labelledby="tx-led">
          <div className="ms__lh"><span id="tx-led">표준가</span><span className="ms__mut">부가세 별도</span></div>
          <Money id={`${k}-price`} label={multi(d) ? `${baseLabel(d)} 기준` : perSample ? "검체당 단가" : "이 설계 금액"} value={d.std_price ?? null} onChange={(v) => set({ std_price: v })} help={multi(d) ? "다른 조건 금액은 조건 아래에 적어요" : "이 설계 그대로일 때 금액"} />
          <Int id={`${k}-wk`} label="소요 기간" value={d.weeks} onChange={(v) => set({ weeks: v })} unit="주" max={200} />
          <dl className="tx__sum">
            <div><dt>군</dt><dd className="ms__num">{hasGroups ? `${groups.length}군` : "-"}</dd></div>
            <div><dt>본시험 동물</dt><dd className="ms__num">{hasGroups ? `${main}마리` : "-"}</dd></div>
            <div><dt>회복 동물</dt><dd className="ms__num">{rec ? `${rec}마리` : "-"}</dd></div>
            <div><dt>평가항목</dt><dd className="ms__num">{d.includes.length}개</dd></div>
          </dl>
          {err && <p className="fld__err" role="alert">{err}</p>}
          <p className="ms__note" aria-live="polite">{note}</p>
          <button type="button" className="b1 ms__save" onClick={() => void save()} disabled={readOnly || busy || (!dirty && !isNewId(d.id))} aria-busy={busy}>
            {busy ? "저장 중" : "표준으로 저장"}
          </button>
        </aside>
      </div>
    </div>
  );
}
