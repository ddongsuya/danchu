"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CaretLeft } from "@phosphor-icons/react";
import { CONTACT_MASK } from "@/lib/contact-guard";
import { QNA_MAX, QNA_TOPICS, type QnaItem, type QnaScope, type QnaTarget, type QnaTopic } from "@/lib/qna";
import "./qna.css";

/**
 * 의뢰자·기관 직접 질의응답 (0045). 시안 https://claude.ai/artifact/NTD7NFfqXvPUxAiLZrGnWr 승인안.
 * PC(≥960px): 왼쪽 질의 목록 + 오른쪽 질의 하나(답변 쓰기) 또는 새 질의.
 * 휴대폰: 한 화면 전체를 쓰고 목록 → 질의 하나 → (의뢰자 답변) 공개 범위 순서로 한 화면씩 넘긴다. 세로 스크롤은 목록이 길 때만.
 */

type Common = {
  /** POST 받을 곳: 의뢰자 /api/rfq/[no]/qna, 기관 /api/quote/[token]/qna. 빈 문자열이면 화면 검토용(보내지 않음) */
  endpoint: string;
  no: string;
  substance: string;
  backHref: string;
  canAsk: boolean;
  canAnswer: boolean;
  /** 기관 질의 마감 (회신 기한, 서울 날짜) */
  askBy: string | null;
  tests: { seq: number; name: string }[];
  initialId?: string;
  /** 운영자가 연 화면: 보내기 없음 */
  readOnly?: boolean;
};
type SponsorProps = Common & { side: "sponsor"; items: QnaItem[]; targets: QnaTarget[]; initialTo?: string };
type CroProps = Common & { side: "cro"; mine: QnaItem[]; shared: QnaItem[] };
export type QnaBoardProps = SponsorProps | CroProps;

type View = { kind: "list" } | { kind: "item"; id: string } | { kind: "new" };

const md = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+09:00` : iso);
  return `${d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" }).replace(/\s/g, "").replace(/\.$/, "")}`;
};
const mdhm = (iso: string) => `${md(iso)} ${new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" })}`;

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

export function QnaBoard(p: QnaBoardProps) {
  const router = useRouter();
  const all = p.side === "sponsor" ? p.items : [...p.mine, ...p.shared];
  const groups: { key: string; label: string; list: QnaItem[] }[] =
    p.side === "sponsor"
      ? [
          { key: "wait", label: "답변 대기", list: p.items.filter((i) => i.toAnswer) },
          { key: "all", label: "전체", list: p.items },
        ]
      : [
          { key: "mine", label: "내 질의", list: p.mine },
          { key: "shared", label: "공개 답변", list: p.shared },
        ];
  const firstGroup = p.side === "sponsor" ? (groups[0].list.length ? "wait" : "all") : "mine";
  const [group, setGroup] = useState(firstGroup);
  const initial: View = p.initialId && all.some((i) => i.id === p.initialId) ? { kind: "item", id: p.initialId } : p.side === "sponsor" && p.initialTo && p.canAsk ? { kind: "new" } : { kind: "list" };
  const [view, setView] = useState<View>(initial);
  // PC 오른쪽에 처음 보일 것: 고른 질의, 없으면 답할 질의, 없으면 첫 질의, 없으면 새 질의
  const deskDefault = useMemo<View>(() => {
    if (view.kind !== "list") return view;
    const g = groups.find((x) => x.key === group)?.list ?? [];
    const pick = g.find((i) => i.toAnswer) ?? g[0];
    return pick ? { kind: "item", id: pick.id } : p.canAsk && !p.readOnly ? { kind: "new" } : { kind: "list" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, group, p.canAsk, p.readOnly, all.length]);

  useEffect(() => {
    // 주소의 ?q= 를 지금 고른 질의로 맞춘다 (새로 고쳐도 같은 질의, 알림 링크와 같은 모양)
    const url = new URL(window.location.href);
    if (view.kind === "item") url.searchParams.set("q", view.id);
    else url.searchParams.delete("q");
    url.searchParams.delete("to");
    window.history.replaceState(null, "", url.toString());
  }, [view]);

  const list = groups.find((g) => g.key === group)?.list ?? [];
  const current = deskDefault.kind === "item" ? all.find((i) => i.id === deskDefault.id) ?? null : null;
  const showNew = deskDefault.kind === "new";

  const head = (
    <div className="qa-head">
      <Link href={p.backHref} className="qa-back" aria-label="요청으로 돌아가기">
        <CaretLeft size={18} weight="bold" aria-hidden="true" />
      </Link>
      <div className="qa-head__t">
        <span className="qa-no tnum">{p.no}</span>
        <h1>질의응답</h1>
      </div>
      {p.side === "cro" && p.askBy && p.canAsk && (
        <span className="qa-due">
          질의 마감 <b className="tnum">{md(p.askBy)}</b>
        </span>
      )}
    </div>
  );

  return (
    <div className="qa" data-view={view.kind}>
      {head}
      <div className="qa-split">
        {/* 목록 */}
        <section className="qa-list" aria-label="질의 목록">
          <div className="qa-seg" role="tablist" aria-label="질의 구분">
            {groups.map((g) => (
              <button key={g.key} type="button" role="tab" aria-selected={group === g.key} className={group === g.key ? "on" : ""} onClick={() => setGroup(g.key)}>
                {g.label} <span className="tnum">{g.list.length}</span>
              </button>
            ))}
          </div>
          <div className="qa-rows">
            {list.length === 0 && <p className="qa-empty">질의 없음</p>}
            {list.map((i) => (
              <button key={i.id} type="button" className={`qa-row${current?.id === i.id ? " on" : ""}`} onClick={() => setView({ kind: "item", id: i.id })}>
                <span className="qa-meta">
                  {i.party && <b>{i.party}</b>}
                  <span>{i.topic}</span>
                  {p.side === "sponsor" && i.direction === "sponsor" && <span>보낸 질의</span>}
                  {p.side === "cro" && i.direction === "sponsor" && <span>의뢰자 질의</span>}
                  <span className="tnum">{md(i.at)}</span>
                  <Status i={i} />
                </span>
                <span className="qa-q">
                  <Text text={i.body} />
                </span>
              </button>
            ))}
          </div>
          {p.canAsk && !p.readOnly && (
            <div className="qa-list__foot">
              <button type="button" className="b1 qa-newbtn" onClick={() => setView({ kind: "new" })}>
                새 질의
              </button>
            </div>
          )}
        </section>

        {/* 오른쪽 (휴대폰은 한 화면) */}
        <section className="qa-pane" aria-live="polite">
          {current && (
            <ItemPane
              key={current.id}
              item={current}
              side={p.side}
              endpoint={p.endpoint}
              canAnswer={p.canAnswer && !p.readOnly}
              onBack={() => setView({ kind: "list" })}
              onDone={() => router.refresh()}
            />
          )}
          {showNew && (
            <NewPane
              key="new"
              side={p.side}
              endpoint={p.endpoint}
              tests={p.tests}
              targets={p.side === "sponsor" ? p.targets : []}
              initialTo={p.side === "sponsor" ? p.initialTo : undefined}
              onBack={() => setView({ kind: "list" })}
              onDone={(id) => {
                setGroup(p.side === "sponsor" ? "all" : "mine");
                setView({ kind: "item", id });
                router.refresh();
              }}
            />
          )}
          {!current && !showNew && <p className="qa-empty qa-empty--pane">질의 없음</p>}
        </section>
      </div>
    </div>
  );
}

function Status({ i }: { i: QnaItem }) {
  if (i.answer != null) return <span className="qa-st">답변 완료</span>;
  return <span className={i.toAnswer ? "qa-st qa-st--wait" : "qa-st"}>답변 대기</span>;
}

function scopeLabel(s: QnaScope | null): string {
  return s === "all" ? "참여 기관 전체" : "질의 기관만";
}

function ItemPane({ item, side, endpoint, canAnswer, onBack, onDone }: { item: QnaItem; side: "sponsor" | "cro"; endpoint: string; canAnswer: boolean; onBack: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState<QnaScope>("all");
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const answering = item.toAnswer && canAnswer;
  const pickScope = side === "sponsor" && item.direction === "cro";
  const asker = side === "sponsor" ? (item.direction === "cro" ? item.party : "의뢰자") : item.direction === "cro" ? (item.inviteId ? "우리 기관" : "참여 기관") : "의뢰자";
  const answerer = side === "sponsor" ? (item.direction === "cro" ? "의뢰자" : item.party) : item.direction === "cro" ? "의뢰자" : "우리 기관";

  async function send() {
    if (busy) return;
    const t = text.trim();
    if (!t) return setErr("답변을 적어 주세요.");
    if (!endpoint) return setErr("화면 검토용이라 보내지 않아요.");
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "answer", questionId: item.id, answer: t, ...(pickScope ? { scope } : {}) }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "답변을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
      setText("");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "답변을 보내지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="qa-item" data-step={answering && pickScope ? step : 1}>
      <div className="qa-bar">
        <button type="button" className="qa-back" onClick={step === 2 ? () => setStep(1) : onBack} aria-label="뒤로">
          <CaretLeft size={18} weight="bold" aria-hidden="true" />
        </button>
        <span className="qa-bar__t">{step === 2 ? "공개 범위" : item.party || item.topic}</span>
      </div>
      <div className="qa-body">
        <div className="qa-s1">
          <div className="qa-meta">
            <span>{item.topic}</span>
            {item.test && <span>{item.test}</span>}
            <span className="tnum">{mdhm(item.at)}</span>
            <Status i={item} />
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
                답변 · {answerer} · <span className="tnum">{item.answeredAt ? mdhm(item.answeredAt) : ""}</span>
                {item.direction === "cro" && ` · ${scopeLabel(item.scope)}`}
              </span>
              <p className="qa-text">
                <Text text={item.answer} />
              </p>
            </div>
          )}
          {answering && (
            <div className="qa-field qa-grow">
              <label htmlFor={`ans-${item.id}`}>답변</label>
              <textarea id={`ans-${item.id}`} value={text} maxLength={QNA_MAX} onChange={(e) => setText(e.target.value)} aria-describedby={`ans-n-${item.id}`} />
              <span id={`ans-n-${item.id}`} className="qa-count tnum">
                {text.length}/{QNA_MAX}
              </span>
            </div>
          )}
        </div>
        {answering && pickScope && (
          <fieldset className="qa-s2 qa-scope">
            <legend>공개 범위</legend>
            <label className={scope === "all" ? "on" : ""}>
              <input type="radio" name={`scope-${item.id}`} checked={scope === "all"} onChange={() => setScope("all")} />
              <span>
                참여 기관 전체<small>질의 기관 이름 가림</small>
              </span>
            </label>
            <label className={scope === "private" ? "on" : ""}>
              <input type="radio" name={`scope-${item.id}`} checked={scope === "private"} onChange={() => setScope("private")} />
              <span>{item.party}만</span>
            </label>
            <div className="qa-sum qa-m">
              <span className="qa-by">보낼 답변</span>
              <p>{text.trim() || "답변 없음"}</p>
            </div>
          </fieldset>
        )}
        {err && (
          <p className="qa-err" role="alert">
            {err}
          </p>
        )}
      </div>
      {answering && (
        <div className="qa-foot">
          {pickScope && step === 1 && (
            <button type="button" className="b1 qa-m" disabled={!text.trim()} onClick={() => setStep(2)}>
              다음
            </button>
          )}
          <button type="button" className={`b1${pickScope && step === 1 ? " qa-d" : ""}`} disabled={busy || !text.trim()} onClick={send}>
            {busy ? "보내는 중" : "답변 보내기"}
          </button>
        </div>
      )}
    </div>
  );
}

function NewPane({ side, endpoint, tests, targets, initialTo, onBack, onDone }: { side: "sponsor" | "cro"; endpoint: string; tests: { seq: number; name: string }[]; targets: QnaTarget[]; initialTo?: string; onBack: () => void; onDone: (id: string) => void }) {
  const [to, setTo] = useState(initialTo && targets.some((t) => t.inviteId === initialTo) ? initialTo : targets.length === 1 ? targets[0].inviteId : "");
  const [topic, setTopic] = useState<QnaTopic | "">("");
  const [seq, setSeq] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ready = !!text.trim() && !!topic && (side === "cro" || !!to);

  async function send() {
    if (busy || !ready) return;
    if (!endpoint) return setErr("화면 검토용이라 보내지 않아요.");
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "ask", inviteId: to || undefined, topic, testSeq: seq, body: text.trim() }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok || !j.id) throw new Error(j.error || "질의를 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
      setText("");
      onDone(j.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "질의를 보내지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="qa-item" data-step={1}>
      <div className="qa-bar">
        <button type="button" className="qa-back" onClick={onBack} aria-label="뒤로">
          <CaretLeft size={18} weight="bold" aria-hidden="true" />
        </button>
        <span className="qa-bar__t">새 질의</span>
      </div>
      <div className="qa-body">
        <div className="qa-s1">
          <h2 className="qa-d qa-newh">새 질의</h2>
          {side === "sponsor" && (
            <fieldset className="qa-field">
              <legend>받는 기관</legend>
              <div className="qa-chips">
                {targets.map((t) => (
                  <button key={t.inviteId} type="button" aria-pressed={to === t.inviteId} className={to === t.inviteId ? "on" : ""} onClick={() => setTo(t.inviteId)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset className="qa-field">
            <legend>관련 항목</legend>
            <div className="qa-chips">
              {QNA_TOPICS.map(([k, label]) => (
                <button key={k} type="button" aria-pressed={topic === k} className={topic === k ? "on" : ""} onClick={() => setTopic(k)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          {tests.length > 0 && (
            <fieldset className="qa-field">
              <legend>관련 시험</legend>
              <div className="qa-chips">
                {tests.map((t) => (
                  <button key={t.seq} type="button" aria-pressed={seq === t.seq} className={seq === t.seq ? "on" : ""} onClick={() => setSeq(seq === t.seq ? null : t.seq)}>
                    {t.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="qa-field qa-grow">
            <label htmlFor="qa-new-body">질의 내용</label>
            <textarea id="qa-new-body" value={text} maxLength={QNA_MAX} onChange={(e) => setText(e.target.value)} aria-describedby="qa-new-n" />
            <span id="qa-new-n" className="qa-count tnum">
              {text.length}/{QNA_MAX}
            </span>
          </div>
        </div>
        {err && (
          <p className="qa-err" role="alert">
            {err}
          </p>
        )}
      </div>
      <div className="qa-foot">
        <button type="button" className="b1" disabled={busy || !ready} onClick={send}>
          {busy ? "보내는 중" : "질의 보내기"}
        </button>
      </div>
    </div>
  );
}
