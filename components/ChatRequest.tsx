"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CaretDown,
  CaretRight,
  Check,
  CheckCircle,
  Dna,
  FileText,
  Flask,
  Heartbeat,
  PaperPlaneRight,
  PencilSimple,
  Plus,
  X,
} from "@phosphor-icons/react";
import { DETAILS, WIZ, type Cat, type Field, type Values } from "@/lib/rfq-schema";
import { OrgPicker } from "@/components/OrgPicker";
import { addBusinessDays, nowSeoul } from "@/lib/dates";
import { Lockup } from "@/components/Logo";
import "./chat-request.css";

/**
 * 대화형 빠른 견적 요청 (설문 뒤).
 * 한 번에 한 질문만 묻고, 설문으로 채운 값은 다시 묻지 않는다.
 * 휴대폰은 한 화면(100dvh) 안에서 끝나고, PC는 오른쪽에 요청서 미리보기를 함께 둔다.
 */

type Step =
  | { k: "name" }
  | { k: "tests" }
  | { k: "pick" }
  | { k: "conds"; cat: Cat; page: number }
  | { k: "cond"; cat: Cat; field: string }
  | { k: "count" }
  | { k: "nominees" }
  | { k: "deadline" }
  | { k: "date" }
  | { k: "confid" }
  | { k: "review" };

type Said = { q: string; a: string; back: Step };

const ICONS: Partial<Record<Cat, typeof Flask>> = { 일반독성: Flask, 유전독성: Dna, 안전성약리: Heartbeat };
const PAGE = 5;
const COUNTS = [
  { v: "3곳", sm: "빨리 비교" },
  { v: "5곳", sm: "넓게 비교" },
  { v: "전체", label: "분야가 맞는 모든 기관" },
];
const CONFID: [string, string][] = [
  ["일반", "회사명은 선정 뒤"],
  ["CDA 필요 (단추 표준 CDA)", "단추 표준 CDA"],
  ["자체 CDA 사용", "자체 CDA"],
];
const WEEK = "일월화수목금토";
const CONSENTS = WIZ.flatMap((w) => w.fields).filter((f) => f.id.startsWith("agree"));

const arr = (v: Values[string]) => (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []);
const show = (v: Values[string]) => arr(v).join(", ") || "정하지 않음";
const clean = (label = "") => label.replace(/\s*\(.*\)\s*$/, "");
/** 받침이 있으면 "을", 없으면 "를" */
const eul = (w: string) => {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return "을";
  return (c - 0xac00) % 28 ? "을" : "를";
};
const ymd = (d: Date) => d.toLocaleDateString("sv-SE");
const short = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")} (${WEEK[d.getDay()]})`;
};
const itemsField = (cat: Cat) => DETAILS[cat].find((f) => f.id === "items" || f.id === "segment");
const isEmpty = (v: Values[string]) => arr(v).length === 0;

export function ChatRequest({
  values,
  onChange,
  onSubmit,
  busy,
  error,
  saveState,
  closeHref,
  preview = false,
}: {
  values: Values;
  onChange: (id: string, v: string | string[] | boolean) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string;
  saveState: string;
  closeHref: string;
  preview?: boolean;
}) {
  // 설문이 채운 값. 바꾼 값은 이것과 비교해 형광펜으로 보여 준다
  const [orig] = useState<Values>(values);
  const [step, setStep] = useState<Step>(() => (values.substance ? { k: "tests" } : { k: "name" }));
  const [said, setSaid] = useState<Said[]>([]);
  const [queue, setQueue] = useState<Cat[]>([]);
  const [picked, setPicked] = useState<Cat[]>([]);
  const [multi, setMulti] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [agree, setAgree] = useState(!!(values.agreePrivacy && values.agreeTerms && values.agreeShare));
  const [terms, setTerms] = useState(false);
  const [fromReview, setFromReview] = useState(false);
  const qRef = useRef<HTMLParagraphElement>(null);

  const cats = useMemo(() => (Array.isArray(values.categories) ? values.categories : []) as Cat[], [values.categories]);
  const count = (c: Cat) => Math.max(1, arr(values[`${c}.${itemsField(c)?.id ?? "items"}`]).length);
  const total = cats.reduce((n, c) => n + count(c), 0);
  const changes = useMemo(() => {
    const out: { cat: Cat; f: Field; was: string; now: string }[] = [];
    for (const c of cats)
      for (const f of DETAILS[c] ?? []) {
        const k = `${c}.${f.id}`;
        if (JSON.stringify(arr(orig[k])) !== JSON.stringify(arr(values[k])))
          out.push({ cat: c, f, was: show(orig[k]), now: show(values[k]) });
      }
    return out;
  }, [values, cats, orig]);
  const replyBy = typeof values.replyBy === "string" && values.replyBy ? values.replyBy : ymd(addBusinessDays(nowSeoul(), 7));
  const croCount = String(values.croCount || "3곳");
  const confid = String(values.confid || "일반");
  const sendLabel = croCount === "전체" ? "요청 보내기" : `${croCount}에 보내기`;

  /** 다음 질문으로. 적던 글은 비운다 */
  const go = (s: Step) => {
    setText("");
    setStep(s);
  };
  useEffect(() => {
    qRef.current?.focus({ preventScroll: true });
  }, [step]);

  /** 답을 남기고 다음 질문으로. 확인 화면에서 고치러 왔으면 확인 화면으로 돌아간다 */
  const answer = (q: string, a: string, next: Step, back: Step = step) => {
    setSaid((s) => [...s.filter((x) => x.q !== q), { q, a, back }]);
    go(fromReview && !["conds", "cond", "pick", "nominees", "date"].includes(next.k) ? { k: "review" } : next);
  };
  const nextCat = (rest: Cat[]): Step => (rest.length ? { k: "conds", cat: rest[0], page: 0 } : { k: "count" });
  const prog = { name: 1, tests: 1, pick: 1, conds: 1, cond: 1, count: 2, nominees: 2, deadline: 3, date: 3, confid: 4, review: 4 }[step.k];
  const last = said[said.length - 1];
  const earlier = said.slice(0, -1);
  const fromSurvey = Array.isArray(values.advisorAnswers) ? (values.advisorAnswers as string[]) : [];

  /* ── 질문 ─────────────────────────────── */
  let q = "";
  let hint = "";
  let body: React.ReactNode = null;
  let ans: React.ReactNode = null;

  const composer = (ph: string, onSend: (v: string) => void, big = false, label = ph) => (
    <form
      className={`cr-comp${big ? "" : " cr-comp--sm"}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSend(text.trim());
      }}
    >
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={ph} aria-label={label} />
      <button type="submit" aria-label="보내기" disabled={!text.trim()}>
        <PaperPlaneRight size={big ? 20 : 18} />
      </button>
    </form>
  );
  const opt = (label: string, onClick: () => void, o: { sm?: string; pri?: boolean; arrow?: boolean; icon?: React.ReactNode; disabled?: boolean } = {}) => (
    <button type="button" key={label} className={`cr-o${o.pri ? " cr-o--pri" : ""}`} onClick={onClick} disabled={o.disabled}>
      {o.icon}
      {label}
      {o.sm && <small>{o.sm}</small>}
      {o.arrow && <ArrowRight size={20} className="cr-end" />}
    </button>
  );

  switch (step.k) {
    case "name": {
      q = "시험물질을 뭐라고 부를까요?";
      hint = "코드명 가능";
      ans = composer("예: DC-101", (v) => { onChange("substance", v); answer(q, v, { k: "tests" }); }, true, "시험물질 이름");
      break;
    }
    case "tests": {
      q = `이 시험 ${total}개로 빠른 견적을 받을까요?`;
      hint = fromSurvey.length ? "빈 조건은 기관이 회신에서 제안" : "빈 조건은 기관이 회신에서 제안";
      body = (
        <div className="cr-card">
          {cats.map((c) => {
            const I = ICONS[c] ?? FileText;
            const f = itemsField(c);
            const sub = [arr(values[`${c}.${f?.id}`]).join(" · "), arr(values[`${c}.species`]).join(", ")].filter(Boolean).join(" / ");
            return (
              <div className="cr-r" key={c}>
                <I size={20} aria-hidden />
                <span>
                  <b>{c}</b>
                  {sub && <small>{sub}</small>}
                </span>
                <span className="cr-n">{count(c)}</span>
              </div>
            );
          })}
        </div>
      );
      ans = (
        <>
          {opt("이대로 할게요", () => answer(q, "이대로 할게요", { k: "count" }), { pri: true, arrow: true })}
          {opt("고칠게요", () => { setPicked([]); answer(q, "고칠게요", { k: "pick" }); }, { sm: "한 시험씩" })}
        </>
      );
      break;
    }
    case "pick": {
      q = "어느 시험을 고칠까요?";
      hint = "복수 선택";
      ans = (
        <>
          <p className="cr-lab">복수 선택</p>
          <div className="cr-ms" role="group" aria-label="고칠 시험">
            {cats.map((c) => {
              const on = picked.includes(c);
              const I = ICONS[c] ?? FileText;
              return (
                <button key={c} type="button" aria-pressed={on} className={on ? "on" : ""} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c) : [...p, c]))}>
                  <I size={18} aria-hidden />
                  {c}
                  <small>{count(c)}</small>
                  {on ? <Check size={16} className="cr-end" /> : <Plus size={16} className="cr-end" />}
                </button>
              );
            })}
          </div>
          {opt(picked.length ? `${picked.length}개 고치기` : "고칠 시험을 골라 주세요", () => {
            setQueue(picked.slice(1));
            answer(q, picked.join(", "), nextCat(picked));
          }, { pri: true, arrow: true, disabled: !picked.length })}
          <button type="button" className="cr-lk" onClick={() => answer(q, "고칠 게 없어요", { k: "count" })}>고칠 게 없어요</button>
        </>
      );
      break;
    }
    case "conds": {
      const fields = DETAILS[step.cat] ?? [];
      const pages = Math.ceil(fields.length / PAGE);
      const page = fields.slice(step.page * PAGE, step.page * PAGE + PAGE);
      q = "어떤 조건을 바꿀까요?";
      hint = `${step.cat}의 조건이에요. 바꿀 줄을 눌러 주세요.`;
      body = (
        <div className="cr-card">
          {page.map((f) => {
            const k = `${step.cat}.${f.id}`;
            const ch = changes.find((x) => x.cat === step.cat && x.f.id === f.id);
            return (
              <button type="button" className="cr-r cr-r--btn" key={f.id} onClick={() => { setMulti(arr(values[k])); go({ k: "cond", cat: step.cat, field: f.id }); }}>
                <b>{clean(f.label)}</b>
                <span className="cr-v">
                  {ch ? (
                    <>
                      <s className="cr-was">{ch.was}</s>
                      <mark className="cr-now">{ch.now}</mark>
                    </>
                  ) : (
                    show(values[k])
                  )}
                </span>
                <CaretRight size={16} className="cr-go" aria-hidden />
              </button>
            );
          })}
        </div>
      );
      ans = (
        <>
          {opt("다 고쳤어요", () => {
            const rest = queue;
            setQueue(rest.slice(1));
            const n = changes.filter((x) => x.cat === step.cat).length;
            answer(`${step.cat} 조건`, n ? `${n}개 바꿈` : "그대로", nextCat(rest));
          }, { pri: true })}
          {pages > 1 && (
            <button type="button" className="cr-lk" onClick={() => go({ ...step, page: (step.page + 1) % pages })}>
              {step.page + 1 < pages ? `다른 조건 보기 (${step.page + 1}/${pages})` : "처음 조건 보기"}
            </button>
          )}
        </>
      );
      break;
    }
    case "cond": {
      const f = (DETAILS[step.cat] ?? []).find((x) => x.id === step.field)!;
      const k = `${step.cat}.${f.id}`;
      const lab = clean(f.label);
      const back: Step = { k: "conds", cat: step.cat, page: Math.floor((DETAILS[step.cat] ?? []).indexOf(f) / PAGE) };
      const done = (v: string | string[]) => {
        onChange(k, v);
        go(back);
      };
      q = f.type === "text" ? `${lab}${eul(lab)} 적어 주세요` : f.type === "chips" ? `${lab}${eul(lab)} 골라 주세요` : `${lab}${eul(lab)} 어떻게 할까요?`;
      hint = `지금은 ${show(values[k])}예요.${f.help ? ` ${f.help}` : ""}`;
      if (f.type === "chips") {
        ans = (
          <>
            <p className="cr-lab">복수 선택</p>
            <div className="cr-ms cr-ms--scroll" role="group" aria-label={lab}>
              {(f.options ?? []).map((o) => {
                const on = multi.includes(o);
                return (
                  <button key={o} type="button" aria-pressed={on} className={on ? "on" : ""} onClick={() => setMulti((m) => (on ? m.filter((x) => x !== o) : [...m, o]))}>
                    {o}
                    {on ? <Check size={16} className="cr-end" /> : <Plus size={16} className="cr-end" />}
                  </button>
                );
              })}
            </div>
            {opt("골랐어요", () => done(multi), { pri: true })}
          </>
        );
      } else if (f.type === "text") {
        ans = composer(f.placeholder || "직접 입력해 주세요", (v) => done(v));
      } else {
        const os = f.options ?? [];
        ans = (
          <>
            <div className={os.length <= 3 ? "cr-row" : "cr-g2"}>
              {os.map((o) => opt(o, () => done(o), { pri: arr(values[k]).includes(o), sm: arr(orig[k]).includes(o) ? "처음 값" : undefined }))}
            </div>
            <button type="button" className="cr-lk" onClick={() => go(back)}>바꾸지 않을게요</button>
          </>
        );
      }
      break;
    }
    case "count": {
      q = "몇 곳에서 견적을 받을까요?";
      hint = "참여 순서대로 마감";
      body = changes.length ? (
        <div className="cr-card">
          <div className="cr-r">
            <span>
              <b>바꾼 조건 {changes.length}개</b>
              <small>{[...new Set(changes.map((c) => c.cat))].join(", ")}</small>
            </span>
            <span className="cr-v">
              {clean(changes[0].f.label)} <s className="cr-was">{changes[0].was}</s>
              <mark className="cr-now">{changes[0].now}</mark>
            </span>
          </div>
        </div>
      ) : null;
      ans = (
        <>
          {COUNTS.map((c) =>
            opt(c.label ?? c.v, () => { onChange("croCount", c.v); answer(q, c.label ?? c.v, { k: "deadline" }); }, { sm: c.sm, pri: croCount === c.v }),
          )}
          <button type="button" className="cr-lk" onClick={() => go({ k: "nominees" })}>
            {arr(values.nominees).length ? `꼭 받을 기관 ${arr(values.nominees).length}곳 고름` : "꼭 받고 싶은 기관이 있으면 골라 주세요"}
          </button>
        </>
      );
      break;
    }
    case "nominees": {
      q = "꼭 견적을 받고 싶은 기관을 골라 주세요";
      hint = "지명 기관 자리는 참여 기한까지 유지";
      ans = (
        <>
          <div className="cr-scroll">
            <OrgPicker id="nominees" values={values} onChange={(id, v) => onChange(id, v)} />
          </div>
          {opt("다 골랐어요", () => go({ k: "count" }), { pri: true })}
        </>
      );
      break;
    }
    case "deadline": {
      q = "언제까지 회신을 받을까요?";
      hint = "평일 기준";
      const opts = [5, 7, 10].map((n) => ({ n, d: ymd(addBusinessDays(nowSeoul(), n)) }));
      ans = (
        <div className="cr-g2">
          {opts.map(({ n, d }) => opt(`평일 ${n}일`, () => { onChange("replyBy", d); answer(q, `평일 ${n}일`, { k: "review" }); }, { sm: short(d).slice(0, 5), pri: replyBy === d }))}
          {opt("날짜 고르기", () => go({ k: "date" }))}
        </div>
      );
      break;
    }
    case "date": {
      const min = ymd(addBusinessDays(nowSeoul(), 2));
      q = "회신 받을 날짜를 골라 주세요";
      hint = "평일 2일 뒤부터 선택 가능";
      ans = (
        <form
          className="cr-comp"
          onSubmit={(e) => {
            e.preventDefault();
            if (text && text >= min) { onChange("replyBy", text); answer("언제까지 회신을 받을까요?", short(text), { k: "review" }, { k: "deadline" }); }
          }}
        >
          <input type="date" min={min} value={text} onChange={(e) => setText(e.target.value)} aria-label="회신 기한" />
          <button type="submit" aria-label="이 날짜로 정하기" disabled={!text || text < min}>
            <Check size={20} />
          </button>
        </form>
      );
      break;
    }
    case "confid": {
      q = "회사 정보는 어떻게 공개할까요?";
      hint = "회사명·연락처는 선정한 기관에만 공개. CDA 선택 시 첨부는 체결 확인 뒤 공개";
      ans = <>{CONFID.map(([v, l]) => opt(l, () => { onChange("confid", v); answer(q, l, { k: "review" }); }, { pri: confid === v }))}</>;
      break;
    }
    case "review": {
      q = "이대로 보낼까요?";
      const edit = (s: Step) => { setFromReview(true); go(s); };
      const row = (b: string, v: React.ReactNode, s: Step) => (
        <button type="button" className="cr-r cr-r--btn" onClick={() => edit(s)}>
          <b>{b}</b>
          <span className="cr-v">{v}</span>
          <PencilSimple size={16} className="cr-go" aria-label="고치기" />
        </button>
      );
      body = (
        <div className="cr-card">
          <p className="cr-hd">기관이 받을 내용</p>
          {row(`시험 ${total}개`, changes.length ? <>조건 <mark className="cr-now">{changes.length}개</mark> 고침</> : "설문 조건 그대로", { k: "pick" })}
          {row("받을 곳", croCount === "전체" ? "분야가 맞는 모든 기관" : croCount, { k: "count" })}
          {row("회신 기한", <span className="cr-mono">{short(replyBy)}</span>, { k: "deadline" })}
          {row("정보 공개", CONFID.find(([v]) => v === confid)?.[1] ?? confid, { k: "confid" })}
        </div>
      );
      ans = (
        <>
          <div className="cr-agr">
            <label>
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => {
                  setAgree(e.target.checked);
                  for (const id of ["agreePrivacy", "agreeTerms", "agreeShare"]) onChange(id, e.target.checked);
                }}
              />
              필수 약관 3개에 모두 동의합니다
            </label>
            <button type="button" onClick={() => setTerms(true)}>보기</button>
          </div>
          {error && <p className="cr-err" role="alert">{error}</p>}
          {opt(busy ? "보내는 중이에요" : sendLabel, onSubmit, { pri: true, arrow: !busy, disabled: !agree || busy || preview })}
        </>
      );
      break;
    }
  }

  /* ── 요청서 미리보기 ─────────────────────── */
  const doc = (
    <article className="cr-doc" aria-label="견적 요청서 미리보기">
      <header className="cr-doc__hd">
        <h2>견적 요청서</h2>
        <Lockup size={18} />
      </header>
      <dl className="cr-doc__meta">
        <div><dt>시험물질</dt><dd>{values.substance ? String(values.substance) : <i className="cr-sk" aria-label="아직 정하지 않음" />}</dd></div>
        <div><dt>받는 곳</dt><dd>{croCount === "전체" ? "분야가 맞는 모든 기관" : `비임상 CRO ${croCount}`}</dd></div>
        <div><dt>회신 기한</dt><dd>{prog < 3 && !values.replyBy ? <i className="cr-sk" aria-label="아직 정하지 않음" /> : short(replyBy)}</dd></div>
        <div><dt>개발 분야</dt><dd>{values.devField ? String(values.devField) : <i className="cr-sk" aria-label="아직 정하지 않음" />}</dd></div>
        <div><dt>제출처</dt><dd>{arr(values.authority).join(", ") || <i className="cr-sk" aria-label="아직 정하지 않음" />}</dd></div>
        <div><dt>정보 공개</dt><dd>{CONFID.find(([v]) => v === confid)?.[1]}</dd></div>
      </dl>
      <table className="cr-doc__tb">
        <thead>
          <tr><th>시험</th><th>조건</th></tr>
        </thead>
        <tbody>
          {cats.map((c) => (
            <tr key={c}>
              <td><b>{c}</b></td>
              <td>
                {(DETAILS[c] ?? [])
                  .filter((f) => !isEmpty(values[`${c}.${f.id}`]) || !isEmpty(orig[`${c}.${f.id}`]))
                  .map((f) => {
                    const ch = changes.find((x) => x.cat === c && x.f.id === f.id);
                    return (
                      <span key={f.id} className="cr-doc__c">
                        <em>{clean(f.label)}</em>{" "}
                        {ch ? <><s className="cr-was">{ch.was}</s><mark className="cr-now">{ch.now}</mark></> : show(values[`${c}.${f.id}`])}
                      </span>
                    );
                  })}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={2}>시험 {total}개{arr(values.authority).length ? ` · ${arr(values.authority)[0]} 제출` : ""}</td></tr>
        </tfoot>
      </table>
      <p className="cr-doc__foot">빈 조건은 기관이 회신에서 제안. 회사명·연락처는 선정한 기관에만 공개</p>
    </article>
  );

  return (
    <div className="cr" role="dialog" aria-modal="true" aria-label="새 견적 요청">
      <header className="cr-bar">
        <Link href={closeHref} className="cr-x" aria-label="닫기">
          <X size={20} />
        </Link>
        <b className="cr-title">빠른 견적 요청</b>
        <span className="cr-save" role="status">{saveState}</span>
        <button type="button" className="cr-docbtn" onClick={() => setSheet(true)}>
          <FileText size={18} aria-hidden />
          요청서
        </button>
      </header>
      <div className="cr-prog" aria-hidden>
        {[1, 2, 3, 4].map((n) => <i key={n} className={n <= prog ? "on" : ""} />)}
      </div>
      <div className="cr-main">
        <section className="cr-chat">
          <div className="cr-th">
            {(fromSurvey.length > 0 || earlier.length > 0) && (
              <div className="cr-foldwrap">
                <button type="button" className="cr-fold" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                  {earlier.length
                    ? `앞의 답 ${earlier.length + (fromSurvey.length ? 1 : 0)}개`
                    : `설문 답 ${fromSurvey.length}개 반영`}
                  <CaretDown size={14} aria-hidden />
                </button>
                {open && (
                  <ul className="cr-past">
                    {fromSurvey.map((line) => {
                      const [k, ...rest] = line.split(": ");
                      return <li key={line}><span>{k}</span><b>{rest.join(": ")}</b></li>;
                    })}
                    {earlier.map((s) => (
                      <li key={s.q}>
                        <span>{s.q}</span>
                        <button type="button" onClick={() => { setOpen(false); go(s.back); }}>
                          {s.a}
                          <PencilSimple size={14} aria-label="고치기" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {last && (
              <button type="button" className="cr-me" onClick={() => go(last.back)} aria-label={`${last.a}, 고치기`}>
                {last.a}
                <PencilSimple size={14} aria-hidden />
              </button>
            )}
            <p className="cr-q" tabIndex={-1} ref={qRef}>{q}</p>
            {hint && <p className="cr-hint">{hint}</p>}
            {body}
          </div>
          <div className="cr-ans">{ans}</div>
        </section>
        <aside className="cr-pv" aria-label="미리보기">
          <p className="cr-pv__t">미리보기</p>
          <div className="cr-pv__paper">{doc}</div>
        </aside>
      </div>
      {sheet && (
        <div className="cr-sheet" role="dialog" aria-modal="true" aria-label="견적 요청서 미리보기">
          <button type="button" className="cr-dim" aria-label="닫기" onClick={() => setSheet(false)} />
          <div className="cr-sheet__in">
            <div className="cr-sheet__hd">
              <b>견적 요청서 미리보기</b>
              <button type="button" onClick={() => setSheet(false)} aria-label="닫기"><X size={20} /></button>
            </div>
            <div className="cr-sheet__bd">{doc}</div>
          </div>
        </div>
      )}
      {terms && (
        <div className="cr-sheet" role="dialog" aria-modal="true" aria-label="필수 약관">
          <button type="button" className="cr-dim" aria-label="닫기" onClick={() => setTerms(false)} />
          <div className="cr-sheet__in">
            <div className="cr-sheet__hd">
              <b>필수 약관 3개</b>
              <button type="button" onClick={() => setTerms(false)} aria-label="닫기"><X size={20} /></button>
            </div>
            <ul className="cr-terms">
              {CONSENTS.map((f) => (
                <li key={f.id}>
                  <b>[필수] {f.label}</b>
                  {f.help && <span>{f.help}</span>}
                  {f.link && <a href={f.link.href} target="_blank" rel="noreferrer">{f.link.text} 전문 보기</a>}
                </li>
              ))}
            </ul>
            <div className="cr-ans">
              {opt("모두 동의하기", () => { setAgree(true); for (const id of ["agreePrivacy", "agreeTerms", "agreeShare"]) onChange(id, true); setTerms(false); }, { pri: true, icon: <CheckCircle size={20} /> })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
