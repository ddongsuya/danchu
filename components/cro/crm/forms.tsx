"use client";

/**
 * 기관 CRM 입력 칸 (0038). 화면(서버 컴포넌트)이 고른 값만 넘기고, 저장하면 화면을 다시 읽는다.
 * 큰 입력은 오른쪽(휴대폰은 전체 화면) 시트 하나에서 한다: <SheetButton> 안에 폼을 넣는다.
 * 미리보기(저장 안 됨)에서는 저장 요청이 막혀 오류 문구가 보인다.
 */
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, X } from "@phosphor-icons/react";
import {
  ACT_KIND, ACT_KINDS, CONTACT_ROLE, CONTACT_ROLES, EVENT_KIND, EVENT_KINDS, EVENT_MODE, EVENT_MODES, LOST_REASONS, QUOTE_STAGE, QUOTE_STAGES, TASK_CAT, TASK_CATS,
  hmKst, todayKst, ymdKst,
  type CrmCompany, type CrmContact, type CrmEvent, type CrmQuote,
} from "@/lib/crm-shape";

export type Opt = { id: string; name: string; sub?: string };
export type CrmOpts = {
  companies: Opt[];
  contacts: (Opt & { companyId: string })[];
  members: Opt[];
  quotes: (Opt & { companyId: string | null })[];
  me: string;
};

// ─── 저장 ───
type Method = "POST" | "PATCH" | "DELETE";
function useSend() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function send(kind: string, method: Method, body: Record<string, unknown>): Promise<{ id?: string } | null> {
    if (busy) return null;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/cro/crm/${kind}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!r.ok) throw new Error(j.error || (r.status === 403 ? "저장할 권한이 없어요. 미리보기에서는 저장되지 않아요." : "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요."));
      router.refresh();
      return j;
    } catch (x) {
      setErr(x instanceof Error && x.message !== "Failed to fetch" ? x.message : "연결이 끊겼어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, err, setErr, send };
}

function Err({ msg }: { msg: string }) {
  return msg ? <p className="crm-err" role="alert">{msg}</p> : null;
}

// ─── 시트 ───
const CloseCtx = createContext<() => void>(() => {});
export const useSheetClose = () => useContext(CloseCtx);

/** 누르면 시트가 열리는 버튼. 시트 안 폼은 저장하면 useSheetClose()로 닫는다 */
export function SheetButton({ label, title, className = "b2 bsm", children, open: openAtStart = false }: { label: React.ReactNode; title: string; className?: string; children: React.ReactNode; open?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const hid = useId();
  const show = () => { setOpen(true); requestAnimationFrame(() => ref.current?.showModal()); };
  const close = () => { ref.current?.close(); };
  useEffect(() => { if (openAtStart) show(); }, [openAtStart]);
  return (
    <>
      <button type="button" className={className} onClick={show}>{label}</button>
      {open && (
        <dialog ref={ref} className="crm-sheet" aria-labelledby={hid} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === ref.current) close(); }}>
          <div className="crm-sheet__in">
            <header className="crm-sheet__hd">
              <h2 id={hid}>{title}</h2>
              <button type="button" className="crm-x" aria-label="닫기" onClick={close}><X size={20} aria-hidden="true" /></button>
            </header>
            <CloseCtx.Provider value={close}>{children}</CloseCtx.Provider>
          </div>
        </dialog>
      )}
    </>
  );
}

// ─── 작은 입력 조각 ───
function Field({ label, htmlFor, help, children }: { label: string; htmlFor?: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="fld">
      {htmlFor ? <label className="fld__lab" htmlFor={htmlFor}>{label}</label> : <span className="fld__lab">{label}</span>}
      {children}
      {help && <span className="fld__help">{help}</span>}
    </div>
  );
}
function Seg<T extends string>({ value, list, labels, onChange, label }: { value: T; list: readonly T[]; labels: Record<string, string>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="crm-seg" role="group" aria-label={label}>
      {list.map((k) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{labels[k]}</button>)}
    </div>
  );
}
function Pick({ opts, value, onChange, label, empty }: { opts: Opt[]; value: string[]; onChange: (v: string[]) => void; label: string; empty: string }) {
  if (!opts.length) return <p className="fld__help">{empty}</p>;
  return (
    <div className="chips" role="group" aria-label={label}>
      {opts.map((o) => {
        const on = value.includes(o.id);
        return <button key={o.id} type="button" className="chip chip--sm" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}>{o.name}</button>;
      })}
    </div>
  );
}
function Select({ id, value, onChange, children }: { id: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="selwrap">
      <select id={id} className="sel" value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
      <CaretDown size={16} aria-hidden="true" />
    </div>
  );
}
function Actions({ busy, label, children }: { busy: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className="crm-acts">
      {children}
      <button type="submit" className="b1" disabled={busy}>{busy ? "저장 중" : label}</button>
    </div>
  );
}

// ─── 고객사 ───
export function CompanyForm({ company }: { company?: CrmCompany }) {
  const close = useSheetClose();
  const router = useRouter();
  const { busy, err, send } = useSend();
  const [v, setV] = useState({
    name: company?.name ?? "", aliases: (company?.aliases ?? []).join(", "), industry: company?.industry ?? "", biz_no: company?.biz_no ?? "",
    address: company?.address ?? "", website: company?.website ?? "", memo: company?.memo ?? "", first_deal: company?.first_deal ?? true,
  });
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("companies", company ? "PATCH" : "POST", { ...(company ? { id: company.id } : {}), ...v });
    if (!r) return;
    close();
    if (!company && r.id) router.push(`${location.pathname.replace(/\/$/, "")}/${r.id}`);
  }
  return (
    <form className="crm-form" onSubmit={save}>
      <Field label="고객사 이름" htmlFor="co-name"><input id="co-name" className="inp" value={v.name} maxLength={200} required onChange={(e) => set({ name: e.target.value })} /></Field>
      <Field label="다른 이름" htmlFor="co-alias" help="영문명, 예전 이름처럼 같은 회사를 부르는 이름. 쉼표로 나눠요. 단추에서 선정될 때 이 이름으로도 찾아 묶어요.">
        <input id="co-alias" className="inp" value={v.aliases} maxLength={600} onChange={(e) => set({ aliases: e.target.value })} />
      </Field>
      <div className="grid2">
        <Field label="업종" htmlFor="co-ind"><input id="co-ind" className="inp" value={v.industry} maxLength={60} placeholder="제약사, 바이오텍, 의료기기" onChange={(e) => set({ industry: e.target.value })} /></Field>
        <Field label="사업자등록번호" htmlFor="co-biz"><input id="co-biz" className="inp tnum" inputMode="numeric" value={v.biz_no} maxLength={12} placeholder="000-00-00000" onChange={(e) => set({ biz_no: e.target.value })} /></Field>
      </div>
      <Field label="주소" htmlFor="co-addr"><input id="co-addr" className="inp" value={v.address} maxLength={300} onChange={(e) => set({ address: e.target.value })} /></Field>
      <Field label="웹사이트" htmlFor="co-web"><input id="co-web" className="inp" type="url" value={v.website} maxLength={300} placeholder="https://" onChange={(e) => set({ website: e.target.value })} /></Field>
      <Field label="메모" htmlFor="co-memo"><textarea id="co-memo" className="ta" rows={3} value={v.memo} maxLength={4000} onChange={(e) => set({ memo: e.target.value })} /></Field>
      <label className="crm-check"><input type="checkbox" checked={v.first_deal} onChange={(e) => set({ first_deal: e.target.checked })} /> 아직 계약한 적 없는 고객사예요</label>
      <Err msg={err} />
      <Actions busy={busy} label={company ? "고객사 저장" : "고객사 추가"} />
    </form>
  );
}

// ─── 담당자 ───
export function ContactForm({ companyId, contact }: { companyId: string; contact?: CrmContact }) {
  const close = useSheetClose();
  const { busy, err, send } = useSend();
  const [v, setV] = useState({
    name: contact?.name ?? "", dept: contact?.dept ?? "", title: contact?.title ?? "", role: contact?.role ?? "", email: contact?.email ?? "",
    phone: contact?.phone ?? "", mobile: contact?.mobile ?? "", memo: contact?.memo ?? "",
  });
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("contacts", contact ? "PATCH" : "POST", { ...(contact ? { id: contact.id } : { company_id: companyId }), ...v, role: v.role || null });
    if (r) close();
  }
  async function remove() {
    if (!contact) return;
    const r = await send("contacts", "DELETE", { id: contact.id });
    if (r) { close(); location.assign(location.pathname); }
  }
  return (
    <form className="crm-form" onSubmit={save}>
      {contact?.danchu_key && <p className="crm-note">단추에서 선정될 때 의뢰자가 적은 이름·연락처로 만들어졌어요. 고쳐도 단추 요청서는 바뀌지 않아요.</p>}
      <Field label="이름" htmlFor="ct-name"><input id="ct-name" className="inp" value={v.name} maxLength={100} required onChange={(e) => set({ name: e.target.value })} /></Field>
      <div className="grid2">
        <Field label="소속" htmlFor="ct-dept"><input id="ct-dept" className="inp" value={v.dept} maxLength={100} placeholder="비임상팀" onChange={(e) => set({ dept: e.target.value })} /></Field>
        <Field label="직책" htmlFor="ct-title"><input id="ct-title" className="inp" value={v.title} maxLength={60} placeholder="팀장" onChange={(e) => set({ title: e.target.value })} /></Field>
      </div>
      <Field label="이 고객사에서 맡은 일">
        <div className="chips" role="group" aria-label="맡은 일">
          {CONTACT_ROLES.map((k) => <button key={k} type="button" className="chip chip--sm" aria-pressed={v.role === k} onClick={() => set({ role: v.role === k ? "" : k })}>{CONTACT_ROLE[k]}</button>)}
        </div>
      </Field>
      <Field label="이메일" htmlFor="ct-mail"><input id="ct-mail" className="inp" type="email" value={v.email} maxLength={200} onChange={(e) => set({ email: e.target.value })} /></Field>
      <div className="grid2">
        <Field label="전화" htmlFor="ct-tel"><input id="ct-tel" className="inp tnum" type="tel" value={v.phone} maxLength={40} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="휴대폰" htmlFor="ct-mob"><input id="ct-mob" className="inp tnum" type="tel" value={v.mobile} maxLength={40} onChange={(e) => set({ mobile: e.target.value })} /></Field>
      </div>
      <Field label="메모" htmlFor="ct-memo"><textarea id="ct-memo" className="ta" rows={2} value={v.memo} maxLength={2000} onChange={(e) => set({ memo: e.target.value })} /></Field>
      <Err msg={err} />
      <Actions busy={busy} label={contact ? "담당자 저장" : "담당자 추가"}>
        {contact && !contact.danchu_key && <button type="button" className="btxt" onClick={remove} disabled={busy}>지우기</button>}
      </Actions>
    </form>
  );
}

// ─── 일정 ───
export type EventPreset = { company_id?: string | null; contact_id?: string | null; quote_doc_id?: string | null; date?: string; kind?: string };
export function EventForm({ opts, event, preset = {} }: { opts: CrmOpts; event?: CrmEvent; preset?: EventPreset }) {
  const close = useSheetClose();
  const { busy, err, send } = useSend();
  const [v, setV] = useState(() => ({
    kind: (event?.kind ?? preset.kind ?? "meeting") as (typeof EVENT_KINDS)[number],
    title: event?.title ?? "",
    date: event ? ymdKst(event.starts_at) : preset.date ?? todayKst(),
    start: event && !event.all_day ? hmKst(event.starts_at) : "14:00",
    end: event?.ends_at ? hmKst(event.ends_at) : event ? "" : "15:00",
    all_day: event?.all_day ?? false,
    mode: event?.mode ?? (preset.kind === "call" ? "phone" : "in_person"),
    location: event?.location ?? "",
    company_id: event?.company_id ?? preset.company_id ?? "",
    attendee_contacts: event ? [...new Set([event.contact_id, ...event.attendee_contacts].filter(Boolean) as string[])] : preset.contact_id ? [preset.contact_id] : [],
    attendee_members: event?.attendee_members ?? (opts.me ? [opts.me] : []),
    attendees_extra: event?.attendees_extra ?? "",
    quote_doc_id: event?.quote_doc_id ?? preset.quote_doc_id ?? "",
    requests: event?.requests ?? "",
    remind: event?.remind ?? true,
  }));
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const contacts = opts.contacts.filter((c) => c.companyId === v.company_id);
  const quotes = opts.quotes.filter((q) => !v.company_id || q.companyId === v.company_id || q.id === v.quote_doc_id);
  const timed = v.kind !== "deadline" && !v.all_day;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("events", event ? "PATCH" : "POST", {
      ...(event ? { id: event.id } : {}), ...v, all_day: !timed, start: timed ? v.start : undefined, end: timed ? v.end || undefined : undefined,
      mode: v.kind === "deadline" || v.kind === "other" ? null : v.mode, company_id: v.company_id || null, contact_id: v.attendee_contacts[0] ?? null, quote_doc_id: v.quote_doc_id || null,
    });
    if (r) close();
  }
  async function remove() {
    if (!event) return;
    const r = await send("events", "DELETE", { id: event.id });
    if (r) { close(); location.assign(location.pathname + location.search.replace(/([?&])e=[^&]*&?/, "$1").replace(/[?&]$/, "")); }
  }
  return (
    <form className="crm-form" onSubmit={save}>
      <Seg value={v.kind} list={EVENT_KINDS} labels={EVENT_KIND} label="일정 종류" onChange={(kind) => set({ kind, mode: kind === "call" ? "phone" : v.mode === "phone" ? "in_person" : v.mode })} />
      <Field label="제목" htmlFor="ev-title"><input id="ev-title" className="inp" value={v.title} maxLength={200} required placeholder={v.kind === "deadline" ? "예: 수정 견적 회신 약속" : "예: 견적 설명 미팅"} onChange={(e) => set({ title: e.target.value })} /></Field>
      <div className="crm-row3">
        <Field label="날짜" htmlFor="ev-date"><input id="ev-date" className="inp tnum" type="date" value={v.date} required onChange={(e) => set({ date: e.target.value })} /></Field>
        {timed ? (
          <>
            <Field label="시작" htmlFor="ev-s"><input id="ev-s" className="inp tnum" type="time" step={600} value={v.start} required onChange={(e) => set({ start: e.target.value })} /></Field>
            <Field label="끝" htmlFor="ev-e"><input id="ev-e" className="inp tnum" type="time" step={600} value={v.end} onChange={(e) => set({ end: e.target.value })} /></Field>
          </>
        ) : <Field label="시간"><p className="crm-static">하루 종일</p></Field>}
      </div>
      {v.kind !== "deadline" && <label className="crm-check"><input type="checkbox" checked={v.all_day} onChange={(e) => set({ all_day: e.target.checked })} /> 시간 없이 그날 하루</label>}
      {(v.kind === "meeting" || v.kind === "call") && (
        <div className="grid2">
          <Field label="방식">
            <div className="chips" role="group" aria-label="방식">
              {EVENT_MODES.map((k) => <button key={k} type="button" className="chip chip--sm" aria-pressed={v.mode === k} onClick={() => set({ mode: k })}>{EVENT_MODE[k]}</button>)}
            </div>
          </Field>
          <Field label={v.mode === "video" ? "회의 링크" : v.mode === "phone" ? "연락처" : "장소"} htmlFor="ev-loc"><input id="ev-loc" className="inp" value={v.location} maxLength={300} onChange={(e) => set({ location: e.target.value })} /></Field>
        </div>
      )}
      <Field label="고객사" htmlFor="ev-co">
        <Select id="ev-co" value={v.company_id} onChange={(company_id) => set({ company_id, attendee_contacts: [], quote_doc_id: "" })}>
          <option value="">고르지 않음 (내부 일정)</option>
          {opts.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      {v.company_id && <Field label="고객사 참석"><Pick opts={contacts} value={v.attendee_contacts} onChange={(attendee_contacts) => set({ attendee_contacts })} label="고객사 참석" empty="이 고객사에 담당자가 없어요. 고객사 화면에서 먼저 추가해 주세요." /></Field>}
      <Field label="우리 참석" help="체크한 사람에게 전날 아침 9시에 메일과 앱 알림이 가요."><Pick opts={opts.members} value={v.attendee_members} onChange={(attendee_members) => set({ attendee_members })} label="우리 참석" empty="" /></Field>
      <Field label="그 밖의 참석" htmlFor="ev-extra"><input id="ev-extra" className="inp" value={v.attendees_extra} maxLength={300} placeholder="외부 참석자 이름" onChange={(e) => set({ attendees_extra: e.target.value })} /></Field>
      <Field label="관련 견적" htmlFor="ev-q">
        <Select id="ev-q" value={v.quote_doc_id} onChange={(quote_doc_id) => set({ quote_doc_id })}>
          <option value="">없음</option>
          {quotes.map((q) => <option key={q.id} value={q.id}>{q.name}{q.sub ? ` · ${q.sub}` : ""}</option>)}
        </Select>
      </Field>
      <Field label="요청사항" htmlFor="ev-req"><textarea id="ev-req" className="ta" rows={3} value={v.requests} maxLength={2000} placeholder="미팅에서 다룰 것, 고객사가 미리 부탁한 것" onChange={(e) => set({ requests: e.target.value })} /></Field>
      <label className="crm-check"><input type="checkbox" checked={v.remind} onChange={(e) => set({ remind: e.target.checked })} /> 전날 아침 9시에 메일·앱 알림 받기</label>
      <Err msg={err} />
      <Actions busy={busy} label="일정 저장">
        {event && <button type="button" className="btxt" onClick={remove} disabled={busy}>일정 지우기</button>}
      </Actions>
    </form>
  );
}

// ─── 기록 (미팅·통화·메일·메모) ───
export type ActPreset = { contact_id?: string | null; event_id?: string | null; quote_doc_id?: string | null; kind?: string; date?: string; time?: string; title?: string; attendee_contacts?: string[]; attendee_members?: string[] };
export function ActivityForm({ opts, companyId, preset = {}, compact = false }: { opts: CrmOpts; companyId: string; preset?: ActPreset; compact?: boolean }) {
  const close = useSheetClose();
  const { busy, err, send } = useSend();
  const now = () => new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
  const blank = () => ({
    kind: (preset.kind && (ACT_KINDS as readonly string[]).includes(preset.kind) ? preset.kind : "call") as (typeof ACT_KINDS)[number],
    title: preset.title ?? "", body: "", date: preset.date ?? todayKst(), time: preset.time ?? now(), duration_min: "",
    attendee_contacts: preset.attendee_contacts ?? (preset.contact_id ? [preset.contact_id] : []), attendee_members: preset.attendee_members ?? [],
    quote_doc_id: preset.quote_doc_id ?? "", next_title: "", next_due: "",
  });
  const [v, setV] = useState(blank);
  const [more, setMore] = useState(!compact);
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const contacts = opts.contacts.filter((c) => c.companyId === companyId);
  const quotes = opts.quotes.filter((q) => q.companyId === companyId);
  const hid = useId();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("activities", "POST", {
      ...v, company_id: companyId, contact_id: v.attendee_contacts[0] ?? null, event_id: preset.event_id ?? null, quote_doc_id: v.quote_doc_id || null,
      duration_min: v.duration_min === "" ? null : v.duration_min, next_category: v.kind === "email" ? "reply" : "contact",
    });
    if (!r) return;
    setV(blank());
    close();
  }
  return (
    <form className={`crm-form${compact ? " crm-form--inline" : ""}`} onSubmit={save} aria-label="기록 남기기">
      <Seg value={v.kind} list={ACT_KINDS} labels={ACT_KIND} label="기록 종류" onChange={(kind) => set({ kind })} />
      <label className="sr-only" htmlFor={`${hid}-b`}>내용</label>
      <textarea id={`${hid}-b`} className="ta" rows={compact ? 2 : 5} value={v.body} maxLength={8000} onFocus={() => setMore(true)}
        placeholder={v.kind === "memo" ? "기억해 둘 것" : `${ACT_KIND[v.kind]}에서 나눈 이야기, 요청사항, 정한 것, 남은 질문`} onChange={(e) => set({ body: e.target.value })} />
      {more && (
        <>
          {contacts.length > 0 && <Field label={v.kind === "memo" ? "관련 담당자" : "고객사 쪽"}><Pick opts={contacts} value={v.attendee_contacts} onChange={(attendee_contacts) => set({ attendee_contacts })} label="고객사 담당자" empty="" /></Field>}
          <div className="crm-row3">
            <Field label="날짜" htmlFor={`${hid}-d`}><input id={`${hid}-d`} className="inp tnum" type="date" max={todayKst()} value={v.date} onChange={(e) => set({ date: e.target.value })} /></Field>
            <Field label="시간" htmlFor={`${hid}-t`}><input id={`${hid}-t`} className="inp tnum" type="time" value={v.time} onChange={(e) => set({ time: e.target.value })} /></Field>
            {(v.kind === "meeting" || v.kind === "call") && <Field label="걸린 시간(분)" htmlFor={`${hid}-m`}><input id={`${hid}-m`} className="inp tnum" inputMode="numeric" value={v.duration_min} maxLength={4} onChange={(e) => set({ duration_min: e.target.value.replace(/\D/g, "") })} /></Field>}
          </div>
          {v.kind === "meeting" && <Field label="우리 참석"><Pick opts={opts.members} value={v.attendee_members} onChange={(attendee_members) => set({ attendee_members })} label="우리 참석" empty="" /></Field>}
          {quotes.length > 0 && (
            <Field label="관련 견적" htmlFor={`${hid}-q`}>
              <Select id={`${hid}-q`} value={v.quote_doc_id} onChange={(quote_doc_id) => set({ quote_doc_id })}>
                <option value="">없음</option>
                {quotes.map((q) => <option key={q.id} value={q.id}>{q.name}{q.sub ? ` · ${q.sub}` : ""}</option>)}
              </Select>
            </Field>
          )}
          <div className="crm-next">
            <Field label="다음 할 일" htmlFor={`${hid}-n`}><input id={`${hid}-n`} className="inp" value={v.next_title} maxLength={200} placeholder="예: 수정 견적 보내기" onChange={(e) => set({ next_title: e.target.value })} /></Field>
            <Field label="기한" htmlFor={`${hid}-nd`}><input id={`${hid}-nd`} className="inp tnum" type="date" min={todayKst()} value={v.next_due} onChange={(e) => set({ next_due: e.target.value })} /></Field>
          </div>
        </>
      )}
      <Err msg={err} />
      <div className="crm-acts">
        <span className="crm-hint">{v.next_title && v.next_due ? "할 일은 기한 날 아침에 알려요" : "우리 기관만 봐요"}</span>
        <button type="submit" className={compact ? "b2" : "b1"} disabled={busy || (!v.body.trim() && !v.title.trim())}>{busy ? "저장 중" : "남기기"}</button>
      </div>
    </form>
  );
}

/** 기록 지우기 (기록 줄 옆) */
export function ActivityDelete({ id }: { id: string }) {
  const { busy, err, send } = useSend();
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" className="crm-lk" onClick={() => setAsk(true)}>지우기</button>;
  return (
    <span className="crm-confirm">
      <button type="button" className="crm-lk" onClick={() => send("activities", "DELETE", { id })} disabled={busy}>정말 지우기</button>
      <button type="button" className="crm-lk" onClick={() => setAsk(false)}>그대로 두기</button>
      <Err msg={err} />
    </span>
  );
}

// ─── 할 일 ───
export function TaskCheck({ id, title, done, sub }: { id: string; title: string; done: boolean; sub: string }) {
  const { busy, err, send } = useSend();
  const [on, setOn] = useState(done);
  useEffect(() => setOn(done), [done]);
  const hid = useId();
  return (
    <div className="crm-task" data-done={on ? "1" : "0"}>
      <input id={hid} type="checkbox" checked={on} disabled={busy} onChange={async (e) => { const next = e.target.checked; setOn(next); if (!(await send("tasks", "PATCH", { id, done: next }))) setOn(!next); }} />
      <label htmlFor={hid}><span>{title}</span>{sub && <small>{sub}</small>}</label>
      <Err msg={err} />
    </div>
  );
}

export function TaskForm({ opts, companyId, contactId }: { opts: CrmOpts; companyId: string | null; contactId?: string | null }) {
  const close = useSheetClose();
  const { busy, err, send } = useSend();
  const [v, setV] = useState({ title: "", due_on: "", category: "contact" as string, assignee: opts.me, contact_id: contactId ?? "", memo: "" });
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const contacts = opts.contacts.filter((c) => c.companyId === companyId);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("tasks", "POST", { ...v, company_id: companyId, contact_id: v.contact_id || null, due_on: v.due_on || null, assignee: v.assignee || null });
    if (r) { setV({ ...v, title: "", memo: "", due_on: "" }); close(); }
  }
  return (
    <form className="crm-form" onSubmit={save}>
      <Field label="할 일" htmlFor="tk-t"><input id="tk-t" className="inp" value={v.title} maxLength={200} required placeholder="예: 회복군 포함안 금액 다시 보내기" onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="종류">
        <div className="chips" role="group" aria-label="할 일 종류">
          {TASK_CATS.map((k) => <button key={k} type="button" className="chip chip--sm" aria-pressed={v.category === k} onClick={() => set({ category: k })}>{TASK_CAT[k]}</button>)}
        </div>
      </Field>
      <div className="grid2">
        <Field label="기한" htmlFor="tk-d" help="기한 날 아침 9시에 맡은 사람에게 알려요."><input id="tk-d" className="inp tnum" type="date" value={v.due_on} onChange={(e) => set({ due_on: e.target.value })} /></Field>
        <Field label="맡은 사람" htmlFor="tk-a">
          <Select id="tk-a" value={v.assignee} onChange={(assignee) => set({ assignee })}>
            <option value="">정하지 않음</option>
            {opts.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
      </div>
      {contacts.length > 0 && (
        <Field label="담당자" htmlFor="tk-c">
          <Select id="tk-c" value={v.contact_id} onChange={(contact_id) => set({ contact_id })}>
            <option value="">고객사 전체</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="메모" htmlFor="tk-m"><textarea id="tk-m" className="ta" rows={2} value={v.memo} maxLength={2000} onChange={(e) => set({ memo: e.target.value })} /></Field>
      <Err msg={err} />
      <Actions busy={busy} label="할 일 추가" />
    </form>
  );
}

/** 할 일에 한 일 한 줄 남기기 (CRMQUOTATION TaskAction) */
export function TaskActionAdd({ taskId }: { taskId: string }) {
  const { busy, err, send } = useSend();
  const [body, setBody] = useState("");
  const hid = useId();
  return (
    <form className="crm-inline" onSubmit={async (e) => { e.preventDefault(); if (await send("task-actions", "POST", { task_id: taskId, body })) setBody(""); }}>
      <label htmlFor={hid} className="sr-only">한 일</label>
      <input id={hid} className="inp" value={body} maxLength={1000} placeholder="한 일 한 줄 · 예: 메일로 다시 물어봄" onChange={(e) => setBody(e.target.value)} />
      <button type="submit" className="b2 bsm" disabled={busy || !body.trim()}>남기기</button>
      <Err msg={err} />
    </form>
  );
}

// ─── 견적 진행 ───
export function QuoteStageForm({ quote, opts }: { quote: CrmQuote; opts: CrmOpts }) {
  const close = useSheetClose();
  const { busy, err, send } = useSend();
  const stage0 = quote.deal_stage ?? (quote.status === "sent" ? "sent" : "draft");
  const [v, setV] = useState({
    stage: stage0, lost_reason: quote.lost_reason || "", contract_amount: quote.contract_amount != null ? String(quote.contract_amount) : "", note: "",
    contact_id: quote.contact_id ?? "", sent_on: quote.sent_at ? ymdKst(quote.sent_at) : "",
  });
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const contacts = opts.contacts.filter((c) => c.companyId === quote.company_id);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("quotes", "PATCH", {
      id: quote.id, stage: v.stage, lost_reason: v.lost_reason, contract_amount: v.stage === "won" ? v.contract_amount || null : undefined, note: v.note,
      contact_id: v.contact_id || null, sent_on: v.sent_on || undefined,
    });
    if (r) close();
  }
  const amt = Number(v.contract_amount.replace(/\D/g, "")) || 0;
  return (
    <form className="crm-form" onSubmit={save}>
      <p className="crm-note tnum">{quote.doc_no} · {quote.title || quote.client} · 공급가액 {quote.supply.toLocaleString("ko-KR")}원</p>
      <Field label="진행 상태">
        <div className="chips" role="group" aria-label="진행 상태">
          {QUOTE_STAGES.map((k) => <button key={k} type="button" className="chip chip--sm" aria-pressed={v.stage === k} onClick={() => set({ stage: k })}>{QUOTE_STAGE[k]}</button>)}
        </div>
      </Field>
      {v.stage === "lost" && (
        <Field label="실패 사유">
          <div className="chips" role="group" aria-label="실패 사유">
            {LOST_REASONS.map((k) => <button key={k} type="button" className="chip chip--sm" aria-pressed={v.lost_reason === k} onClick={() => set({ lost_reason: k })}>{k}</button>)}
          </div>
        </Field>
      )}
      {v.stage === "won" && (
        <Field label="계약 금액(원)" htmlFor="qs-amt" help={amt ? `${amt.toLocaleString("ko-KR")}원` : "모르면 비워 두고 나중에 적어요."}>
          <input id="qs-amt" className="inp tnum" inputMode="numeric" value={v.contract_amount} maxLength={14} onChange={(e) => set({ contract_amount: e.target.value.replace(/\D/g, "") })} />
        </Field>
      )}
      <div className="grid2">
        <Field label="받는 담당자" htmlFor="qs-c">
          <Select id="qs-c" value={v.contact_id} onChange={(contact_id) => set({ contact_id })}>
            <option value="">고르지 않음</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="보낸 날" htmlFor="qs-s"><input id="qs-s" className="inp tnum" type="date" max={todayKst()} value={v.sent_on} onChange={(e) => set({ sent_on: e.target.value })} /></Field>
      </div>
      <Field label="추적 메모" htmlFor="qs-n" help="고객사 반응, 비교 중인 기관, 다음에 물어볼 것"><textarea id="qs-n" className="ta" rows={3} value={v.note} maxLength={2000} onChange={(e) => set({ note: e.target.value })} /></Field>
      <Err msg={err} />
      <Actions busy={busy} label="진행 저장" />
    </form>
  );
}

/** 아직 고객사에 묶이지 않은 견적서를 이 고객사에 묶기 */
export function QuoteLinkForm({ companyId, contactId, loose }: { companyId: string; contactId: string | null; loose: Opt[] }) {
  const close = useSheetClose();
  const { busy, err, send } = useSend();
  const [id, setId] = useState(loose[0]?.id ?? "");
  if (!loose.length) return <p className="crm-note">묶을 견적서가 없어요. 견적서 화면에서 만든 견적서 중 고객사가 정해지지 않은 것만 여기에 나와요.</p>;
  return (
    <form className="crm-form" onSubmit={async (e) => { e.preventDefault(); if (await send("quotes", "PATCH", { id, company_id: companyId, contact_id: contactId })) close(); }}>
      <Field label="견적서" htmlFor="ql-id">
        <Select id="ql-id" value={id} onChange={setId}>{loose.map((q) => <option key={q.id} value={q.id}>{q.name}{q.sub ? ` · ${q.sub}` : ""}</option>)}</Select>
      </Field>
      <Err msg={err} />
      <Actions busy={busy} label="이 고객사에 묶기" />
    </form>
  );
}

// ─── 합치기 ───
export function MergeButton({ keep, drop, label }: { keep: string; drop: string; label: string }) {
  const router = useRouter();
  const { busy, err, send } = useSend();
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" className="crm-lk" onClick={() => setAsk(true)}>{label}</button>;
  return (
    <span className="crm-confirm">
      <button type="button" className="crm-lk" disabled={busy} onClick={async () => { const r = await send("merge", "POST", { keep, drop }); if (r) router.refresh(); }}>{busy ? "합치는 중" : "합치기 확인"}</button>
      <button type="button" className="crm-lk" onClick={() => setAsk(false)}>취소</button>
      <Err msg={err} />
    </span>
  );
}

/** 고객사 지우기 (단추에서 선정된 고객사는 서버가 막는다) */
export function CompanyDelete({ id, back }: { id: string; back: string }) {
  const { busy, err, send } = useSend();
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" className="btxt" onClick={() => setAsk(true)}>고객사 지우기</button>;
  return (
    <div className="crm-confirm">
      <span className="crm-hint">담당자·기록·일정·할 일이 함께 지워져요. 견적서는 남아요.</span>
      <button type="button" className="b2 b2--danger bsm" disabled={busy} onClick={async () => { if (await send("companies", "DELETE", { id })) location.assign(back); }}>지우기</button>
      <button type="button" className="btxt" onClick={() => setAsk(false)}>취소</button>
      <Err msg={err} />
    </div>
  );
}
