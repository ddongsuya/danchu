"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CaretRight, Check, Paperclip, PencilSimple, Plus, X } from "@phosphor-icons/react";
import type { Field, Values } from "@/lib/rfq-schema";
import { cleanLabel, coreFields, detailLines, MAX_DETAIL_TARGETS, PROGRESS_FIELDS, showValue, SUBSTANCE_FIELDS } from "@/lib/detail-quote";
import type { Cat } from "@/lib/rfq-schema";
import { addBusinessDays, nowSeoul } from "@/lib/dates";
import { uploadToSigned } from "@/lib/upload";
import { won } from "@/lib/format";
import { ChatShell, Composer, Opt, type Said } from "@/components/ChatShell";

/**
 * 상세 견적 요청 (0042). 비교 보고서가 열린 뒤 1차 견적을 낸 기관 가운데 1~3곳을 골라 상세 조건을 보낸다.
 * 한 번에 한 질문. 1차와 달라진 값만 형광펜으로 보인다.
 */

type Step =
  | { k: "targets" }
  | { k: "substance" }
  | { k: "progress" }
  | { k: "field"; key: string; back: Step }
  | { k: "diff" }
  | { k: "cat" }
  | { k: "conds"; cat: Cat }
  | { k: "deadline" }
  | { k: "date" }
  | { k: "review" }
  | { k: "done" };

const WEEK = "일월화수목금토";
const ymd = (d: Date) => d.toLocaleDateString("sv-SE");
const short = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")} (${WEEK[d.getDay()]})`;
};
const FILE_OK = /\.(pdf|png|jpe?g|docx?|xlsx?|hwp)$/i;
const MAX_FILES = 5;

async function uploadDetailFile(no: string, file: File): Promise<boolean> {
  const r = await fetch(`/api/rfq/${no}/files/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, type: file.type, scope: "detail" }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return false;
  if (d.uploaded) return true;
  if (!(await uploadToSigned(d, file))) return false;
  const c = await fetch(`/api/rfq/${no}/files/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: [d.path] }) });
  return c.ok;
}

export function DetailRequest({
  no,
  substance,
  quotes,
  payload,
  cats,
  closeHref,
  preview = false,
}: {
  no: string;
  substance: string;
  quotes: { id: string; name: string; total: number }[];
  payload: Values;
  cats: Cat[];
  closeHref: string;
  preview?: boolean;
}) {
  const [step, setStep] = useState<Step>({ k: "targets" });
  const [said, setSaid] = useState<Said[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [vals, setVals] = useState<Values>({});
  const [multi, setMulti] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [replyBy, setReplyBy] = useState(() => ymd(addBusinessDays(nowSeoul(), 5)));
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { changed, added } = useMemo(() => detailLines(vals, payload, cats), [vals, payload, cats]);
  const names = targets.map((id) => quotes.find((q) => q.id === id)?.name ?? "").filter(Boolean);
  const editCats = cats.filter((c) => coreFields(c).length > 0);

  const go = (s: Step) => setStep(s);
  const answer = (q: string, a: string, next: Step, onEdit: () => void) => {
    setSaid((s) => [...s.filter((x) => x.q !== q), { q, a, onEdit }]);
    go(next);
  };
  const cur = (key: string) => vals[key] ?? payload[key];
  const setVal = (key: string, v: string | string[]) => setVals((p) => ({ ...p, [key]: v }));

  /** 조건 한 줄: 1차 값이 바뀌었으면 취소선과 형광펜 */
  const valueCell = (key: string) => {
    const ch = changed.find((x) => x.key === key);
    if (ch) return <><s className="cr-was">{ch.was}</s><mark className="cr-now">{ch.now}</mark></>;
    return showValue(cur(key)) || "미정";
  };
  const fieldRows = (fields: { key: string; f: Field }[], back: Step) =>
    fields.map(({ key, f }) => (
      <button type="button" className="cr-r cr-r--btn" key={key} onClick={() => { setMulti(Array.isArray(cur(key)) ? (cur(key) as string[]) : []); go({ k: "field", key, back }); }}>
        <b>{cleanLabel(f.label)}</b>
        <span className="cr-v">{valueCell(key)}</span>
        <CaretRight size={16} className="cr-go" aria-hidden />
      </button>
    ));

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/rfq/${no}/detail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteIds: targets, detail: vals, replyBy }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "상세 견적 요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
      const bad: string[] = [];
      for (const f of files) if (!(await uploadDetailFile(no, f).catch(() => false))) bad.push(f.name);
      setFailed(bad);
      go({ k: "done" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  let q = "";
  let hint = "";
  let body: React.ReactNode = null;
  let ans: React.ReactNode = null;
  const prog = { targets: 1, substance: 2, progress: 2, field: 2, diff: 3, cat: 3, conds: 3, deadline: 4, date: 4, review: 4, done: 4 }[step.k];

  switch (step.k) {
    case "targets": {
      q = "어느 기관에 상세 견적을 받을까요?";
      hint = `1차 견적 ${quotes.length}곳 · 최대 ${MAX_DETAIL_TARGETS}곳`;
      body = (
        <div className="cr-card">
          {quotes.map((c) => (
            <div className="cr-r" key={c.id}>
              <b>{c.name}</b>
              <span className="cr-v cr-mono">{c.total ? won(c.total) : "미입력"}</span>
            </div>
          ))}
        </div>
      );
      ans = (
        <>
          <div className="cr-ms" role="group" aria-label="받을 기관">
            {quotes.map((c) => {
              const on = targets.includes(c.id);
              return (
                <button key={c.id} type="button" aria-pressed={on} className={on ? "on" : ""} disabled={!on && targets.length >= MAX_DETAIL_TARGETS}
                  onClick={() => setTargets((t) => (on ? t.filter((x) => x !== c.id) : [...t, c.id]))}>
                  {c.name}
                  {on ? <Check size={16} className="cr-end" /> : <Plus size={16} className="cr-end" />}
                </button>
              );
            })}
          </div>
          <Opt label={targets.length ? `${targets.length}곳 고르기` : "기관을 골라 주세요"} pri arrow disabled={!targets.length}
            onClick={() => answer(q, names.join(", "), { k: "substance" }, () => go({ k: "targets" }))} />
        </>
      );
      break;
    }
    case "substance": {
      q = "시험물질 조건을 알려 주세요";
      hint = "모든 시험 공통 · 아는 것만";
      body = <div className="cr-card">{fieldRows(SUBSTANCE_FIELDS.map((f) => ({ key: f.id, f })), step)}</div>;
      ans = <Opt label="다음" pri arrow onClick={() => answer("시험물질 조건", `${SUBSTANCE_FIELDS.filter((f) => showValue(vals[f.id])).length}개 적음`, { k: "progress" }, () => go({ k: "substance" }))} />;
      break;
    }
    case "progress": {
      q = "진행 조건과 자료를 더할까요?";
      hint = "예산은 기관 비공개 · 첨부는 고른 기관에만 공개";
      body = (
        <div className="cr-card">
          {fieldRows(PROGRESS_FIELDS.map((f) => ({ key: f.id, f })), step)}
          <button type="button" className="cr-r cr-r--btn" onClick={() => fileRef.current?.click()} disabled={files.length >= MAX_FILES}>
            <b>첨부</b>
            <span className="cr-v">{files.length ? `${files.length}개` : "없음"}</span>
            <Paperclip size={16} className="cr-go" aria-hidden />
          </button>
          {files.map((f) => (
            <div className="cr-r cr-file" key={f.name + f.size}>
              <small>{f.name}</small>
              <button type="button" aria-label={`${f.name} 빼기`} onClick={() => setFiles((x) => x.filter((y) => y !== f))}><X size={16} /></button>
            </div>
          ))}
          <input ref={fileRef} type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.hwp" aria-label="첨부 고르기"
            onChange={(e) => {
              const picked = [...(e.target.files ?? [])].filter((f) => FILE_OK.test(f.name) && f.size > 0 && f.size <= 20 * 1024 * 1024);
              e.target.value = "";
              setFiles((x) => [...x, ...picked.filter((p) => !x.some((y) => y.name === p.name && y.size === p.size))].slice(0, MAX_FILES));
            }} />
        </div>
      );
      ans = <Opt label="다음" pri arrow onClick={() => answer("진행 조건", `${PROGRESS_FIELDS.filter((f) => showValue(vals[f.id])).length}개 적음${files.length ? `, 첨부 ${files.length}개` : ""}`, editCats.length ? { k: "diff" } : { k: "deadline" }, () => go({ k: "progress" }))} />;
      break;
    }
    case "field": {
      const all = [...SUBSTANCE_FIELDS.map((f) => ({ key: f.id, f })), ...PROGRESS_FIELDS.map((f) => ({ key: f.id, f })), ...cats.flatMap((c) => coreFields(c).map((f) => ({ key: `${c}.${f.id}`, f })))];
      const { f } = all.find((x) => x.key === step.key)!;
      const lab = cleanLabel(f.label);
      const first = showValue(payload[step.key]);
      const done = (v: string | string[]) => { setVal(step.key, v); go(step.back); };
      q = lab;
      hint = first ? `1차 ${first}` : "";
      const skip = (
        <button type="button" className="cr-lk" onClick={() => { setVals((p) => { const n = { ...p }; delete n[step.key]; return n; }); go(step.back); }}>
          {first ? "1차 그대로 둘게요" : "아직 몰라요"}
        </button>
      );
      if (f.type === "chips") {
        ans = (
          <>
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
            <Opt label="골랐어요" pri disabled={!multi.length} onClick={() => done(multi)} />
            {skip}
          </>
        );
      } else if (f.options) {
        const os = f.options;
        ans = (
          <>
            <div className={os.length <= 3 ? "cr-row" : "cr-g2"}>
              {os.map((o) => <Opt key={o} label={o} pri={showValue(cur(step.key)) === o} onClick={() => done(o)} />)}
            </div>
            {skip}
          </>
        );
      } else {
        ans = (
          <>
            <Composer placeholder={f.placeholder || "직접 입력"} label={lab} big onSend={done} initial={typeof vals[step.key] === "string" ? (vals[step.key] as string) : ""} />
            {skip}
          </>
        );
      }
      break;
    }
    case "diff": {
      q = "1차와 다르게 할 시험 조건이 있나요?";
      hint = changed.length ? `바꾼 조건 ${changed.length}개` : "";
      body = changed.length ? (
        <div className="cr-card">
          {changed.filter((c) => cats.includes(c.group as Cat)).slice(0, 4).map((c) => (
            <div className="cr-r" key={c.key}>
              <span><b>{c.label}</b><small>{c.group}</small></span>
              <span className="cr-v"><s className="cr-was">{c.was}</s><mark className="cr-now">{c.now}</mark></span>
            </div>
          ))}
        </div>
      ) : null;
      const next = () => answer("시험 조건", changed.some((c) => cats.includes(c.group as Cat)) ? `${changed.filter((c) => cats.includes(c.group as Cat)).length}개 바꿈` : "1차 그대로", { k: "deadline" }, () => go({ k: "diff" }));
      ans = (
        <>
          <Opt label={changed.length ? "이대로 할게요" : "1차 그대로 할게요"} pri arrow onClick={next} />
          <Opt label={changed.length ? "더 바꿀게요" : "바꿀게요"} sm="시험 고르기" onClick={() => go(editCats.length === 1 ? { k: "conds", cat: editCats[0] } : { k: "cat" })} />
        </>
      );
      break;
    }
    case "cat": {
      q = "어느 시험의 조건을 바꿀까요?";
      ans = (
        <>
          {editCats.slice(0, 5).map((c) => {
            const n = changed.filter((x) => x.group === c).length;
            return <Opt key={c} label={c} sm={n ? `${n}개 바꿈` : undefined} onClick={() => go({ k: "conds", cat: c })} />;
          })}
          <button type="button" className="cr-lk" onClick={() => go({ k: "diff" })}>돌아가기</button>
        </>
      );
      break;
    }
    case "conds": {
      q = `${step.cat} 조건`;
      hint = "바꿀 줄 선택";
      body = <div className="cr-card">{fieldRows(coreFields(step.cat).map((f) => ({ key: `${step.cat}.${f.id}`, f })), step)}</div>;
      ans = <Opt label="다 바꿨어요" pri onClick={() => go({ k: "diff" })} />;
      break;
    }
    case "deadline": {
      q = "언제까지 2차 회신을 받을까요?";
      hint = "평일 기준";
      const opts = [3, 5, 7].map((n) => ({ n, d: ymd(addBusinessDays(nowSeoul(), n)) }));
      const pick = (d: string, label: string) => { setReplyBy(d); answer("2차 회신 기한", label, { k: "review" }, () => go({ k: "deadline" })); };
      ans = (
        <div className="cr-g2">
          {opts.map(({ n, d }) => <Opt key={n} label={`평일 ${n}일`} sm={short(d).slice(0, 5)} pri={replyBy === d} onClick={() => pick(d, `평일 ${n}일`)} />)}
          <Opt label="날짜 고르기" onClick={() => go({ k: "date" })} />
        </div>
      );
      break;
    }
    case "date": {
      const min = ymd(addBusinessDays(nowSeoul(), 1));
      q = "2차 회신 받을 날짜";
      ans = (
        <form className="cr-comp" onSubmit={(e) => { e.preventDefault(); if (date && date >= min) { setReplyBy(date); answer("2차 회신 기한", short(date), { k: "review" }, () => go({ k: "deadline" })); } }}>
          <input type="date" min={min} value={date} onChange={(e) => setDate(e.target.value)} aria-label="2차 회신 기한" />
          <button type="submit" aria-label="이 날짜로 정하기" disabled={!date || date < min}><Check size={20} /></button>
        </form>
      );
      break;
    }
    case "review": {
      q = `${names.join(", ")}에 이대로 보낼까요?`;
      hint = "2차 회신 전에도 1차 견적으로 선정 가능";
      const row = (b: string, v: React.ReactNode, s: Step) => (
        <button type="button" className="cr-r cr-r--btn" onClick={() => go(s)}>
          <b>{b}</b>
          <span className="cr-v">{v}</span>
          <PencilSimple size={16} className="cr-go" aria-label="고치기" />
        </button>
      );
      body = (
        <div className="cr-card">
          <p className="cr-hd">기관이 받을 내용</p>
          {row("받는 곳", `${targets.length}곳`, { k: "targets" })}
          {row("1차와 다른 조건", changed.length ? <mark className="cr-now">{changed.length}개</mark> : "없음", { k: "diff" })}
          {row("새로 더한 조건", `${added.filter((a) => a.key !== "budget").length}개`, { k: "substance" })}
          {row("첨부", files.length ? `${files.length}개` : "없음", { k: "progress" })}
          {row("2차 회신 기한", <span className="cr-mono">{short(replyBy)}</span>, { k: "deadline" })}
        </div>
      );
      ans = (
        <>
          {error && <p className="cr-err" role="alert">{error}</p>}
          <Opt label={busy ? "보내는 중이에요" : "상세 조건 보내기"} pri arrow={!busy} disabled={busy || preview || !targets.length} onClick={send} />
        </>
      );
      break;
    }
    case "done": {
      q = `${targets.length}곳에 상세 조건을 보냈어요`;
      hint = `2차 회신 기한 ${short(replyBy)}`;
      body = failed.length ? <p className="cr-err" role="alert">올리지 못한 첨부 {failed.length}개: {failed.join(", ")}. 요청 화면에서 다시 올려 주세요.</p> : null;
      ans = <Link href={`/app/r/${no}/compare`} className="cr-o cr-o--pri">비교 보고서로 돌아가기</Link>;
      break;
    }
  }

  const doc = (
    <article className="cr-doc" aria-label="보낼 내용">
      <header className="cr-doc__hd">
        <h2>상세 견적 요청</h2>
        <span className="cr-mono">{no}</span>
      </header>
      <dl className="cr-doc__meta">
        <div><dt>시험물질</dt><dd>{substance}</dd></div>
        <div><dt>받는 곳</dt><dd>{names.length ? names.join(", ") : <i className="cr-sk" aria-label="아직 정하지 않음" />}</dd></div>
        <div><dt>2차 회신 기한</dt><dd>{prog < 4 ? <i className="cr-sk" aria-label="아직 정하지 않음" /> : short(replyBy)}</dd></div>
      </dl>
      <table className="cr-doc__tb">
        <thead>
          <tr><th>구분</th><th>조건</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><b>1차와 다른 조건</b></td>
            <td>
              {changed.length ? changed.map((c) => (
                <span key={c.key} className="cr-doc__c"><em>{c.group} {c.label}</em> <s className="cr-was">{c.was}</s><mark className="cr-now">{c.now}</mark></span>
              )) : <i className="cr-sk" aria-label="없음" />}
            </td>
          </tr>
          <tr>
            <td><b>새로 더한 조건</b></td>
            <td>
              {added.length ? added.map((c) => (
                <span key={c.key} className="cr-doc__c"><em>{c.label}</em> {c.now}{c.key === "budget" ? " (기관 비공개)" : ""}</span>
              )) : <i className="cr-sk" aria-label="없음" />}
            </td>
          </tr>
          <tr>
            <td><b>첨부</b></td>
            <td>{files.length ? files.map((f) => <span key={f.name + f.size} className="cr-doc__c">{f.name}</span>) : <i className="cr-sk" aria-label="없음" />}</td>
          </tr>
        </tbody>
      </table>
      <p className="cr-doc__foot">고른 기관에만 공개. 회사명·연락처는 선정한 기관에만 공개</p>
    </article>
  );

  return <ChatShell title="상세 견적 요청" closeHref={closeHref} prog={prog} said={step.k === "done" ? [] : said} q={q} hint={hint} body={body} ans={ans} doc={doc} docLabel="보낼 내용" />;
}
