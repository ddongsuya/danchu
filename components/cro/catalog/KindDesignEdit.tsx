"use client";

import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import type { CatalogRow } from "@/lib/catalog";
import { kdFromCatalog } from "@/lib/quote-doc";
import { modelsOf } from "@/lib/efficacy";
import {
  COST_KEYS, COST_LABEL, PD_ROLE, PK_MATRIX, PK_PARAMS, PK_TIMES, PK_TYPES, kindOfCategory, kindStdPrice, newPdGroup, newPkGroup, pdLanes, pkSamples,
  type KindDesign, type Lane, type OtherDesign, type PdDesign, type PdRole, type PkDesign,
} from "@/lib/kind-design";

/**
 * 시험 목록에서 효력·약동학·개별 분석의 기관 표준 설계 (2026-11-07).
 * 견적서의 "기관 표준"이 이 값이다. 견적서는 여기서 달라진 칸만 노랗게 표시하고 금액을 맞춘다.
 * - Structure: 질환 모델·군·일정·지표 / 시험 종류·군·채혈·검체 / 시료
 * - Money: 비용 다섯 칸 기준가와 군당·마리당 금액 / 동물 실험·검체당·개발·보고서 / 검체당·접수·보고서
 * 저장하면 lib/catalog-db toDb 가 std_price 를 이 금액에 맞춘다.
 */

type Set = (p: Partial<CatalogRow>) => void;
const digits = (s: string, n = 13) => s.replace(/[^\d]/g, "").slice(0, n);
const n = (v: number) => v.toLocaleString("ko-KR");
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** 이 줄의 갈래 설계. 아직 없으면 기존 칸(군 수·마릿수·시험법)으로 틀을 만든다 */
export function kdOf(r: CatalogRow): KindDesign {
  const k = kindOfCategory(r.category);
  return r.kd && (r.kd.pd || r.kd.pk || r.kd.other) ? r.kd : kdFromCatalog(k, r) ?? {};
}

/** 목록 한 줄의 설계 요약 */
export function kindLine(r: CatalogRow): string {
  const k = kindOfCategory(r.category);
  const kd = r.kd;
  if (k === "pd" && kd?.pd) {
    const g = kd.pd.groups;
    return [kd.pd.model || r.method, g.length ? `${g.length}군` : "", g[0]?.n ? `군당 ${g[0].n}마리` : ""].filter(Boolean).join(" · ");
  }
  if (k === "pk" && kd?.pk) {
    const p = kd.pk, N = pkSamples(p);
    return [p.types.join("·"), p.times.length ? `${p.times.length}시점` : "", p.matrix.join("·"), N ? `${N}검체` : ""].filter(Boolean).join(" · ");
  }
  if (k === "other" && kd?.other) return [kd.other.sample, kd.other.n ? `${kd.other.n}검체 기준` : ""].filter(Boolean).join(" · ");
  return "";
}

/** 목록 금액 칸 */
export function kindPriceLabel(r: CatalogRow): string | null {
  const k = kindOfCategory(r.category);
  if (k === "pd" && r.kd?.pd) { const v = kindStdPrice("pd", r.kd); return v == null ? null : `${n(v)}원`; }
  if (k === "pk" && r.kd?.pk?.perSample != null) return `검체당 ${n(r.kd.pk.perSample)}원`;
  if (k === "other" && r.kd?.other?.perSample != null) return `검체당 ${n(r.kd.other.perSample)}원`;
  return null;
}

function Won({ id, label, value, onChange, help, small }: { id: string; label: React.ReactNode; value: number | null; onChange: (v: number | null) => void; help?: string; small?: boolean }) {
  return (
    <div className={`tk__money${small ? " tk__money--sm" : ""}`}>
      <label htmlFor={id}>{label}{help && <small>{help}</small>}</label>
      <div className="numin">
        <input id={id} type="text" inputMode="numeric" autoComplete="off" placeholder={small ? "0" : "금액"} value={value != null ? n(value) : ""} onChange={(e) => { const v = digits(e.target.value); onChange(v ? Number(v) : null); }} />
        <span>원</span>
      </div>
    </div>
  );
}

function Count({ label, value, onChange, max = 999, unit = "" }: { label: string; value: number; onChange: (v: number) => void; max?: number; unit?: string }) {
  return (
    <div className="numin tk__cnt">
      <input type="text" inputMode="numeric" autoComplete="off" aria-label={label} value={value ? String(value) : ""} placeholder="0" onChange={(e) => { const v = digits(e.target.value, String(max).length); onChange(v ? Math.min(max, Number(v)) : 0); }} />
      {unit && <span>{unit}</span>}
    </div>
  );
}

function Chips({ label, all, on, onChange, own }: { label: string; all: string[]; on: string[]; onChange: (v: string[]) => void; own?: string }) {
  const [typed, setTyped] = useState("");
  const list = [...new Set([...all, ...on])];
  return (
    <div className="fld">
      <span className="fld__lab">{label}</span>
      <div className="chips">{list.map((x) => <button key={x} type="button" className="chip chip--md" aria-pressed={on.includes(x)} onClick={() => onChange(toggle(on, x))}>{x}</button>)}</div>
      {own && (
        <div className="tk__own">
          <input className="inp" aria-label={`${label} 직접 적기`} placeholder={own} value={typed} onChange={(e) => setTyped(e.target.value.slice(0, 40))} onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) { e.preventDefault(); onChange([...new Set([...on, typed.trim()])]); setTyped(""); } }} />
          <button type="button" className="b2 bsm" disabled={!typed.trim()} onClick={() => { onChange([...new Set([...on, typed.trim()])]); setTyped(""); }}>넣기</button>
        </div>
      )}
    </div>
  );
}

/* ── 설계 (구조) ─────────────────────────────────────── */

export function KindStructure({ row, onChange, k }: { row: CatalogRow; onChange: Set; k: string }) {
  const kind = kindOfCategory(row.category);
  const kd = kdOf(row);
  const setKd = (p: KindDesign) => onChange({ kd: { ...kd, ...p } });
  if (kind === "pd" && kd.pd) return <PdStructure pd={kd.pd} models={modelsOf(row.item)} set={(pd) => setKd({ pd })} k={k} onMethod={(m) => onChange({ method: m || null, kd: { ...kd, pd: { ...kd.pd!, model: m } } })} />;
  if (kind === "pk") return <PkStructure pk={kd.pk!} set={(pk) => setKd({ pk })} />;
  if (kind === "other") return <OtherStructure o={kd.other!} set={(other) => setKd({ other })} k={k} />;
  return null;
}

function PdStructure({ pd, models, set, k, onMethod }: { pd: PdDesign; models: string[]; set: (p: PdDesign) => void; k: string; onMethod: (m: string) => void }) {
  const lanes = pd.lanes.length ? pd.lanes : pdLanes();
  const setLane = (id: string, p: Partial<Lane>) => set({ ...pd, lanes: lanes.map((l) => (l.id === id ? { ...l, ...p } : l)) });
  const span = Math.max(1, ...lanes.map((l) => l.start + (l.point ? 1 : l.weeks)));
  const per = pd.groups[0]?.n ?? 0;
  return (
    <>
      <div className="tf__grid">
        <div className="fld">
          <label className="fld__lab" htmlFor={`${k}-model`}>질환 모델</label>
          <input id={`${k}-model`} className="inp" value={pd.model} placeholder="예: DSS 유도 대장염" list={models.length ? `${k}-models` : undefined} onChange={(e) => onMethod(e.target.value.slice(0, 120))} />
          {models.length > 0 && <datalist id={`${k}-models`}>{models.map((m) => <option key={m} value={m} />)}</datalist>}
        </div>
        <div className="fld">
          <label className="fld__lab" htmlFor={`${k}-ind`}>유발 방법</label>
          <input id={`${k}-ind`} className="inp" value={pd.induction} placeholder="예: DSS 3% 음수, 7일" onChange={(e) => set({ ...pd, induction: e.target.value.slice(0, 160) })} />
        </div>
      </div>

      <div className="fld">
        <span className="fld__lab">군 구성 <em className="tk__n">{pd.groups.length}군 · {pd.groups.reduce((a, g) => a + g.n, 0)}마리</em></span>
        <div className="tk__rows">
          <div className="tk__g tk__hd" aria-hidden="true"><span>군</span><span>역할</span><span>처치</span><span className="r">마리</span><span /></div>
          {pd.groups.map((g) => (
            <div key={g.id} className="tk__g">
              <input className="inp" aria-label="군 이름" value={g.label} onChange={(e) => set({ ...pd, groups: pd.groups.map((x) => (x.id === g.id ? { ...x, label: e.target.value.slice(0, 40) } : x)) })} />
              <select className="inp tk__sel" aria-label={`${g.label} 역할`} value={g.role} onChange={(e) => set({ ...pd, groups: pd.groups.map((x) => (x.id === g.id ? { ...x, role: e.target.value as PdRole } : x)) })}>
                {(Object.keys(PD_ROLE) as PdRole[]).map((r) => <option key={r} value={r}>{PD_ROLE[r]}</option>)}
              </select>
              <input className="inp tk__treat" aria-label={`${g.label} 처치`} value={g.treat} placeholder="예: 유발 후 부형제" onChange={(e) => set({ ...pd, groups: pd.groups.map((x) => (x.id === g.id ? { ...x, treat: e.target.value.slice(0, 80) } : x)) })} />
              <Count label={`${g.label} 마리`} value={g.n} max={200} onChange={(v) => set({ ...pd, groups: pd.groups.map((x) => (x.id === g.id ? { ...x, n: v } : x)) })} />
              <button type="button" className="btxt tk__x" aria-label={`${g.label} 빼기`} onClick={() => set({ ...pd, groups: pd.groups.filter((x) => x.id !== g.id) })}><X size={16} aria-hidden="true" /></button>
            </div>
          ))}
        </div>
        <div className="chips">
          {(["test", "positive", "vehicle", "normal"] as PdRole[]).map((r) => <button key={r} type="button" className="chip chip--md" onClick={() => set({ ...pd, groups: [...pd.groups, newPdGroup(r, per)] })}><Plus size={14} aria-hidden="true" /> {PD_ROLE[r]}군</button>)}
        </div>
        <span className="fld__help">정상군은 유발하지 않고, 대조(부형제)군은 유발 뒤 부형제를 줘요.</span>
      </div>

      <div className="fld">
        <span className="fld__lab">일정 <em className="tk__n">주 단위, {span}주</em></span>
        <div className="tk__rows">
          <div className="tk__l tk__hd" aria-hidden="true"><span>단계</span><span className="r">시작 주</span><span className="r">기간</span><span /></div>
          {lanes.map((l) => (
            <div key={l.id} className="tk__l">
              <input className="inp" aria-label="단계 이름" value={l.name} onChange={(e) => setLane(l.id, { name: e.target.value.slice(0, 30) })} />
              <Count label={`${l.name} 시작 주`} value={l.start + 1} max={99} unit="주차" onChange={(v) => setLane(l.id, { start: Math.max(0, v - 1) })} />
              {l.point ? <span className="tk__pt">한 시점</span> : <Count label={`${l.name} 기간`} value={l.weeks} max={99} unit="주" onChange={(v) => setLane(l.id, { weeks: Math.max(1, v) })} />}
              <button type="button" className="btxt tk__x" aria-label={`${l.name} 빼기`} onClick={() => set({ ...pd, lanes: lanes.filter((x) => x.id !== l.id) })}><X size={16} aria-hidden="true" /></button>
            </div>
          ))}
        </div>
        <div className="tk__gantt" aria-hidden="true">
          {lanes.map((l) => (
            <div key={l.id}><span>{l.name}</span><span className="tk__bar">{l.point ? <em style={{ left: `${((l.start + 0.5) / span) * 100}%` }} /> : <i style={{ left: `${(l.start / span) * 100}%`, width: `${(l.weeks / span) * 100}%` }} />}</span></div>
          ))}
        </div>
        <div className="chips">
          <button type="button" className="chip chip--md" onClick={() => set({ ...pd, lanes: [...lanes, { id: `l${Date.now().toString(36)}`, name: "투여", start: span, weeks: 1 }] })}><Plus size={14} aria-hidden="true" /> 기간 단계</button>
          <button type="button" className="chip chip--md" onClick={() => set({ ...pd, lanes: [...lanes, { id: `l${Date.now().toString(36)}`, name: "평가", start: Math.max(0, span - 1), weeks: 1, point: true }] })}><Plus size={14} aria-hidden="true" /> 평가 시점</button>
        </div>
      </div>

      <Chips label="평가 지표" all={["체중", "사료 섭취량", "임상 점수", "혈액학", "혈액생화학", "사이토카인", "조직병리 점수"]} on={pd.endpoints} onChange={(endpoints) => set({ ...pd, endpoints })} own="예: 대장 길이" />
    </>
  );
}

function PkStructure({ pk, set }: { pk: PkDesign; set: (p: PkDesign) => void }) {
  const N = pkSamples(pk);
  return (
    <>
      <Chips label="시험 종류" all={PK_TYPES} on={pk.types} onChange={(types) => set({ ...pk, types })} />
      <div className="fld">
        <span className="fld__lab">표준 군 <em className="tk__n">{pk.groups.length ? `${pk.groups.length}군 · ${pk.groups.reduce((a, g) => a + g.n, 0)}마리` : "비우면 요청마다 정해요"}</em></span>
        {pk.groups.length > 0 && (
          <div className="tk__rows">
            <div className="tk__k tk__hd" aria-hidden="true"><span>군</span><span>경로</span><span>용량</span><span className="r">마리</span><span /></div>
            {pk.groups.map((g) => (
              <div key={g.id} className="tk__k">
                <input className="inp" aria-label="군 이름" value={g.label} onChange={(e) => set({ ...pk, groups: pk.groups.map((x) => (x.id === g.id ? { ...x, label: e.target.value.slice(0, 40) } : x)) })} />
                <input className="inp" aria-label={`${g.label} 경로`} value={g.route} placeholder="정맥" onChange={(e) => set({ ...pk, groups: pk.groups.map((x) => (x.id === g.id ? { ...x, route: e.target.value.slice(0, 40) } : x)) })} />
                <input className="inp" aria-label={`${g.label} 용량`} value={g.dose} placeholder="mg/kg" onChange={(e) => set({ ...pk, groups: pk.groups.map((x) => (x.id === g.id ? { ...x, dose: e.target.value.slice(0, 40) } : x)) })} />
                <Count label={`${g.label} 마리`} value={g.n} max={200} onChange={(v) => set({ ...pk, groups: pk.groups.map((x) => (x.id === g.id ? { ...x, n: v } : x)) })} />
                <button type="button" className="btxt tk__x" aria-label={`${g.label} 빼기`} onClick={() => set({ ...pk, groups: pk.groups.filter((x) => x.id !== g.id) })}><X size={16} aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="chips"><button type="button" className="chip chip--md" onClick={() => set({ ...pk, groups: [...pk.groups, newPkGroup(pk.groups[0]?.n ?? 0)] })}><Plus size={14} aria-hidden="true" /> 군 추가</button></div>
      </div>
      <Chips label="채혈 시점" all={PK_TIMES} on={pk.times} onChange={(times) => set({ ...pk, times })} own="예: 72시간" />
      <Chips label="검체" all={PK_MATRIX} on={pk.matrix} onChange={(matrix) => set({ ...pk, matrix })} />
      <Chips label="받을 파라미터" all={PK_PARAMS} on={pk.params} onChange={(params) => set({ ...pk, params })} />
      {N > 0 && <p className="tk__calc tnum">기관 표준 검체 수: {pk.groups.reduce((a, g) => a + g.n, 0)}마리 × {pk.times.length}시점{pk.matrix.length > 1 ? ` × ${pk.matrix.length}종` : ""} = <b>{N}검체</b></p>}
    </>
  );
}

function OtherStructure({ o, set, k }: { o: OtherDesign; set: (p: OtherDesign) => void; k: string }) {
  return (
    <div className="tf__grid">
      <div className="fld">
        <label className="fld__lab" htmlFor={`${k}-smp`}>받는 시료</label>
        <input id={`${k}-smp`} className="inp" value={o.sample} placeholder="예: 랫드 간·신장 조직" onChange={(e) => set({ ...o, sample: e.target.value.slice(0, 80) })} />
      </div>
      <div className="fld">
        <label className="fld__lab" htmlFor={`${k}-sn`}>표준 검체 수 <em className="tk__n">선택</em></label>
        <div className="numin"><input id={`${k}-sn`} type="text" inputMode="numeric" value={o.n ? String(o.n) : ""} placeholder="비우면 요청마다" onChange={(e) => { const v = digits(e.target.value, 5); set({ ...o, n: v ? Number(v) : 0 }); }} /><span>검체</span></div>
      </div>
    </div>
  );
}

/* ── 금액 ───────────────────────────────────────────── */

export function KindMoney({ row, onChange, k }: { row: CatalogRow; onChange: Set; k: string }) {
  const kind = kindOfCategory(row.category);
  const kd = kdOf(row);
  const setKd = (p: KindDesign) => onChange({ kd: { ...kd, ...p } });
  if (kind === "pd" && kd.pd) {
    const pd = kd.pd;
    const sum = kindStdPrice("pd", kd);
    return (
      <>
        <div className="tk__costs">
          <div className="tk__c tk__hd" aria-hidden="true"><span>비용 칸</span><span className="r">{pd.groups.length}군 기준 금액</span><span className="r">군 하나 늘 때</span></div>
          {COST_KEYS.map((c) => (
            <div key={c} className="tk__c">
              <span className="tk__cl"><b>{COST_LABEL[c][0]}</b><small>{COST_LABEL[c][1]}</small></span>
              <div className="numin"><input type="text" inputMode="numeric" autoComplete="off" aria-label={`${COST_LABEL[c][0]} 기준 금액`} placeholder="금액" value={pd.costs[c] != null ? n(pd.costs[c]!) : ""} onChange={(e) => { const v = digits(e.target.value); setKd({ pd: { ...pd, costs: { ...pd.costs, [c]: v ? Number(v) : null } } }); }} /><span>원</span></div>
              <div className="numin"><input type="text" inputMode="numeric" autoComplete="off" aria-label={`${COST_LABEL[c][0]} 군당 금액`} placeholder="0" value={pd.perGroup[c] != null ? n(pd.perGroup[c]!) : ""} onChange={(e) => { const v = digits(e.target.value); setKd({ pd: { ...pd, perGroup: { ...pd.perGroup, [c]: v ? Number(v) : null } } }); }} /><span>원</span></div>
            </div>
          ))}
        </div>
        <Won id={`${k}-pa`} label="동물 한 마리 늘 때" help="동물·모델 유발 칸에 더해요" value={pd.perAnimal} onChange={(v) => setKd({ pd: { ...pd, perAnimal: v } })} small />
        <p className="tk__sum tnum"><span>표준가 (다섯 칸 합, VAT 별도)</span><b>{sum != null ? `${n(sum)}원` : "칸을 채우면 계산돼요"}</b></p>
        <p className="td__mut">견적서에서 군이나 동물 수가 달라지면 군당·마리당 금액으로 칸마다 맞춰요. 비운 칸은 그대로 둬요.</p>
      </>
    );
  }
  if (kind === "pk") {
    const pk = kd.pk!;
    const N = pkSamples(pk);
    return (
      <>
        <div className="tk__ms">
          <Won id={`${k}-an`} label="동물 실험" help="투여·채혈" value={pk.animal} onChange={(v) => setKd({ pk: { ...pk, animal: v } })} />
          <Won id={`${k}-ps`} label="검체당 분석 단가" value={pk.perSample} onChange={(v) => setKd({ pk: { ...pk, perSample: v } })} />
          <Won id={`${k}-dv`} label="분석법 개발" help="의뢰자 분석법이 없을 때만" value={pk.dev} onChange={(v) => setKd({ pk: { ...pk, dev: v } })} />
          <Won id={`${k}-rp`} label="파라미터 분석·보고서" value={pk.report} onChange={(v) => setKd({ pk: { ...pk, report: v } })} />
        </div>
        <p className="tk__sum tnum"><span>견적 금액 = 동물 실험 + 보고서 + 검체 수 × 검체당{pk.dev ? " (+ 개발)" : ""}</span><b>{N && pk.perSample != null ? `기관 표준 ${n((pk.animal ?? 0) + (pk.report ?? 0) + N * pk.perSample)}원` : ""}</b></p>
      </>
    );
  }
  if (kind === "other") {
    const o = kd.other!;
    return (
      <>
        <div className="tk__ms">
          <Won id={`${k}-ops`} label="검체당 분석 단가" value={o.perSample} onChange={(v) => setKd({ other: { ...o, perSample: v } })} />
          <Won id={`${k}-ost`} label="시료 접수·보관" help="한 번" value={o.setup} onChange={(v) => setKd({ other: { ...o, setup: v } })} />
          <Won id={`${k}-orp`} label="결과 보고서" help="한 번" value={o.report} onChange={(v) => setKd({ other: { ...o, report: v } })} />
        </div>
        <p className="tk__sum tnum"><span>견적 금액 = 검체 수 × 검체당 + 접수·보관 + 보고서</span><b>{o.n && o.perSample != null ? `${o.n}검체 ${n(o.n * o.perSample + (o.setup ?? 0) + (o.report ?? 0))}원` : ""}</b></p>
      </>
    );
  }
  return null;
}
