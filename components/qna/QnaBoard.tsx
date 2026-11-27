"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CaretLeft } from "@phosphor-icons/react";
import { CONTACT_MASK } from "@/lib/contact-guard";
import { QNA_MAX, QNA_TOPICS, qnaBadge, type QnaItem, type QnaScope, type QnaTarget, type QnaTopic } from "@/lib/qna";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import "./qna.css";

/**
 * 의뢰자·기관 직접 질의응답 (0045). 시안 검토판 r-qna · r-qna-new · c-qna · q-qna.
 * 머리 줄: 질의응답 / 요청 번호 · 전체·답변 대기 · 새 질의(창). 그 아래 닫힘 띠(선정·마무리 뒤).
 * PC(≥960px): 왼쪽 질의 목록 + 오른쪽 질의 하나(답변 쓰기). 휴대폰: 목록 → 질의 하나를 한 화면씩.
 * 규칙은 lib/qna.ts: 기관은 참여 뒤 비교표 전까지 묻고, 의뢰자는 비교표 뒤 견적을 낸 기관 1곳에 묻는다.
 * 공개 범위는 의뢰자가 기관 질의에 답할 때만 고르고, 전체 공개는 확인창을 거친다. 운영자는 읽기만.
 */

type Common = {
  /** POST 받을 곳: 의뢰자 /api/rfq/[no]/qna, 기관 /api/quote/[token]/qna. 빈 문자열이면 화면 검토용(보내지 않음) */
  endpoint: string;
  no: string;
  backHref: string;
  canAsk: boolean;
  canAnswer: boolean;
  initialId?: string;
  /** 운영자가 연 화면: 보내기 없음 */
  readOnly?: boolean;
  /** 선정·마무리로 닫혔을 때 띠 문구 (lib/qna qnaClosedNote) */
  closed?: string | null;
  /** 질의응답을 읽지 못함 */
  failed?: boolean;
};
type SponsorProps = Common & { side: "sponsor"; items: QnaItem[]; targets: QnaTarget[]; initialTo?: string; /** 참여한 기관 수 */ audience: number };
type CroProps = Common & { side: "cro"; mine: QnaItem[]; shared: QnaItem[] };
export type QnaBoardProps = SponsorProps | CroProps;

type View = { kind: "list" } | { kind: "item"; id: string };

const md = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+09:00` : iso);
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });
};

const SEND_FAIL = "답변을 보내지 못했어요. 입력한 내용은 그대로 있어요.";
const ASK_FAIL = "질의를 보내지 못했어요. 입력한 내용은 그대로 있어요.";

/** 서버가 규칙 위반을 알려 주면(4xx) 그 문장을, 그 밖에는 화면 문장을 쓴다 */
async function post(endpoint: string, body: unknown, fallback: string): Promise<{ id?: string }> {
  let res: Response;
  try {
    res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error(fallback);
  }
  const j = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
  if (!res.ok) throw new Error(res.status < 500 && j.error ? j.error : fallback);
  return j;
}

/** 가린 연락처 자리를 따로 표시한다 */
function Text({ text }: { text: string }) {
  const parts = text.split(CONTACT_MASK);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <span className="qa-mask">{CONTACT_MASK}</span>}
        </span>
      ))}
    </>
  );
}

/** 목록 줄의 누가 · 언제 · 주제 */
function who(i: QnaItem, side: "sponsor" | "cro"): string {
  if (side === "sponsor") return i.direction === "cro" ? i.party : `${i.party}에 보낸 질의`;
  if (!i.inviteId) return "의뢰자 공개 답변";
  return i.direction === "cro" ? "내 질의" : "의뢰자 질의";
}

export function QnaBoard(p: QnaBoardProps) {
  const router = useRouter();
  const all = useMemo(() => (p.side === "sponsor" ? p.items : [...p.mine, ...p.shared]), [p]);
  const waiting = all.filter((i) => i.answer == null);
  const [group, setGroup] = useState<"all" | "wait">("all");
  const [view, setView] = useState<View>(p.initialId && all.some((i) => i.id === p.initialId) ? { kind: "item", id: p.initialId } : { kind: "list" });
  const [asking, setAsking] = useState(p.side === "sponsor" && !!p.initialTo && p.canAsk && !p.readOnly);
  const list = group === "wait" ? waiting : all;
  const open = !p.closed && !p.readOnly;
  const canAsk = p.canAsk && open;
  const canAnswer = p.canAnswer && open;

  useEffect(() => {
    // 주소의 ?q= 를 지금 고른 질의로 맞춘다 (새로 고쳐도 같은 질의, 알림 링크와 같은 모양)
    const url = new URL(window.location.href);
    if (view.kind === "item") url.searchParams.set("q", view.id);
    else url.searchParams.delete("q");
    url.searchParams.delete("to");
    window.history.replaceState(null, "", url.toString());
  }, [view]);

  // PC 오른쪽: 고른 질의, 없으면 답할 질의, 없으면 첫 질의
  const current = (view.kind === "item" ? all.find((i) => i.id === view.id) : null) ?? list.find((i) => i.toAnswer) ?? list[0] ?? null;

  const note =
    p.side === "sponsor"
      ? !p.canAsk && open ? "새 질의는 비교표가 열린 뒤 견적을 낸 기관 1곳에 보낼 수 있어요." : ""
      : p.canAsk && open ? "비교표가 열리기 전까지 의뢰자에게 물을 수 있어요. 선정되면 질의응답은 닫혀요." : "";

  const newBtn = !p.readOnly && !p.closed && (p.side === "sponsor" || p.canAsk) && (
    <button type="button" className="b1 bsm qa-newbtn" disabled={!canAsk} onClick={() => setAsking(true)}>
      새 질의
    </button>
  );

  let body: React.ReactNode;
  if (p.failed) {
    body = <ErrorState title="질의응답을 불러오지 못했어요" />;
  } else if (all.length === 0) {
    body = (
      <EmptyState title="아직 질의가 없어요" action={p.side === "cro" && canAsk ? <button type="button" className="b1 bsm" onClick={() => setAsking(true)}>새 질의</button> : undefined}>
        {note || undefined}
      </EmptyState>
    );
  } else if (list.length === 0) {
    body = <EmptyState kind="filtered" title="답변 대기 중인 질의가 없어요" action={<button type="button" className="b2 bsm" onClick={() => setGroup("all")}>필터 지우기</button>} />;
  } else {
    body = (
      <div className="qa-split">
        <section className="qa-list" aria-label="질의 목록">
          <div className="qa-rows">
            {list.map((i) => {
              const b = qnaBadge(i);
              return (
                <button key={i.id} type="button" className={`qa-row${current?.id === i.id ? " on" : ""}`} onClick={() => setView({ kind: "item", id: i.id })}>
                  <span className="qa-row__t">
                    <Text text={i.body} />
                  </span>
                  <span className="qa-meta">{`${who(i, p.side)} · ${md(i.at)} · ${i.topic}`}</span>
                  <span className={`qa-st qa-st--${b.tone}`}>{b.label}</span>
                </button>
              );
            })}
          </div>
          {note && <p className="qa-note">{note}</p>}
        </section>
        <section className="qa-pane" aria-live="polite">
          {current && (
            <ItemPane
              key={current.id}
              item={current}
              side={p.side}
              endpoint={p.endpoint}
              canAnswer={canAnswer}
              audience={p.side === "sponsor" ? p.audience : 0}
              onBack={() => setView({ kind: "list" })}
              onDone={() => router.refresh()}
            />
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="qa" data-view={view.kind}>
      <div className="qa-head">
        <Link href={p.backHref} className="qa-back" aria-label="요청으로 돌아가기">
          <CaretLeft size={18} weight="bold" aria-hidden="true" />
        </Link>
        <h1>
          질의응답 <span className="qa-no tnum">/ {p.no}</span>
        </h1>
        {!p.failed && all.length > 0 && (
          <div className="qa-seg" role="tablist" aria-label="질의 구분">
            <button type="button" role="tab" aria-selected={group === "all"} className={group === "all" ? "on" : ""} onClick={() => setGroup("all")}>
              전체
            </button>
            <button type="button" role="tab" aria-selected={group === "wait"} className={group === "wait" ? "on" : ""} onClick={() => setGroup("wait")}>
              답변 대기{waiting.length > 0 && <span className="tnum"> {waiting.length}</span>}
            </button>
          </div>
        )}
        <span className="qa-sp" />
        {newBtn}
      </div>
      {p.closed && <p className="qa-ban">{p.closed}</p>}
      {body}
      {asking && (
        <NewDialog
          side={p.side}
          endpoint={p.endpoint}
          targets={p.side === "sponsor" ? p.targets : []}
          initialTo={p.side === "sponsor" ? p.initialTo : undefined}
          onClose={() => setAsking(false)}
          onDone={(id) => {
            setAsking(false);
            setGroup("all");
            setView({ kind: "item", id });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ItemPane({ item, side, endpoint, canAnswer, audience, onBack, onDone }: { item: QnaItem; side: "sponsor" | "cro"; endpoint: string; canAnswer: boolean; audience: number; onBack: () => void; onDone: () => void }) {
  const confirm = useConfirm();
  const [text, setText] = useState("");
  const [scope, setScope] = useState<QnaScope>("all");
  const [err, setErr] = useState("");
  const [failed, setFailed] = useState(false);
  const answering = item.toAnswer && canAnswer;
  const pickScope = side === "sponsor" && item.direction === "cro";
  const asker = side === "sponsor" ? (item.direction === "cro" ? item.party : "의뢰자") : item.direction === "cro" ? (item.inviteId ? "우리 기관" : "참여 기관") : "의뢰자";
  const answerer = side === "sponsor" ? (item.direction === "cro" ? "의뢰자" : item.party) : item.direction === "cro" ? "의뢰자" : "우리 기관";
  const waitNote = item.answer == null && !item.toAnswer ? (side === "cro" ? "의뢰자 답변 대기 · 의뢰자가 공개 범위를 골라 답해요" : `${item.party} 답변 대기`) : "";

  async function run() {
    if (!endpoint) throw new Error("화면 검토용이라 보내지 않아요.");
    await post(endpoint, { action: "answer", questionId: item.id, answer: text.trim(), ...(pickScope ? { scope } : {}) }, SEND_FAIL);
    setText("");
    onDone();
  }

  /** 전체 공개는 확인창이 보내기를 실행하고 실패도 창 안에서 알린다. 이때 이 버튼은 처리 중으로 바뀌지 않는다 (Promise 를 돌려주지 않음) */
  function send(): Promise<void> | void {
    if (!text.trim()) return setErr("답변을 입력해 주세요.");
    setErr("");
    if (pickScope && scope === "all") {
      void confirm({
        title: "답변을 참여 기관 전체에 공개할까요?",
        body: `보내면 참여한 기관${audience ? ` ${audience}곳` : ""}이 이 답변을 볼 수 있고, 질의한 기관 이름은 밝히지 않습니다.`,
        confirmLabel: "답변 보내기",
        pendingLabel: "보내는 중",
        retryLabel: "다시 보내기",
        action: run,
      });
      return;
    }
    return run().then(
      () => setFailed(false),
      (e: unknown) => {
        setFailed(true);
        setErr(e instanceof Error ? e.message : SEND_FAIL);
      },
    );
  }

  return (
    <div className="qa-item">
      <div className="qa-bar">
        <button type="button" className="qa-back" onClick={onBack} aria-label="목록으로">
          <CaretLeft size={18} weight="bold" aria-hidden="true" />
        </button>
        <span className="qa-bar__t">{item.party || item.topic}</span>
      </div>
      <div className="qa-body">
        <div className="qa-meta">
          <span>{item.topic}</span>
          {item.test && <span>{item.test}</span>}
          <span className="tnum">{md(item.at)}</span>
        </div>
        <div className="qa-msg">
          <span className="qa-by">질의 · {asker}</span>
          <p className="qa-text">
            <Text text={item.body} />
          </p>
        </div>
        {item.answer != null && (
          <div className="qa-msg">
            <span className="qa-by">
              답변 · {answerer} · <span className="tnum">{md(item.answeredAt)}</span>
              {item.direction === "cro" && ` · ${item.scope === "all" ? "참여 기관 전체" : "질의한 기관만"}`}
            </span>
            <p className="qa-text">
              <Text text={item.answer} />
            </p>
          </div>
        )}
        {waitNote && <p className="qa-note">{waitNote}</p>}
        {answering && (
          <div className="qa-form">
            <div className="qa-field">
              <label htmlFor={`ans-${item.id}`}>답변</label>
              <textarea id={`ans-${item.id}`} value={text} maxLength={QNA_MAX} onChange={(e) => setText(e.target.value)} aria-invalid={!!err && !text.trim()} aria-describedby={`ans-n-${item.id}`} />
              <span id={`ans-n-${item.id}`} className="qa-count tnum">
                {text.length}/{QNA_MAX}
              </span>
            </div>
            {pickScope && (
              <fieldset className="qa-field qa-scope">
                <legend>공개 범위</legend>
                <div className="qa-radios">
                  <label>
                    <input type="radio" name={`scope-${item.id}`} checked={scope === "private"} onChange={() => setScope("private")} />
                    질의한 기관만
                  </label>
                  <label>
                    <input type="radio" name={`scope-${item.id}`} checked={scope === "all"} onChange={() => setScope("all")} />
                    참여 기관 전체
                  </label>
                </div>
                <p className="qa-help">참여 기관 전체를 고르면 다른 기관에는 질의한 기관을 밝히지 않아요.</p>
              </fieldset>
            )}
            {err && (
              <p className="qa-err" role="alert">
                {err}
              </p>
            )}
            <div className="qa-foot">
              <Button className="b1" onClick={send}>
                {failed ? "다시 보내기" : "답변 보내기"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 새 질의 창 (시안 r-qna-new · c-qna~new). 처리 중에는 닫히지 않고, 실패는 창 안에서 알린다 */
function NewDialog({ side, endpoint, targets, initialTo, onClose, onDone }: { side: "sponsor" | "cro"; endpoint: string; targets: QnaTarget[]; initialTo?: string; onClose: () => void; onDone: (id: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [to, setTo] = useState(initialTo && targets.some((t) => t.inviteId === initialTo) ? initialTo : targets[0]?.inviteId ?? "");
  const [topic, setTopic] = useState<QnaTopic | "">("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState<{ topic?: string; body?: string }>({});
  const [err, setErr] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  async function send() {
    if (busy) return;
    const fe = { topic: topic ? undefined : "주제를 골라 주세요.", body: text.trim() ? undefined : "질의 내용을 입력해 주세요." };
    setFieldErr(fe);
    if (fe.topic || fe.body) {
      ref.current?.querySelector<HTMLElement>(fe.topic ? "input[name='qa-topic']" : "#qa-new-body")?.focus();
      return;
    }
    setBusy(true);
    setErr("");
    try {
      if (!endpoint) throw new Error("화면 검토용이라 보내지 않아요.");
      const j = await post(endpoint, { action: "ask", inviteId: side === "sponsor" ? to : undefined, topic, testSeq: null, body: text.trim() }, ASK_FAIL);
      if (!j.id) throw new Error(ASK_FAIL);
      onDone(j.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : ASK_FAIL);
    } finally {
      setBusy(false);
    }
  }

  const label = side === "sponsor" ? "보내기" : "질의 보내기";
  return (
    <dialog
      ref={ref}
      className="ix-dialog qa-dlg"
      aria-labelledby="qa-dlg-t"
      onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <form className="ix-dialog__in" onSubmit={(e) => { e.preventDefault(); void send(); }} aria-busy={busy || undefined}>
        <h2 id="qa-dlg-t" className="ix-dialog__title">새 질의</h2>
        {side === "sponsor" && (
          <div className="qa-field">
            <label htmlFor="qa-new-to">받는 기관</label>
            <select id="qa-new-to" value={to} onChange={(e) => setTo(e.target.value)} disabled={busy}>
              {targets.map((t) => (
                <option key={t.inviteId} value={t.inviteId}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <fieldset className="qa-field">
          <legend>주제</legend>
          <div className="qa-radios">
            {QNA_TOPICS.map(([k, l]) => (
              <label key={k}>
                <input type="radio" name="qa-topic" checked={topic === k} onChange={() => setTopic(k)} disabled={busy} />
                {l}
              </label>
            ))}
          </div>
          {fieldErr.topic && <p className="qa-err">{fieldErr.topic}</p>}
        </fieldset>
        <div className="qa-field">
          <label htmlFor="qa-new-body">{side === "sponsor" ? "질의 내용" : "내용"}</label>
          <textarea id="qa-new-body" value={text} maxLength={QNA_MAX} onChange={(e) => setText(e.target.value)} disabled={busy} aria-invalid={!!fieldErr.body} aria-describedby="qa-new-help" />
          {fieldErr.body && <p className="qa-err">{fieldErr.body}</p>}
        </div>
        <p id="qa-new-help" className="qa-help">
          {side === "sponsor" ? "견적을 낸 기관 1곳에 보내요 · 1,000자까지 · 선정 전에는 연락처가 가려져요." : "의뢰자에게 보내요 · 1,000자까지 · 연락처는 선정 전까지 가려져요."}
        </p>
        {err && (
          <p className="ix-dialog__err" role="alert">
            {err}
          </p>
        )}
        <div className="ix-dialog__acts">
          <button type="button" className="b2" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button type="submit" className="b1" disabled={busy} aria-busy={busy || undefined}>
            {busy ? "보내는 중" : err ? "다시 보내기" : label}
          </button>
        </div>
      </form>
    </dialog>
  );
}
