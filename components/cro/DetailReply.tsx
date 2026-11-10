"use client";
import { useState } from "react";
import Link from "next/link";
import { CaretRight, PencilSimple } from "@phosphor-icons/react";
import { DETAIL_STATUS_LABEL, revisedTotal, type DetailLine, type DetailReplyItem, type DetailStatus } from "@/lib/detail-quote";
import { md, won } from "@/lib/format";
import { ChatShell, Composer, Opt, type Said } from "@/components/ChatShell";

/**
 * 기관의 2차 회신 (0042). 의뢰자가 보낸 상세 조건을 보고 1차 견적에서 달라지는 줄만 고쳐 한 번 보낸다.
 * 1차 견적은 그대로 남고, 2차 총액은 1차 총액에 고친 줄의 차이를 더한 값이다.
 */

export type DetailReplyView = {
  no: string;
  substance: string;
  status: DetailStatus;
  replyBy: string;
  expired: boolean;
  closed: boolean;
  changed: DetailLine[];
  added: DetailLine[];
  files: { id: string; name: string; size: number }[];
  first: { total: number; weeks: number | null; items: { seq: number; name: string; amount: number | null; weeks: number | null; avail: string }[] };
  reply: { total: number | null; weeks: number | null; items: DetailReplyItem[]; note: string } | null;
};

type Step =
  | { k: "start" }
  | { k: "conds" }
  | { k: "rows"; page: number }
  | { k: "amount"; seq: number }
  | { k: "weeks"; seq: number }
  | { k: "basis"; seq: number }
  | { k: "reason"; seq: number }
  | { k: "total" }
  | { k: "review" }
  | { k: "confirm"; mode: "keep" | "decline" }
  | { k: "done"; mode: "revise" | "keep" | "decline" };

type Edit = { amount: number | null; weeks: number | null; mode: "as_requested" | "assumed"; reason: string };
const PAGE = 5;
const digits = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;
/** 차이 표시: +600만 원 */
const delta = (n: number) => `${n >= 0 ? "+" : "-"}${won(Math.abs(n))}`;

export function DetailReply({ token, view, backHref, fileToken, operator = false, preview = false }: { token: string; view: DetailReplyView; backHref: string; fileToken?: string; operator?: boolean; preview?: boolean }) {
  const open = view.status === "sent" && !view.expired && !view.closed;
  const [step, setStep] = useState<Step>(open ? { k: "start" } : { k: "done", mode: view.status === "submitted" ? "revise" : view.status === "kept" ? "keep" : "decline" });
  const [said, setSaid] = useState<Said[]>([]);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [weeks, setWeeks] = useState<number | null>(view.first.weeks);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const items = view.first.items;
  const edited = Object.entries(edits).map(([seq, e]) => ({ seq: Number(seq), ...e }));
  const total = view.reply?.total ?? revisedTotal(view.first.total, items, edited);
  const shownWeeks = view.reply ? view.reply.weeks : weeks;
  const shownEdits = view.reply ? view.reply.items : edited;
  const go = (s: Step) => setStep(s);
  const patch = (seq: number, p: Partial<Edit>) =>
    setEdits((e) => {
      const first = items.find((i) => i.seq === seq);
      const base: Edit = e[seq] ?? { amount: first?.amount ?? null, weeks: first?.weeks ?? null, mode: "as_requested", reason: "" };
      return { ...e, [seq]: { ...base, ...p } };
    });
  const nameOf = (seq: number) => items.find((i) => i.seq === seq)?.name ?? "";

  const send = async (mode: "revise" | "keep" | "decline") => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/quote/${token}/detail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, items: edited, totalWeeks: weeks, note }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "회신을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
      go({ k: "done", mode });
    } catch (e) {
      setError(e instanceof Error ? e.message : "다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const condCard = (
    <div className="cr-card">
      <p className="cr-hd">{view.no} · {view.substance}</p>
      {view.changed.slice(0, 3).map((c) => (
        <div className="cr-r" key={c.key}>
          <span><b>{c.label}</b><small>{c.group}</small></span>
          <span className="cr-v"><s className="cr-was">{c.was}</s><mark className="cr-now">{c.now}</mark></span>
        </div>
      ))}
      <button type="button" className="cr-r cr-r--btn" onClick={() => go({ k: "conds" })}>
        <b>새 조건</b>
        <span className="cr-v">{view.added.length}개{view.files.length ? ` · 첨부 ${view.files.length}개` : ""}</span>
        <CaretRight size={16} className="cr-go" aria-hidden />
      </button>
      <div className="cr-r">
        <b>회신 기한</b>
        <span className="cr-v cr-mono">{md(view.replyBy)}</span>
      </div>
    </div>
  );

  let q = "";
  let hint = "";
  let body: React.ReactNode = null;
  let ans: React.ReactNode = null;
  const prog = { start: 1, conds: 1, rows: 2, amount: 2, weeks: 2, basis: 2, reason: 2, total: 3, review: 4, confirm: 4, done: 4 }[step.k];

  switch (step.k) {
    case "start": {
      q = "1차 견적을 고쳐 보낼까요?";
      hint = `1차 ${won(view.first.total)} · 회신은 한 번`;
      body = condCard;
      ans = (
        <>
          <Opt label="고쳐 보낼게요" pri arrow onClick={() => { setSaid([{ q: "2차 회신", a: "고쳐 보낼게요", onEdit: () => go({ k: "start" }) }]); go({ k: "rows", page: 0 }); }} />
          <Opt label="1차 그대로 보낼게요" sm="바꿀 것 없음" onClick={() => go({ k: "confirm", mode: "keep" })} />
          <button type="button" className="cr-lk" onClick={() => go({ k: "confirm", mode: "decline" })}>이번엔 보내기 어려워요</button>
        </>
      );
      break;
    }
    case "conds": {
      q = "의뢰자가 더한 조건";
      body = (
        <div className="cr-card">
          {view.added.slice(0, 8).map((c) => (
            <div className="cr-r" key={c.key}>
              <b>{c.label}</b>
              <span className="cr-v">{c.now}</span>
            </div>
          ))}
          {view.files.map((f) => (
            <a className="cr-r cr-r--btn" key={f.id} href={`/api/files/${f.id}${fileToken ? `?token=${fileToken}` : ""}`}>
              <b>{f.name}</b>
              <CaretRight size={16} className="cr-go cr-end" aria-hidden />
            </a>
          ))}
          {!view.added.length && !view.files.length && <div className="cr-r"><span className="cr-v">없음</span></div>}
        </div>
      );
      ans = <Opt label="확인했어요" pri onClick={() => go({ k: "start" })} />;
      break;
    }
    case "rows": {
      const pages = Math.max(1, Math.ceil(items.length / PAGE));
      const page = items.slice(step.page * PAGE, step.page * PAGE + PAGE);
      q = "어느 줄이 달라지나요?";
      hint = `1차 ${won(view.first.total)}${edited.length ? ` · 2차 ${won(total)}` : ""}`;
      body = (
        <div className="cr-card">
          {page.map((it) => {
            const e = edits[it.seq];
            const ch = e && (e.amount !== it.amount || e.weeks !== it.weeks);
            return (
              <button type="button" className="cr-r cr-r--btn" key={it.seq} onClick={() => go({ k: "amount", seq: it.seq })}>
                <span><b>{it.name}</b>{it.weeks ? <small>{e && e.weeks !== it.weeks ? `${it.weeks}주에서 ${e.weeks ?? "-"}주` : `${it.weeks}주`}</small> : null}</span>
                <span className="cr-v cr-mono">
                  {ch && e.amount !== it.amount ? <><s className="cr-was">{it.amount == null ? "-" : won(it.amount)}</s><mark className="cr-now">{e.amount == null ? "-" : won(e.amount)}</mark></> : it.amount == null ? (it.avail === "불가" ? "수행 불가" : "미입력") : won(it.amount)}
                </span>
                <CaretRight size={16} className="cr-go" aria-hidden />
              </button>
            );
          })}
        </div>
      );
      ans = (
        <>
          <Opt label={edited.length ? `${edited.length}줄 고쳤어요` : "고칠 줄을 골라 주세요"} pri arrow disabled={!edited.length}
            onClick={() => { setSaid((s) => [...s.filter((x) => x.q !== "고친 줄"), { q: "고친 줄", a: `${edited.length}줄, ${delta(total - view.first.total)}`, onEdit: () => go({ k: "rows", page: 0 }) }]); go({ k: "total" }); }} />
          {pages > 1 && (
            <button type="button" className="cr-lk" onClick={() => go({ k: "rows", page: (step.page + 1) % pages })}>
              {step.page + 1 < pages ? `다음 줄 보기 (${step.page + 1}/${pages})` : "처음 줄 보기"}
            </button>
          )}
        </>
      );
      break;
    }
    case "amount": {
      const it = items.find((i) => i.seq === step.seq)!;
      const base = it.amount ?? 0;
      const setAmt = (n: number) => { patch(step.seq, { amount: n }); go({ k: "weeks", seq: step.seq }); };
      q = `${it.name}, 2차 금액은 얼마인가요?`;
      hint = `1차 ${it.amount == null ? "미입력" : won(it.amount)} · VAT 별도`;
      ans = (
        <>
          <div className="cr-g2">
            <Opt label="그대로" onClick={() => setAmt(base)} />
            {[3000000, 5000000, 10000000].map((n) => <Opt key={n} label={`+${(n / 10000).toLocaleString("ko-KR")}만`} onClick={() => setAmt(base + n)} />)}
          </div>
          <Composer placeholder="금액 직접 입력 (원)" label={`${it.name} 2차 금액`} inputMode="numeric" big onSend={(v) => { const n = digits(v); if (n > 0 && n < 1e13) setAmt(n); }} />
        </>
      );
      break;
    }
    case "weeks": {
      const it = items.find((i) => i.seq === step.seq)!;
      const base = it.weeks ?? 0;
      const setW = (n: number | null) => { patch(step.seq, { weeks: n }); go({ k: "basis", seq: step.seq }); };
      q = "기간도 달라지나요?";
      hint = `${it.name} · 1차 ${it.weeks ? `${it.weeks}주` : "미입력"}`;
      ans = (
        <>
          <div className="cr-row">
            <Opt label="그대로" onClick={() => setW(it.weeks)} />
            {base > 0 && [2, 4].map((n) => <Opt key={n} label={`+${n}주`} onClick={() => setW(base + n)} />)}
          </div>
          <Composer placeholder="기간 직접 입력 (주)" label={`${it.name} 2차 기간`} inputMode="numeric" onSend={(v) => { const n = digits(v); if (n > 0 && n <= 520) setW(n); }} />
        </>
      );
      break;
    }
    case "basis": {
      q = "어떤 조건으로 계산했나요?";
      hint = nameOf(step.seq);
      ans = (
        <>
          <Opt label="요청 조건대로" pri onClick={() => { patch(step.seq, { mode: "as_requested", reason: "" }); go({ k: "rows", page: Math.floor(items.findIndex((i) => i.seq === step.seq) / PAGE) }); }} />
          <Opt label="다르게 가정" sm="사유 적기" onClick={() => go({ k: "reason", seq: step.seq })} />
        </>
      );
      break;
    }
    case "reason": {
      q = "어떻게 가정했나요?";
      hint = nameOf(step.seq);
      ans = <Composer placeholder="예: 회복군 5마리/성 기준" label="가정한 조건" big initial={edits[step.seq]?.reason ?? ""} onSend={(v) => { patch(step.seq, { mode: "assumed", reason: v.slice(0, 300) }); go({ k: "rows", page: Math.floor(items.findIndex((i) => i.seq === step.seq) / PAGE) }); }} />;
      break;
    }
    case "total": {
      const base = view.first.weeks ?? 0;
      const setT = (n: number | null) => { setWeeks(n); setSaid((s) => [...s.filter((x) => x.q !== "전체 기간"), { q: "전체 기간", a: n ? `${n}주` : "미입력", onEdit: () => go({ k: "total" }) }]); go({ k: "review" }); };
      q = "전체 기간은 몇 주인가요?";
      hint = `착수부터 최종보고서까지 · 1차 ${view.first.weeks ? `${view.first.weeks}주` : "미입력"}`;
      ans = (
        <>
          <div className="cr-row">
            <Opt label="그대로" onClick={() => setT(view.first.weeks)} />
            {base > 0 && [2, 4].map((n) => <Opt key={n} label={`+${n}주`} onClick={() => setT(base + n)} />)}
          </div>
          <Composer placeholder="전체 기간 직접 입력 (주)" label="전체 기간" inputMode="numeric" onSend={(v) => { const n = digits(v); if (n > 0 && n <= 520) setT(n); }} />
        </>
      );
      break;
    }
    case "review": {
      q = "이대로 2차 견적을 보낼까요?";
      hint = "보낸 뒤 수정 불가";
      body = (
        <div className="cr-card">
          <div className="cr-sum">
            <p className="cr-sum__k">2차 견적 · 시험 {items.length}개 · VAT 별도</p>
            <p className="cr-sum__v">{won(total)}<s>{won(view.first.total)}</s></p>
          </div>
          <button type="button" className="cr-r cr-r--btn" onClick={() => go({ k: "rows", page: 0 })}>
            <b>고친 줄</b>
            <span className="cr-v">{edited.length}줄 · <span className="cr-mono">{delta(total - view.first.total)}</span></span>
            <PencilSimple size={16} className="cr-go" aria-label="고치기" />
          </button>
          <button type="button" className="cr-r cr-r--btn" onClick={() => go({ k: "total" })}>
            <b>전체 기간</b>
            <span className="cr-v">{view.first.weeks && weeks && weeks !== view.first.weeks ? <><s className="cr-was">{view.first.weeks}주</s><mark className="cr-now">{weeks}주</mark></> : weeks ? `${weeks}주` : "미입력"}</span>
            <PencilSimple size={16} className="cr-go" aria-label="고치기" />
          </button>
        </div>
      );
      ans = (
        <>
          <form className="cr-comp cr-comp--sm" onSubmit={(e) => e.preventDefault()}>
            <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder="의뢰자에게 남길 말 (선택)" aria-label="의뢰자에게 남길 말" />
          </form>
          {error && <p className="cr-err" role="alert">{error}</p>}
          <Opt label={busy ? "보내는 중이에요" : "2차 견적 보내기"} pri arrow={!busy} disabled={busy || preview || !edited.length} onClick={() => send("revise")} />
        </>
      );
      break;
    }
    case "confirm": {
      const keep = step.mode === "keep";
      q = keep ? "1차 견적 그대로 보낼까요?" : "이번에는 2차 견적을 내지 않을까요?";
      hint = keep ? `${won(view.first.total)} · 보낸 뒤 수정 불가` : "1차 견적은 비교 보고서에 그대로 유지";
      ans = (
        <>
          {error && <p className="cr-err" role="alert">{error}</p>}
          <Opt label={busy ? "보내는 중이에요" : keep ? "1차 그대로 보내기" : "내지 않기"} pri disabled={busy || preview} onClick={() => send(step.mode)} />
          <button type="button" className="cr-lk" onClick={() => go({ k: "start" })}>돌아가기</button>
        </>
      );
      break;
    }
    case "done": {
      const sent = view.status === "sent";
      q = sent && (view.expired || view.closed)
        ? view.closed ? "이 요청의 2차 회신이 닫혔어요" : "2차 회신 기한이 지났어요"
        : step.mode === "revise" ? "2차 견적을 보냈어요" : step.mode === "keep" ? "1차 견적 그대로 보냈어요" : "2차 견적을 내지 않았어요";
      hint = sent && (view.expired || view.closed) ? "1차 견적은 비교 보고서에 그대로 유지" : step.mode === "revise" ? `${won(total)} · 1차 ${won(view.first.total)}` : "";
      ans = <Link href={backHref} className="cr-o cr-o--pri">요청으로 돌아가기</Link>;
      break;
    }
  }

  const doc = (
    <article className="cr-doc" aria-label="2차 견적">
      <header className="cr-doc__hd">
        <h2>2차 견적</h2>
        <span className="cr-mono">{view.no}</span>
      </header>
      <dl className="cr-doc__meta">
        <div><dt>1차 견적</dt><dd className="cr-mono">{won(view.first.total)}</dd></div>
        <div><dt>2차 견적</dt><dd className="cr-mono">{shownEdits.length || view.reply ? (view.reply && view.reply.total == null ? DETAIL_STATUS_LABEL[view.status] : won(total)) : <i className="cr-sk" aria-label="아직 없음" />}</dd></div>
        <div><dt>회신 기한</dt><dd>{md(view.replyBy)}</dd></div>
      </dl>
      <table className="cr-doc__tb">
        <thead>
          <tr><th>의뢰자 조건</th><th>내용</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><b>1차와 다른 조건</b></td>
            <td>{view.changed.length ? view.changed.map((c) => <span key={c.key} className="cr-doc__c"><em>{c.group} {c.label}</em> <s className="cr-was">{c.was}</s><mark className="cr-now">{c.now}</mark></span>) : "없음"}</td>
          </tr>
          <tr>
            <td><b>새 조건</b></td>
            <td>{view.added.length ? view.added.map((c) => <span key={c.key} className="cr-doc__c"><em>{c.label}</em> {c.now}</span>) : "없음"}</td>
          </tr>
        </tbody>
      </table>
      {view.files.length > 0 && (
        <div className="cr-doc__files">
          {view.files.map((f) => <a key={f.id} href={`/api/files/${f.id}${fileToken ? `?token=${fileToken}` : ""}`}>{f.name}</a>)}
        </div>
      )}
      <ul className="cr-doc__list">
        {items.map((it) => {
          const e = shownEdits.find((x) => x.seq === it.seq);
          return (
            <li key={it.seq}>
              <span>{it.name}</span>
              <b className="cr-mono">
                {e && e.amount !== it.amount ? <><s className="cr-was">{it.amount == null ? "-" : won(it.amount)}</s><mark className="cr-now">{e.amount == null ? "-" : won(e.amount)}</mark></> : it.amount == null ? "-" : won(it.amount)}
                {e?.mode === "assumed" && e.reason ? <small style={{ display: "block", fontWeight: 400 }}>{e.reason}</small> : null}
              </b>
            </li>
          );
        })}
        <li><span>전체 기간</span><b>{shownWeeks ? `${shownWeeks}주` : "-"}</b></li>
      </ul>
      {operator && <p className="cr-doc__foot">운영자 화면</p>}
    </article>
  );

  return <ChatShell title="2차 견적 회신" closeHref={backHref} prog={prog} said={step.k === "done" ? [] : said} q={q} hint={hint} body={body} ans={ans} doc={doc} docLabel="2차 견적" />;
}
