"use client";

/**
 * 기관 CRM 안건 입력 (0038, 시안 v5). 화면(서버 컴포넌트)이 고른 값만 넘기고, 저장하면 화면을 다시 읽는다.
 * 보드 끌어 옮기기 · 단계 막대 · 수주/실패 · 기록 남기기 · 다음 할 일 끝내기.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarBlank, CaretRight, Check, Copy, DotsThree, Handshake, NotePencil, Phone, User, X } from "@phosphor-icons/react";
import { DEAL_KIND, DEAL_KINDS, LOST_REASONS, STAGES, STAGE_LABEL, type Stage, type StageSpan } from "@/lib/crm-deals";
import { addDaysYmd, todayKst, weekdayKo } from "@/lib/crm-shape";
import { Err, Field, Select, useSend, useSheetClose, type CrmOpts, type Opt } from "./forms";

// ─── 새 안건 · 안건 고치기 ───
type DealDraft = {
  title: string; company_id: string; new_company: string; contact_ids: string[]; amount: string; kind: string; stage: Stage; expected_on: string; owner: string;
  substance: string; submit_to: string; report_lang: string; memo: string;
};
export function DealForm({ opts, deal, preset = {}, base, locked = false }: {
  opts: CrmOpts; base: string; locked?: boolean;
  deal?: { id: string; title: string; company_id: string | null; contact_ids: string[]; amount: number | null; kind: string; expected_on: string | null; owner: string | null; substance: string; submit_to: string; report_lang: string; memo: string };
  preset?: { company_id?: string };
}) {
  const close = useSheetClose();
  const router = useRouter();
  const { busy, err, setErr, send } = useSend();
  const hid = useId();
  const [v, setV] = useState<DealDraft>(() => ({
    title: deal?.title ?? "", company_id: deal?.company_id ?? preset.company_id ?? "", new_company: "", contact_ids: deal?.contact_ids ?? [], amount: deal?.amount != null ? deal.amount.toLocaleString("ko-KR") : "",
    kind: deal?.kind ?? "", stage: "inquiry", expected_on: deal?.expected_on?.slice(0, 7) ?? "", owner: deal?.owner ?? opts.me, substance: deal?.substance ?? "", submit_to: deal?.submit_to ?? "", report_lang: deal?.report_lang ?? "", memo: deal?.memo ?? "",
  }));
  const set = (p: Partial<DealDraft>) => setV({ ...v, ...p });
  const contacts = opts.contacts.filter((c) => c.companyId === v.company_id);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    let company = v.company_id;
    if (!locked && company === "__new") {
      if (!v.new_company.trim()) return setErr("새 고객사 이름을 적어 주세요.");
      const c = await send("companies", "POST", { name: v.new_company }, { refresh: false });
      if (!c?.id) return;
      company = c.id;
    }
    const body: Record<string, unknown> = {
      title: v.title, amount: v.amount, kind: v.kind, expected_on: v.expected_on ? `${v.expected_on}-01` : null, owner: v.owner || null,
      substance: v.substance, submit_to: v.submit_to, report_lang: v.report_lang, memo: v.memo,
      ...(locked ? {} : { company_id: company || null, contact_ids: company === v.company_id ? v.contact_ids : [] }),
    };
    const r = await send("deals", deal ? "PATCH" : "POST", deal ? { id: deal.id, ...body } : { ...body, stage: v.stage });
    if (!r) return;
    close();
    if (!deal && r.id) router.push(`${base}/${r.id}`);
  }
  return (
    <form className="crm-form" onSubmit={save}>
      <Field label="안건 이름" htmlFor={`${hid}-t`} help="시험 이름과 동물종처럼 다른 안건과 구분되게 적어요.">
        <input id={`${hid}-t`} className="inp" value={v.title} maxLength={200} required placeholder="예: 13주 반복투여독성 · 랫드" onChange={(e) => set({ title: e.target.value })} />
      </Field>
      {locked ? (
        <p className="crm-note">단추 요청에서 온 안건이에요. 고객사와 담당자는 선정되면 단추가 채워요.</p>
      ) : (
        <>
          <Field label="고객사" htmlFor={`${hid}-c`}>
            <Select id={`${hid}-c`} value={v.company_id} onChange={(company_id) => set({ company_id, contact_ids: [] })}>
              <option value="">아직 모름</option>
              {opts.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__new">새 고객사 추가</option>
            </Select>
          </Field>
          {v.company_id === "__new" && (
            <Field label="새 고객사 이름" htmlFor={`${hid}-nc`}><input id={`${hid}-nc`} className="inp" value={v.new_company} maxLength={200} onChange={(e) => set({ new_company: e.target.value })} /></Field>
          )}
          {contacts.length > 0 && (
            <Field label="담당자">
              <div className="chips" role="group" aria-label="담당자">
                {contacts.map((c) => {
                  const on = v.contact_ids.includes(c.id);
                  return <button key={c.id} type="button" className="chip chip--sm" aria-pressed={on} onClick={() => set({ contact_ids: on ? v.contact_ids.filter((x) => x !== c.id) : [...v.contact_ids, c.id] })}>{c.name}</button>;
                })}
              </div>
            </Field>
          )}
        </>
      )}
      <div className="grid2">
        <Field label="금액" htmlFor={`${hid}-a`} help="숫자, 또는 6,200만처럼 적어요.">
          <input id={`${hid}-a`} className="inp tnum" inputMode="numeric" value={v.amount} maxLength={20} placeholder="62,000,000" onChange={(e) => set({ amount: e.target.value })} />
        </Field>
        <Field label="예상 계약" htmlFor={`${hid}-e`}><input id={`${hid}-e`} className="inp tnum" type="month" value={v.expected_on} onChange={(e) => set({ expected_on: e.target.value })} /></Field>
      </div>
      <Field label="시험 갈래">
        <div className="chips" role="group" aria-label="시험 갈래">
          {DEAL_KINDS.map((k) => <button key={k} type="button" className="chip chip--sm" aria-pressed={v.kind === k} onClick={() => set({ kind: v.kind === k ? "" : k })}>{DEAL_KIND[k]}</button>)}
        </div>
      </Field>
      {!deal && (
        <Field label="시작 단계">
          <div className="chips" role="group" aria-label="시작 단계">
            {STAGES.map((k) => <button key={k} type="button" className="chip chip--sm" aria-pressed={v.stage === k} onClick={() => set({ stage: k })}>{STAGE_LABEL[k]}</button>)}
          </div>
        </Field>
      )}
      <Field label="담당 영업" htmlFor={`${hid}-o`}>
        <Select id={`${hid}-o`} value={v.owner} onChange={(owner) => set({ owner })}>
          <option value="">정하지 않음</option>
          {opts.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </Field>
      {deal && (
        <>
          <div className="grid2">
            <Field label="대상 물질" htmlFor={`${hid}-s`}><input id={`${hid}-s`} className="inp" value={v.substance} maxLength={200} placeholder="합성의약품" onChange={(e) => set({ substance: e.target.value })} /></Field>
            <Field label="제출처" htmlFor={`${hid}-st`}><input id={`${hid}-st`} className="inp" value={v.submit_to} maxLength={100} placeholder="식약처" onChange={(e) => set({ submit_to: e.target.value })} /></Field>
          </div>
          <Field label="보고서 언어" htmlFor={`${hid}-l`}><input id={`${hid}-l`} className="inp" value={v.report_lang} maxLength={40} placeholder="국문, 국문+영문 번역" onChange={(e) => set({ report_lang: e.target.value })} /></Field>
          <Field label="메모" htmlFor={`${hid}-m`}><textarea id={`${hid}-m`} className="ta" rows={3} value={v.memo} maxLength={4000} onChange={(e) => set({ memo: e.target.value })} /></Field>
        </>
      )}
      <Err msg={err} />
      <div className="crm-acts"><button type="submit" className="b1" disabled={busy}>{busy ? "저장 중" : deal ? "안건 저장" : "안건 만들기"}</button></div>
    </form>
  );
}

// ─── 단계 막대 ───
export function StageBar({ dealId, spans, open }: { dealId: string; spans: StageSpan[]; open: boolean }) {
  const { busy, err, send } = useSend();
  const [cur, setCur] = useState<Stage>(() => spans.find((s) => s.state === "now")?.stage ?? spans.filter((s) => s.state === "done").at(-1)?.stage ?? "inquiry");
  useEffect(() => setCur(spans.find((s) => s.state === "now")?.stage ?? spans.filter((s) => s.state === "done").at(-1)?.stage ?? "inquiry"), [spans]);
  const ci = STAGES.indexOf(cur);
  async function go(stage: Stage) {
    if (!open || stage === cur || busy) return;
    const prev = cur;
    setCur(stage);
    if (!(await send("move", "POST", { id: dealId, stage }))) setCur(prev);
  }
  return (
    <div className="cx-stagebar-w">
      <ol className="cx-stagebar" aria-label="단계">
        {spans.map((s, i) => {
          const state = i < ci ? "done" : i === ci ? "now" : "next";
          return (
            <li key={s.stage} data-state={state}>
              <button type="button" onClick={() => go(s.stage)} disabled={!open || busy} aria-current={state === "now" ? "step" : undefined} aria-label={`${STAGE_LABEL[s.stage]}${state === "now" ? " (지금 단계)" : open ? "로 옮기기" : ""}`}>
                <span>{STAGE_LABEL[s.stage]}</span>
                {s.days != null && state !== "next" && <small className="tnum">{state === "now" && open ? `${s.days}일째` : `${s.days}일`}</small>}
              </button>
            </li>
          );
        })}
      </ol>
      <Err msg={err} />
    </div>
  );
}

// ─── 수주 · 실패 ───
export function CloseButtons({ deal }: { deal: { id: string; title: string; sub: string; amount: number | null; status: string; danchu: boolean } }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"won" | "lost" | null>(null);
  const { busy, err, setErr, send } = useSend();
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [follow, setFollow] = useState("");
  const [amount, setAmount] = useState(deal.amount != null ? deal.amount.toLocaleString("ko-KR") : "");
  const hid = useId();
  const open = (m: "won" | "lost") => { setMode(m); setErr(""); requestAnimationFrame(() => ref.current?.showModal()); };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "lost" && !reason) return setErr("실패 사유를 하나 골라 주세요.");
    const r = await send("move", "POST", mode === "won" ? { id: deal.id, status: "won", stage: "contract", won_amount: amount } : { id: deal.id, status: "lost", reason, note, follow_up_on: follow || undefined });
    if (r) ref.current?.close();
  }
  if (deal.status !== "open") {
    return (
      <button type="button" className="b2 bsm" disabled={busy} onClick={() => send("move", "POST", { id: deal.id, status: "open" })}>{busy ? "바꾸는 중" : "다시 진행으로"}</button>
    );
  }
  return (
    <>
      <button type="button" className="cx-won" onClick={() => open("won")}>수주</button>
      <button type="button" className="cx-lost" onClick={() => open("lost")}>실패</button>
      <dialog ref={ref} className="cx-dialog" aria-labelledby={hid} onClose={() => setMode(null)} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        {mode && (
          <form onSubmit={save} className="cx-dialog__in">
            <header>
              <h2 id={hid}>{mode === "won" ? "수주로 바꿀까요?" : "실패로 바꿀까요?"}</h2>
              <p>{deal.sub}</p>
              <button type="button" className="crm-x" aria-label="닫기" onClick={() => ref.current?.close()}><X size={20} aria-hidden="true" /></button>
            </header>
            {mode === "won" ? (
              <Field label="계약 금액" htmlFor={`${hid}-a`} help="보고서의 수주 금액이 돼요. 단추 요청은 계약 결과 보고 금액이 따로 남아요.">
                <input id={`${hid}-a`} className="inp tnum" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
            ) : (
              <>
                <fieldset className="cx-reasons">
                  <legend className="fld__lab">실패 사유</legend>
                  {LOST_REASONS.map((r) => (
                    <label key={r} data-on={reason === r ? "1" : "0"}><input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} /> {r}</label>
                  ))}
                </fieldset>
                <Field label="메모 (선택)" htmlFor={`${hid}-n`}>
                  <textarea id={`${hid}-n`} className="ta" rows={2} value={note} maxLength={2000} placeholder="예: 예산이 2,500만 원 안쪽이라고 함. 내년 상반기에 다시 문의 예정." onChange={(e) => setNote(e.target.value)} />
                </Field>
                <Field label="다시 연락할 날 (선택)" htmlFor={`${hid}-f`} help="고르면 그날 '다시 연락하기' 할 일이 생겨요.">
                  <input id={`${hid}-f`} className="inp tnum" type="date" min={todayKst()} value={follow} onChange={(e) => setFollow(e.target.value)} />
                </Field>
                {deal.danchu && <p className="cx-danchu-note"><span className="cx-d" aria-hidden="true">단</span>단추에서 온 안건은 의뢰자가 다른 기관을 고르면 &quot;다른 기관 선정&quot;으로 저절로 바뀌어요.</p>}
              </>
            )}
            <Err msg={err} />
            <div className="crm-acts">
              <button type="button" className="b2" onClick={() => ref.current?.close()}>취소</button>
              <button type="submit" className="b1" disabled={busy}>{busy ? "바꾸는 중" : mode === "won" ? "수주로 바꾸기" : "실패로 바꾸기"}</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

// ─── 기록 남기기 (메모·통화·미팅·할 일) ───
type Tab = "memo" | "call" | "meeting" | "task";
const TAB_LABEL: Record<Tab, string> = { memo: "메모", call: "통화", meeting: "미팅", task: "할 일" };
const TAB_ICON = { memo: NotePencil, call: Phone, meeting: Handshake, task: CalendarBlank };
/** 내일 · 모레 · 이번 주 목요일(지났으면 다음 주) · 다음 주 월요일 */
export function dueChips(today = todayKst()): { label: string; ymd: string }[] {
  const dow = new Date(`${today}T12:00:00+09:00`).getUTCDay();
  const thu = addDaysYmd(today, ((4 - dow + 7) % 7) || 7);
  const nextMon = addDaysYmd(today, ((8 - dow) % 7) || 7);
  const out = [{ label: "내일", ymd: addDaysYmd(today, 1) }, { label: "모레", ymd: addDaysYmd(today, 2) }, { label: `${weekdayKo(thu)}요일 ${+thu.slice(5, 7)}.${thu.slice(8, 10)}`, ymd: thu }, { label: "다음 주", ymd: nextMon }];
  return out.filter((x, i) => out.findIndex((y) => y.ymd === x.ymd) === i);
}

export function Composer({ dealId, companyId, contacts, members, me, compact = false, autoFocus = false, startTab = "memo", onDone }: {
  dealId: string | null; companyId: string | null; contacts: Opt[]; members: Opt[]; me: string; compact?: boolean; autoFocus?: boolean; startTab?: Tab; onDone?: () => void;
}) {
  const { busy, err, setErr, send } = useSend();
  const hid = useId();
  const [tab, setTab] = useState<Tab>(startTab);
  const [body, setBody] = useState("");
  const [who, setWho] = useState<string>(contacts[0]?.id ?? "");
  const [nextOn, setNextOn] = useState("");
  const [nextTitle, setNextTitle] = useState("");
  const [assignee, setAssignee] = useState(me);
  const [pickDate, setPickDate] = useState(false);
  useEffect(() => setWho((w) => (contacts.some((c) => c.id === w) ? w : contacts[0]?.id ?? "")), [contacts]);
  const chips = useMemo(() => dueChips(), []);
  const person = contacts.find((c) => c.id === who)?.name ?? "";
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return setErr(tab === "task" ? "할 일을 적어 주세요." : "내용을 적어 주세요.");
    const base = { deal_id: dealId, company_id: dealId ? null : companyId, contact_id: who || null };
    const r = tab === "task"
      ? await send("tasks", "POST", { ...base, title: body, due_on: nextOn || null, assignee: assignee || null, category: "contact" })
      : await send("activities", "POST", {
        ...base, kind: tab, body, attendee_contacts: who ? [who] : [], attendee_members: tab === "meeting" ? [me] : [],
        next_title: nextOn ? nextTitle || (person ? `${person}에게 회신` : "다시 연락하기") : "", next_due: nextOn || null, next_category: "contact",
      });
    if (!r) return;
    setBody(""); setNextOn(""); setNextTitle(""); setPickDate(false);
    onDone?.();
  }
  return (
    <form className={`cx-compose${compact ? " cx-compose--m" : ""}`} onSubmit={save} id={dealId ? "next" : undefined}>
      <div className="cx-tabs" role="tablist" aria-label="남길 것">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => {
          const I = TAB_ICON[t];
          return <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setErr(""); }}><I size={16} aria-hidden="true" />{TAB_LABEL[t]}</button>;
        })}
      </div>
      <label className="sr-only" htmlFor={`${hid}-b`}>{tab === "task" ? "할 일" : "내용"}</label>
      {tab === "task" ? (
        <input id={`${hid}-b`} className="inp cx-compose__line" value={body} maxLength={200} autoFocus={autoFocus} placeholder="예: 회복군 포함안 금액 다시 보내기" onChange={(e) => setBody(e.target.value)} />
      ) : (
        <textarea id={`${hid}-b`} className="cx-compose__ta" rows={compact ? 6 : 2} value={body} maxLength={8000} autoFocus={autoFocus}
          placeholder={tab === "memo" ? "통화나 미팅에서 나온 이야기를 적어요." : tab === "call" ? "통화에서 나눈 이야기, 정한 것, 남은 질문" : "미팅에서 다룬 것, 정한 것, 다음에 할 것"} onChange={(e) => setBody(e.target.value)} />
      )}
      {(tab !== "memo" || nextOn || pickDate || compact) && (
        <div className="cx-compose__next">
          <span className="fld__lab">{tab === "task" ? "기한" : "다음 할 일"}</span>
          <div className="chips" role="group" aria-label={tab === "task" ? "기한" : "다음 할 일 날짜"}>
            {chips.map((c) => <button key={c.ymd} type="button" className="chip chip--sm" aria-pressed={nextOn === c.ymd && !pickDate} onClick={() => { setPickDate(false); setNextOn(nextOn === c.ymd ? "" : c.ymd); }}>{c.label}</button>)}
            <button type="button" className="chip chip--sm" aria-pressed={pickDate} onClick={() => setPickDate(!pickDate)}>날짜 고르기</button>
          </div>
          {pickDate && <input className="inp tnum" type="date" aria-label="날짜" min={todayKst()} value={nextOn} onChange={(e) => setNextOn(e.target.value)} />}
          {tab !== "task" && nextOn && (
            <input className="inp" aria-label="다음 할 일" value={nextTitle} maxLength={200} placeholder={person ? `${person}에게 회신` : "다시 연락하기"} onChange={(e) => setNextTitle(e.target.value)} />
          )}
          {tab !== "task" && nextOn && <p className="fld__help">&quot;{nextTitle || (person ? `${person}에게 회신` : "다시 연락하기")}&quot; 할 일이 생기고 오늘 화면과 캘린더에 들어가요.</p>}
        </div>
      )}
      <div className="cx-compose__foot">
        {contacts.length > 0 && (
          <label className="cx-mini"><User size={15} aria-hidden="true" /><span className="sr-only">담당자</span>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">담당자 없음</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {tab === "task" && members.length > 1 && (
          <label className="cx-mini"><span>맡은 사람</span>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
        {tab === "memo" && !nextOn && !pickDate && !compact && <button type="button" className="cx-mini" onClick={() => setPickDate(true)}><CalendarBlank size={15} aria-hidden="true" />다음 할 일 날짜</button>}
        <button type="submit" className="b1 bsm" disabled={busy}>{busy ? "저장 중" : tab === "task" ? "할 일 추가" : "기록 저장"}</button>
      </div>
      <Err msg={err} />
    </form>
  );
}

// ─── 끝내기 (할 일·일정) ───
export function DoneButton({ kind, id, label = "완료" }: { kind: "tasks" | "events"; id: string; label?: string }) {
  const { busy, err, send } = useSend();
  return (
    <>
      <button type="button" className="b2 bsm" disabled={busy} onClick={() => send(kind, "PATCH", { id, done: true })}><Check size={15} aria-hidden="true" />{busy ? "저장 중" : label}</button>
      <Err msg={err} />
    </>
  );
}

export function CopyText({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <span className="cx-copy">
      <code>{text}</code>
      <button type="button" className="cx-icon" aria-label={label} onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1600); } catch { setOk(false); } }}>
        {ok ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </button>
      <span className="sr-only" role="status">{ok ? "복사했어요" : ""}</span>
    </span>
  );
}

// ─── 보드 ───
export type BoardCard = {
  id: string; title: string; who: string; danchu: string | null; amount: string; next: string; nextKind: string | null; flag: string | null; flagTone: string | null; days: number; href: string;
};
export type BoardColumn = { stage: Stage; count: number; sum: string; cards: BoardCard[] };

const NEXT_ICON: Record<string, typeof Phone> = { call: Phone, meeting: Handshake, task: CalendarBlank, danchu: CaretRight, event: CalendarBlank };

/** 단계별 열. 카드를 끌어 다른 열에 놓으면 단계가 바뀌고, 키보드로는 카드의 단계 메뉴에서 바꾼다 */
export function Board({ cols: initial }: { cols: BoardColumn[] }) {
  const [cols, setCols] = useState(initial);
  useEffect(() => setCols(initial), [initial]);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const { err, send } = useSend();
  async function move(id: string, to: Stage) {
    const from = cols.find((c) => c.cards.some((x) => x.id === id));
    if (!from || from.stage === to) return;
    const card = from.cards.find((x) => x.id === id)!;
    const before = cols;
    setCols(cols.map((c) => (c.stage === from.stage ? { ...c, count: c.count - 1, cards: c.cards.filter((x) => x.id !== id) } : c.stage === to ? { ...c, count: c.count + 1, cards: [{ ...card, days: 0 }, ...c.cards] } : c)));
    if (!(await send("move", "POST", { id, stage: to }))) setCols(before);
  }
  return (
    <>
      <Err msg={err} />
      <div className="cx-board" role="list" aria-label="단계별 안건">
        {cols.map((c) => (
          <section key={c.stage} role="listitem" className="cx-col" data-over={over === c.stage ? "1" : "0"} aria-label={`${STAGE_LABEL[c.stage]} ${c.count}건`}
            onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(c.stage); } }} onDragLeave={() => setOver((o) => (o === c.stage ? null : o))}
            onDrop={(e) => { e.preventDefault(); setOver(null); if (drag) void move(drag, c.stage); setDrag(null); }}>
            <header className="cx-col__h">
              <b>{STAGE_LABEL[c.stage]}</b><span className="tnum">{c.count}</span>
              <small className="tnum">{c.sum}</small>
            </header>
            <div className="cx-col__list">
              {c.cards.map((d) => {
                const I = d.nextKind ? NEXT_ICON[d.nextKind] ?? CalendarBlank : null;
                return (
                  <article key={d.id} className="cx-card" draggable onDragStart={(e) => { setDrag(d.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", d.id); }} onDragEnd={() => { setDrag(null); setOver(null); }} data-drag={drag === d.id ? "1" : "0"}>
                    <Link href={d.href} className="cx-card__t">{d.title}</Link>
                    <p className="cx-card__who">{d.danchu ? <><span className="cx-d" aria-hidden="true">단</span>{d.danchu}</> : d.who}</p>
                    <p className="cx-card__amt tnum">{d.amount}</p>
                    <div className="cx-card__f">
                      {d.flag ? <span className={`cx-flag cx-flag--${d.flagTone}`}>{d.flag}</span> : d.next ? <span className="cx-card__next">{I && <I size={14} aria-hidden="true" />}{d.next}</span> : <span />}
                      <span className="cx-card__days tnum">{d.days}일째</span>
                    </div>
                    <div className="cx-card__menu">
                      <button type="button" className="cx-icon" aria-haspopup="menu" aria-expanded={menu === d.id} aria-label={`${d.title} 단계 바꾸기`} onClick={() => setMenu(menu === d.id ? null : d.id)}><DotsThree size={18} weight="bold" aria-hidden="true" /></button>
                      {menu === d.id && (
                        <ul role="menu" className="cx-menu" onKeyDown={(e) => { if (e.key === "Escape") setMenu(null); }}>
                          {STAGES.filter((s) => s !== c.stage).map((s) => (
                            <li key={s} role="none"><button type="button" role="menuitem" autoFocus={s === STAGES.filter((x) => x !== c.stage)[0]} onClick={() => { setMenu(null); void move(d.id, s); }}>{STAGE_LABEL[s]}로 옮기기</button></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </article>
                );
              })}
              {!c.cards.length && <p className="cx-col__empty">{c.stage === "inquiry" ? "새 문의를 안건으로 만들거나 엑셀에서 가져와요." : "이 단계 안건이 없어요."}</p>}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
