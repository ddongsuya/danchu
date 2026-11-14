"use client";

import { useState } from "react";
import { Minus, Plus, X } from "@phosphor-icons/react";
import {
  COST_KEYS, COST_LABEL, PD_ROLE, PK_MATRIX, PK_PARAMS, PK_TIMES, PK_TYPES, emptyOther, emptyPk, kindStdPrice, newPdGroup, newPkGroup, pdParts, pkSamples,
  type CostKey, type Kind, type KindDesign, type Lane, type OtherDesign, type PdDesign, type PdRole, type PkDesign,
} from "@/lib/kind-design";
import type { DocTest } from "@/lib/quote-doc";

/**
 * 견적서 질문 화면의 갈래별 질문 (2026-11-07 시안 2판).
 * 효력: 군 구성 · 일정 · 비용 다섯 칸 / 약동학: 채혈 · 분석 / 개별 분석: 검체 / 모든 갈래: 의뢰자에게 남길 말.
 * 노란 칸은 기관 표준(시험 목록)과 달라진 곳. 의뢰자 원안은 위에 따로 보여 준다.
 */

const n = (v: number) => v.toLocaleString("ko-KR");
const digits = (s: string, max = 12) => s.replace(/[^\d]/g, "").slice(0, max);
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
type Set = (p: Partial<DocTest> | ((t: DocTest) => DocTest)) => void;

export function Stepper({ label, value, was, onChange, disabled, min = 0, unit }: { label: string; value: number; was?: number; onChange: (v: number) => void; disabled: boolean; min?: number; unit?: string }) {
  const changed = was !== undefined && was !== value;
  return (
    <span className={`qf__step${changed ? " is-ch" : ""}`} role="group" aria-label={label}>
      <button type="button" aria-label="줄이기" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}><Minus size={14} aria-hidden="true" /></button>
      <span className="tnum">{changed && <s>{was}</s>}{value}{unit ? <small> {unit}</small> : null}</span>
      <button type="button" aria-label="늘리기" disabled={disabled || value >= 999} onClick={() => onChange(value + 1)}><Plus size={14} aria-hidden="true" /></button>
    </span>
  );
}

export function Money({ id, label, value, onChange, disabled, hl, help }: { id: string; label: React.ReactNode; value: number | null; onChange: (v: number | null) => void; disabled: boolean; hl?: boolean; help?: string }) {
  return (
    <div className="qf__q">
      <label className="qf__lab" htmlFor={id}>{label}</label>
      <div className={`numin${hl ? " is-ch" : ""}`}><input id={id} type="text" inputMode="numeric" placeholder="금액" disabled={disabled} value={value != null ? n(value) : ""} onChange={(e) => { const v = digits(e.target.value); onChange(v ? Number(v) : null); }} /><span>원</span></div>
      {help && <span className="qf__help">{help}</span>}
    </div>
  );
}

/** 받은 요청의 의뢰자 원안 */
export function OrigBox({ t }: { t: DocTest }) {
  if (!t.orig?.lines.length) return null;
  // 한 줄로 접어 두고, 눌러서 펼친다 (휴대폰에서 질문이 밀려 내려가지 않게)
  return (
    <details className="qf__orig">
      <summary><b>의뢰자 원안</b><span>{t.orig.lines.map(([, v]) => v).join(" · ")}</span></summary>
      <dl>{t.orig.lines.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </details>
  );
}

/* ── 질문 화면 바꾸기 단계의 탭 ── */

export type KTab = "pd-groups" | "pd-plan" | "pd-cost" | "pk-groups" | "pk-sample" | "pk-assay" | "other" | "notes";

export function kindTabs(k: Kind): [KTab, string][] {
  if (k === "pd") return [["pd-groups", "군 구성"], ["pd-plan", "일정·지표"], ["pd-cost", "비용"], ["notes", "의뢰자에게"]];
  if (k === "pk") return [["pk-groups", "군 구성"], ["pk-sample", "채혈"], ["pk-assay", "검체·분석"], ["notes", "의뢰자에게"]];
  if (k === "other") return [["other", "검체"], ["notes", "의뢰자에게"]];
  return [["notes", "의뢰자에게"]];
}

export function KindTab({ tab, t, readOnly, set }: { tab: KTab; t: DocTest; readOnly: boolean; set: Set }) {
  const setPd = (f: (p: PdDesign) => PdDesign) => set((x) => (x.kd?.pd ? { ...x, kd: { ...x.kd, pd: f(x.kd.pd) } } : x));
  const setPk = (f: (p: PkDesign) => PkDesign) => set((x) => ({ ...x, kd: { ...x.kd, pk: f(x.kd?.pk ?? emptyPk()) } }));
  const setOt = (f: (p: OtherDesign) => OtherDesign) => set((x) => ({ ...x, kd: { ...x.kd, other: f(x.kd?.other ?? emptyOther()) } }));
  if (tab === "notes") return <NotesQ t={t} readOnly={readOnly} set={set} />;
  if (tab.startsWith("pd-") && t.kd?.pd) {
    if (tab === "pd-groups") return <PdGroupsQ pd={t.kd.pd} std={t.std.kd?.pd} orig={t.orig} readOnly={readOnly} setPd={setPd} />;
    if (tab === "pd-plan") return <PdPlanQ pd={t.kd.pd} std={t.std.kd?.pd} readOnly={readOnly} setPd={setPd} set={set} />;
    return <PdCostQ pd={t.kd.pd} std={t.std.kd?.pd} readOnly={readOnly} setPd={setPd} uid={t.uid} />;
  }
  if (tab === "pk-groups") return <PkSampleQ part="groups" pk={t.kd?.pk ?? emptyPk()} std={t.std.kd?.pk} times0={t.orig?.times} readOnly={readOnly} setPk={setPk} />;
  if (tab === "pk-sample") return <PkSampleQ part="times" pk={t.kd?.pk ?? emptyPk()} std={t.std.kd?.pk} times0={t.orig?.times} readOnly={readOnly} setPk={setPk} />;
  if (tab === "pk-assay") return <PkAssayQ pk={t.kd?.pk ?? emptyPk()} readOnly={readOnly} setPk={setPk} uid={t.uid} />;
  if (tab === "other") return <OtherQ o={t.kd?.other ?? emptyOther()} samples0={t.orig?.samples} readOnly={readOnly} setOt={setOt} uid={t.uid} />;
  return null;
}

/* ── 효력 ── */

function PdGroupsQ({ pd, std, orig, readOnly, setPd }: { pd: PdDesign; std?: PdDesign; orig?: DocTest["orig"]; readOnly: boolean; setPd: (f: (p: PdDesign) => PdDesign) => void }) {
  const stdById = new Map((std?.groups ?? []).map((g) => [g.id, g]));
  const setG = (id: string, p: Partial<PdDesign["groups"][number]>) => setPd((x) => ({ ...x, groups: x.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) }));
  const per = std?.groups[0]?.n ?? pd.groups[0]?.n ?? 0;
  const total = pd.groups.reduce((a, g) => a + g.n, 0);
  const hasNormal = pd.groups.some((g) => g.role === "normal"), hasVeh = pd.groups.some((g) => g.role === "vehicle");
  return (
    <div className="qf__q">
      <div className="qf__pdg qf__pdg--hd" aria-hidden="true"><span>군</span><span className="qf__c3">처치</span><span>군당 수</span></div>
      {pd.groups.map((g) => {
        const s = stdById.get(g.id);
        return (
          <div key={g.id} className={`qf__pdg${!s ? " is-add" : ""}`}>
            <span className="qf__gname">
              <input className="inp qf__gl" aria-label="군 이름" value={g.label} disabled={readOnly} onChange={(e) => setG(g.id, { label: e.target.value.slice(0, 40) })} />
              <select className="qf__role" aria-label={`${g.label} 역할`} value={g.role} disabled={readOnly} onChange={(e) => setG(g.id, { role: e.target.value as PdRole })}>
                {(Object.keys(PD_ROLE) as PdRole[]).map((r) => <option key={r} value={r}>{PD_ROLE[r]}</option>)}
              </select>
              <button type="button" className="qf__gx" aria-label={`${g.label} 빼기`} disabled={readOnly || pd.groups.length <= 1} onClick={() => setPd((x) => ({ ...x, groups: x.groups.filter((y) => y.id !== g.id) }))}><X size={12} aria-hidden="true" /></button>
            </span>
            <input className="inp qf__dose qf__c3" aria-label={`${g.label} 처치`} value={g.treat} placeholder="예: 유발 후 시험물질" disabled={readOnly} onChange={(e) => setG(g.id, { treat: e.target.value.slice(0, 80) })} />
            <Stepper label={`${g.label} 군당 수`} value={g.n} was={s ? s.n : undefined} disabled={readOnly} onChange={(v) => setG(g.id, { n: v })} />
          </div>
        );
      })}
      <span className="qf__help tnum">
        {pd.groups.length}군, {total}마리{std ? (pd.groups.length !== std.groups.length ? `. 기관 표준 ${std.groups.length}군에서 ${pd.groups.length > std.groups.length ? "늘었어요" : "줄었어요"}` : ". 기관 표준과 동일한 군 수") : ""}
        {orig?.groups ? ` (원안 ${orig.groups}군${orig.perGroup ? `, 군당 ${orig.perGroup}마리` : ""})` : ""}.
      </span>
      {hasNormal && hasVeh && <span className="qf__help">정상군은 유발하지 않고, 부형제군은 유발한 뒤 부형제를 줘요.</span>}
      {!readOnly && (
        <div className="chips">
          {(["test", "positive", "vehicle", "normal"] as PdRole[]).map((r) => <button key={r} type="button" className="chip" onClick={() => setPd((x) => ({ ...x, groups: [...x.groups, { ...newPdGroup(r, per), treat: x.groups.find((g) => g.role === r)?.treat ?? "" }] }))}><Plus size={13} aria-hidden="true" /> {PD_ROLE[r]}군</button>)}
        </div>
      )}
    </div>
  );
}

function PdPlanQ({ pd, std, readOnly, setPd, set }: { pd: PdDesign; std?: PdDesign; readOnly: boolean; setPd: (f: (p: PdDesign) => PdDesign) => void; set: Set }) {
  const [ep, setEp] = useState("");
  // 일정은 견적서 4부(일정표)와 같은 값. 바꾸면 시험의 단계도 함께 바꾼다
  const setLanes = (lanes: Lane[]) => set((x) => (x.kd?.pd ? {
    ...x,
    kd: { ...x.kd, pd: { ...x.kd.pd, lanes } },
    phases: lanes.map((l) => ({ id: l.id, name: l.name, start: l.start, weeks: l.weeks, kind: l.point ? "point" as const : "run" as const })),
    weeks: lanes.length ? Math.max(...lanes.map((l) => l.start + (l.point ? 1 : l.weeks))) : x.weeks,
  } : x));
  const W = Math.max(4, ...pd.lanes.map((l) => l.start + (l.point ? 1 : l.weeks)));
  const stdLane = new Map((std?.lanes ?? []).map((l) => [l.id, l]));
  return (
    <>
      <div className="qf__q">
        <span className="qf__lab">일정 <span className="qf__opt">주 단위, 1주부터</span></span>
        <div className="qf__lanes">
          {pd.lanes.map((l) => {
            const s = stdLane.get(l.id);
            return (
              <div key={l.id} className="qf__lane">
                <span className="qf__gname">
                  <input className="inp qf__gl" aria-label="단계 이름" value={l.name} disabled={readOnly} onChange={(e) => setLanes(pd.lanes.map((x) => (x.id === l.id ? { ...x, name: e.target.value.slice(0, 30) } : x)))} />
                  <button type="button" className="qf__gx" aria-label={`${l.name} 빼기`} disabled={readOnly} onClick={() => setLanes(pd.lanes.filter((x) => x.id !== l.id))}><X size={12} aria-hidden="true" /></button>
                </span>
                <Stepper label={`${l.name} 시작 주`} value={l.start + 1} was={s ? s.start + 1 : undefined} min={1} unit="주차" disabled={readOnly} onChange={(v) => setLanes(pd.lanes.map((x) => (x.id === l.id ? { ...x, start: Math.max(0, v - 1) } : x)))} />
                {l.point ? <span className="qf__help qf__c3">한 시점</span> : <Stepper label={`${l.name} 기간`} value={l.weeks} was={s ? s.weeks : undefined} min={1} unit="주" disabled={readOnly} onChange={(v) => setLanes(pd.lanes.map((x) => (x.id === l.id ? { ...x, weeks: Math.max(1, v) } : x)))} />}
              </div>
            );
          })}
        </div>
        <div className="qf__gantt" aria-hidden="true">
          {pd.lanes.map((l) => (
            <div key={l.id}><span>{l.name}</span><div className="qf__bar">{l.point ? <em style={{ left: `${((l.start + 0.5) / W) * 100}%` }} /> : <i style={{ left: `${(l.start / W) * 100}%`, width: `${(l.weeks / W) * 100}%` }} />}</div></div>
          ))}
        </div>
        {!readOnly && <button type="button" className="qf__lk qf__self" onClick={() => setLanes([...pd.lanes, { id: `l${Date.now().toString(36)}`, name: "평가", start: 0, weeks: 1, point: true }])}><Plus size={14} aria-hidden="true" /> 시점 추가</button>}
      </div>
      <div className="qf__q">
        <span className="qf__lab">평가 지표</span>
        <div className="chips">
          {pd.endpoints.map((e) => <button key={e} type="button" className="chip" aria-pressed="true" disabled={readOnly} aria-label={`${e} 빼기`} onClick={() => setPd((x) => ({ ...x, endpoints: x.endpoints.filter((y) => y !== e) }))}>{e} <X size={12} aria-hidden="true" /></button>)}
        </div>
        <div className="qf__own">
          <input className="inp" aria-label="평가 지표 추가" placeholder="예: 대장 길이" value={ep} disabled={readOnly} onChange={(e) => setEp(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && ep.trim()) { e.preventDefault(); setPd((x) => ({ ...x, endpoints: [...new Set([...x.endpoints, ep.trim().slice(0, 80)])] })); setEp(""); } }} />
          <button type="button" className="b2" disabled={readOnly || !ep.trim()} onClick={() => { setPd((x) => ({ ...x, endpoints: [...new Set([...x.endpoints, ep.trim().slice(0, 80)])] })); setEp(""); }}>넣기</button>
        </div>
        <span className="qf__help">금액이 드는 선택 지표는 시험 목록의 &quot;따로 받는 항목&quot;으로 적어 두면 여기서 켤 수 있어요.</span>
      </div>
    </>
  );
}

function PdCostQ({ pd, std, readOnly, setPd, uid }: { pd: PdDesign; std?: PdDesign; readOnly: boolean; setPd: (f: (p: PdDesign) => PdDesign) => void; uid: string }) {
  const parts = pdParts(pd, std);
  const setOv = (k: CostKey, v: number | null) => setPd((x) => {
    const o = { ...(x.override ?? {}) };
    const calc = pdParts({ ...x, override: undefined }, std).find((p) => p.key === k)?.calc;
    if (v == null || v === calc) delete o[k]; else o[k] = v;
    return { ...x, override: Object.keys(o).length ? o : undefined };
  });
  return (
    <div className="qf__q">
      <div className="qf__cst qf__cst--hd" aria-hidden="true"><span>항목</span><span className="r qf__c3">기준가</span><span className="qf__c3">조정</span><span className="r">금액</span></div>
      {parts.map((p) => (
        <div key={p.key} className="qf__cst">
          <span className="qf__pt"><b>{p.label}</b><span className="qf__sub">{p.desc}</span></span>
          <span className="r qf__help tnum qf__c3">{p.base != null ? n(p.base) : "-"}</span>
          <span className="qf__help qf__c3">{p.adj}</span>
          <div className={`numin${p.changed ? " is-ch" : ""}`}><input type="text" inputMode="numeric" aria-label={`${p.label} 금액`} disabled={readOnly} value={n(p.amount)} onChange={(e) => { const v = digits(e.target.value); setOv(p.key, v ? Number(v) : 0); }} /><span>원</span></div>
        </div>
      ))}
      <span className="qf__help" id={`${uid}-cst`}>기준가는 시험 목록에 적은 이 모델의 값이에요. 군이 늘거나 줄면 시험 목록의 군당 금액으로 칸이 맞춰지고, 금액을 직접 고쳐도 돼요.</span>
    </div>
  );
}

/* ── 약동학 ── */

function PkSampleQ({ part, pk, std, times0, readOnly, setPk }: { part: "groups" | "times"; pk: PkDesign; std?: PkDesign; times0?: number; readOnly: boolean; setPk: (f: (p: PkDesign) => PkDesign) => void }) {
  const [own, setOwn] = useState("");
  const stdById = new Map((std?.groups ?? []).map((g) => [g.id, g]));
  const setG = (id: string, p: Partial<PkDesign["groups"][number]>) => setPk((x) => ({ ...x, groups: x.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) }));
  const times = [...new Set([...PK_TIMES, ...pk.times])];
  const N = pkSamples(pk);
  if (part === "groups") return (
    <>
      <div className="qf__q">
        <span className="qf__lab">시험 종류</span>
        <div className="chips">{PK_TYPES.map((x) => <button key={x} type="button" className="chip" aria-pressed={pk.types.includes(x)} disabled={readOnly} onClick={() => setPk((p) => ({ ...p, types: toggle(p.types, x) }))}>{x}</button>)}</div>
      </div>
      <div className="qf__q">
        <div className="qf__pdg qf__pdg--hd" aria-hidden="true"><span>군</span><span className="qf__c3">경로 · 용량</span><span>마리</span></div>
        {pk.groups.map((g) => {
          const s = stdById.get(g.id);
          return (
            <div key={g.id} className={`qf__pdg${std && !s ? " is-add" : ""}`}>
              <span className="qf__gname">
                <input className="inp qf__gl" aria-label="군 이름" value={g.label} disabled={readOnly} onChange={(e) => setG(g.id, { label: e.target.value.slice(0, 40) })} />
                <button type="button" className="qf__gx" aria-label={`${g.label} 빼기`} disabled={readOnly} onClick={() => setPk((x) => ({ ...x, groups: x.groups.filter((y) => y.id !== g.id) }))}><X size={12} aria-hidden="true" /></button>
              </span>
              <span className="qf__c3 qf__two">
                <input className="inp qf__dose" aria-label={`${g.label} 투여경로`} placeholder="경로" value={g.route} disabled={readOnly} onChange={(e) => setG(g.id, { route: e.target.value.slice(0, 40) })} />
                <input className="inp qf__dose" aria-label={`${g.label} 용량`} placeholder="mg/kg" value={g.dose} disabled={readOnly} onChange={(e) => setG(g.id, { dose: e.target.value.slice(0, 40) })} />
              </span>
              <Stepper label={`${g.label} 마리`} value={g.n} was={s ? s.n : undefined} disabled={readOnly} onChange={(v) => setG(g.id, { n: v })} />
            </div>
          );
        })}
        {!readOnly && <button type="button" className="qf__lk qf__self" onClick={() => setPk((x) => ({ ...x, groups: [...x.groups, newPkGroup(x.groups[0]?.n ?? 0)] }))}><Plus size={14} aria-hidden="true" /> 군 추가</button>}
      </div>
    </>
  );
  return (
    <>
      <div className="qf__q">
        <span className="qf__lab">채혈 시점 {times0 ? <span className="qf__opt">원안 {times0}시점</span> : null}</span>
        <div className="chips">{times.map((x) => <button key={x} type="button" className="chip" aria-pressed={pk.times.includes(x)} disabled={readOnly} onClick={() => setPk((p) => ({ ...p, times: toggle(p.times, x) }))}>{x}</button>)}</div>
        <div className="qf__own">
          <input className="inp" aria-label="채혈 시점 추가" placeholder="예: 72시간" value={own} disabled={readOnly} onChange={(e) => setOwn(e.target.value)} />
          <button type="button" className="b2" disabled={readOnly || !own.trim()} onClick={() => { setPk((p) => ({ ...p, times: [...new Set([...p.times, own.trim().slice(0, 20)])] })); setOwn(""); }}>넣기</button>
        </div>
        <p className="qf__calc tnum">{pk.groups.reduce((a, g) => a + g.n, 0)}마리 × {pk.times.length}시점{pk.matrix.length > 1 ? ` × 검체 ${pk.matrix.length}종` : ""} = <mark>{N}검체</mark>{pk.perSample != null ? ` × ${n(pk.perSample)}원 = ${n(N * pk.perSample)}원` : ""}</p>
      </div>
    </>
  );
}

function PkAssayQ({ pk, readOnly, setPk, uid }: { pk: PkDesign; readOnly: boolean; setPk: (f: (p: PkDesign) => PkDesign) => void; uid: string }) {
  return (
    <>
      <div className="qf__q">
        <span className="qf__lab">검체</span>
        <div className="chips">{PK_MATRIX.map((x) => <button key={x} type="button" className="chip" aria-pressed={pk.matrix.includes(x)} disabled={readOnly} onClick={() => setPk((p) => ({ ...p, matrix: toggle(p.matrix, x) }))}>{x}</button>)}</div>
      </div>
      <div className="qf__q">
        <span className="qf__lab">분석법</span>
        <div className="chips">
          <button type="button" className="chip" aria-pressed={pk.method === "have"} disabled={readOnly} onClick={() => setPk((p) => ({ ...p, method: p.method === "have" ? "" : "have" }))}>의뢰자 분석법 있음</button>
          <button type="button" className="chip" aria-pressed={pk.method === "dev"} disabled={readOnly} onClick={() => setPk((p) => ({ ...p, method: p.method === "dev" ? "" : "dev" }))}>개발 필요{pk.dev ? <small className="tnum"> +{n(pk.dev)}</small> : null}</button>
        </div>
        {pk.method === "dev" && pk.dev == null && <Money id={`${uid}-dev`} label="분석법 개발 금액" value={pk.dev} disabled={readOnly} onChange={(v) => setPk((p) => ({ ...p, dev: v }))} />}
      </div>
      <div className="qf__q">
        <span className="qf__lab">받을 파라미터</span>
        <div className="chips">{PK_PARAMS.map((x) => <button key={x} type="button" className="chip" aria-pressed={pk.params.includes(x)} disabled={readOnly} onClick={() => setPk((p) => ({ ...p, params: toggle(p.params, x) }))}>{x}</button>)}</div>
        {pk.params.includes("F(%)") && !pk.groups.some((g) => /정맥|IV/i.test(g.route)) && <span className="qf__warn">F(%)는 정맥군이 있어야 계산돼요.</span>}
      </div>
    </>
  );
}

/* ── 개별 분석 ── */

function OtherQ({ o, samples0, readOnly, setOt, uid }: { o: OtherDesign; samples0?: number; readOnly: boolean; setOt: (f: (p: OtherDesign) => OtherDesign) => void; uid: string }) {
  return (
    <>
      <div className="qf__q">
        <label className="qf__lab" htmlFor={`${uid}-smp`}>시료</label>
        <input id={`${uid}-smp`} className="inp" value={o.sample} placeholder="예: 랫드 간·신장" disabled={readOnly} onChange={(e) => setOt((x) => ({ ...x, sample: e.target.value.slice(0, 120) }))} />
      </div>
      <div className="qf__q qf__qty">
        <span className="qf__lab">검체 수 {samples0 ? <span className="qf__opt">원안 {samples0}개</span> : null}</span>
        <Stepper label="검체 수" value={o.n} was={samples0} unit="검체" disabled={readOnly} onChange={(v) => setOt((x) => ({ ...x, n: v }))} />
        <p className="qf__calc tnum">{o.n}검체 × {n(o.perSample ?? 0)}원 = <mark>{n(o.n * (o.perSample ?? 0))}원</mark></p>
      </div>
    </>
  );
}

/* ── 의뢰자에게 ── */

function NotesQ({ t, readOnly, set }: { t: DocTest; readOnly: boolean; set: Set }) {
  const asks = t.asks ?? [];
  const [add, setAdd] = useState("");
  const put = () => { const s = add.trim().slice(0, 200); if (!s) return; set((x) => ({ ...x, asks: [...(x.asks ?? []), s].slice(0, 10) })); setAdd(""); };
  return (
    <>
      <div className="qf__q">
        <label className="qf__lab" htmlFor={`${t.uid}-why`}>요청과 다르게 설계한 이유 <span className="qf__opt">견적서와 의뢰자 비교 보고서에 보여요</span></label>
        <textarea id={`${t.uid}-why`} className="inp qf__ta" rows={3} maxLength={1000} value={t.why ?? ""} placeholder="예: 용량 반응을 보려고 시험물질군을 두 용량으로 했습니다" disabled={readOnly} onChange={(e) => set((x) => ({ ...x, why: e.target.value }))} />
      </div>
      <div className="qf__q">
        <span className="qf__lab">의뢰자에게 확인할 것</span>
        {asks.length > 0 && (
          <ol className="qf__asks">
            {asks.map((a, i) => <li key={`${a}-${i}`}><span>{a}</span><button type="button" className="qf__gx" aria-label={`${a} 빼기`} disabled={readOnly} onClick={() => set((x) => ({ ...x, asks: (x.asks ?? []).filter((_, j) => j !== i) }))}><X size={12} aria-hidden="true" /></button></li>)}
          </ol>
        )}
        <div className="qf__own">
          <input className="inp" aria-label="확인할 것 추가" value={add} placeholder="예: 투여 시작을 유발과 같은 날로 해도 되는지" disabled={readOnly} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); put(); } }} />
          <button type="button" className="b2" disabled={readOnly || !add.trim()} onClick={put}>넣기</button>
        </div>
      </div>
    </>
  );
}

/* ── 금액 단계: 갈래별 기준 금액 ── */

/** 표준 금액이 없는 시험인가 (금액 단계에 나온다) */
export function needsPrice(t: DocTest, k: Kind): boolean {
  if (k === "tox") return t.std.price == null;
  if (k === "pd") return kindStdPrice("pd", t.std.kd) == null;
  if (k === "pk") return t.kd?.pk?.perSample == null;
  return t.kd?.other?.perSample == null;
}

/** 금액 단계의 갈래별 칸. 효력은 비용 다섯 칸(기준가), 약동학·개별 분석은 단가 */
export function KindPriceQ({ t, k, readOnly, set }: { t: DocTest; k: Kind; readOnly: boolean; set: Set }) {
  if (k === "pd") {
    const s = t.std.kd?.pd ?? t.kd?.pd;
    if (!s) return null;
    const put = (key: CostKey, v: number | null) => set((x) => {
      const base = x.std.kd?.pd ?? x.kd?.pd;
      if (!base) return x;
      const stdPd = { ...base, costs: { ...base.costs, [key]: v } };
      const kd: KindDesign = { ...x.std.kd, pd: stdPd };
      return { ...x, std: { ...x.std, kd, price: kindStdPrice("pd", kd) }, kd: { ...x.kd, pd: { ...(x.kd?.pd ?? stdPd), costs: stdPd.costs } } };
    });
    return <div className="qf__grid2">{COST_KEYS.map((key) => <Money key={key} id={`${t.uid}-${key}`} label={COST_LABEL[key][0]} help={COST_LABEL[key][1]} value={s.costs[key]} disabled={readOnly} onChange={(v) => put(key, v)} />)}</div>;
  }
  if (k === "pk") {
    const p = t.kd?.pk ?? emptyPk();
    const put = (f: Partial<PkDesign>) => set((x) => { const pk = { ...(x.kd?.pk ?? emptyPk()), ...f }; return { ...x, kd: { ...x.kd, pk }, std: { ...x.std, price: kindStdPrice("pk", { pk }) } }; });
    return (
      <div className="qf__grid2">
        <Money id={`${t.uid}-ps`} label="검체당 분석 단가" value={p.perSample} disabled={readOnly} onChange={(v) => put({ perSample: v })} />
        <Money id={`${t.uid}-an`} label="동물 실험 (투여·채혈)" value={p.animal} disabled={readOnly} onChange={(v) => put({ animal: v })} />
        <Money id={`${t.uid}-dv`} label="분석법 개발" help="분석법 개발이 필요할 때만 더해요" value={p.dev} disabled={readOnly} onChange={(v) => put({ dev: v })} />
        <Money id={`${t.uid}-rp`} label="파라미터 분석·보고서" value={p.report} disabled={readOnly} onChange={(v) => put({ report: v })} />
      </div>
    );
  }
  if (k === "other") {
    const o = t.kd?.other ?? emptyOther();
    const put = (f: Partial<OtherDesign>) => set((x) => { const other = { ...(x.kd?.other ?? emptyOther()), ...f }; return { ...x, kd: { ...x.kd, other }, std: { ...x.std, price: kindStdPrice("other", { other }) } }; });
    return (
      <div className="qf__grid2">
        <Money id={`${t.uid}-ps`} label="검체당 단가" value={o.perSample} disabled={readOnly} onChange={(v) => put({ perSample: v })} />
        <Money id={`${t.uid}-st`} label="시료 접수·보관" value={o.setup} disabled={readOnly} onChange={(v) => put({ setup: v })} />
        <Money id={`${t.uid}-rp`} label="결과 보고서" value={o.report} disabled={readOnly} onChange={(v) => put({ report: v })} />
      </div>
    );
  }
  return null;
}

/** "시험 목록에도 저장"으로 보낼 설계 (시험 목록 기준값만. 이 견적서의 군·시점은 보내지 않는다) */
export function kdForCatalog(t: DocTest, k: Kind): KindDesign | undefined {
  if (k === "pd") return t.std.kd?.pd ? { pd: t.std.kd.pd } : undefined;
  if (k === "pk" && t.kd?.pk) { const b = t.std.kd?.pk ?? emptyPk(); const p = t.kd.pk; return { pk: { ...b, animal: p.animal, perSample: p.perSample, dev: p.dev, report: p.report } }; }
  if (k === "other" && t.kd?.other) { const b = t.std.kd?.other ?? emptyOther(); const o = t.kd.other; return { other: { ...b, perSample: o.perSample, setup: o.setup, report: o.report } }; }
  return undefined;
}
