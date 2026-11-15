"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUp, ArrowRight, Check, FileText, ChatCircleText, Buildings, ArrowCounterClockwise, LockSimple } from "@phosphor-icons/react";
import { LAB_ROLES, ROLE_LABEL, type LabRole, type Quote, type RequestDraft } from "@/lib/agent-lab/domain";
import type { LabResponse } from "@/lib/agent-lab/runtime";

type Payload = LabResponse & { configured?: boolean; error?: string; inProgress?: boolean };
const money = (value: number | null) => value === null ? "확인 필요" : `${value.toLocaleString("ko-KR")}원`;
const EXAMPLE = "테스트 요청서를 작성해 줘. 개별 분석이고, 제목은 혈청 임상생화학 분석이야. 검체는 혈청, 검체 수는 30개, 분석 항목은 ALT, AST, BUN, CREA야. 희망 완료일은 2026-12-10이고 국문 결과 요약도 필요해. 아직 전달하지 말고 초안만 준비해 줘.";

function RequestDocument({ draft }: { draft: Partial<RequestDraft> }) {
  return <div className="al-document">
    <h3>{draft.title}</h3>
    <dl><div><dt>검체</dt><dd>{draft.material || "참여 승인 후 공개"}</dd></div><div><dt>검체 수</dt><dd>{draft.samples}개</dd></div><div><dt>분석 항목</dt><dd>{draft.items?.join(" · ")}</dd></div><div><dt>희망 완료일</dt><dd>{draft.deadline}</dd></div></dl>
    {draft.note && <p className="al-note">{draft.note}</p>}
  </div>;
}

function QuoteDocument({ quote }: { quote: Quote }) {
  return <div className="al-document">
    <div className="al-table-wrap"><table><caption className="al-sr">견적 항목과 계산 근거</caption><thead><tr><th>항목</th><th>수량</th><th>단가</th><th>금액</th></tr></thead><tbody>{quote.lines.map(line => <tr key={line.item}><th>{line.item}</th><td>{line.quantity}</td><td>{money(line.unitPrice)}</td><td>{money(line.amount)}</td></tr>)}</tbody></table></div>
    <div className="al-total"><span>공급가 합계</span><strong>{money(quote.total)}</strong></div>
    <dl><div><dt>처리 기간</dt><dd>접수 후 {quote.leadDays}일 (예시)</dd></div><div><dt>포함</dt><dd>{quote.includes.join(" · ")}</dd></div><div><dt>별도</dt><dd>{quote.excludes.join(" · ")}</dd></div></dl>
    {quote.note && <p className="al-note">{quote.note}</p>}
  </div>;
}

function MessageText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}</>;
}

export function AgentLab() {
  const [role, setRole] = useState<LabRole>("requester");
  const [data, setData] = useState<Payload | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const [dark, setDark] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback((signal?: AbortSignal) => {
    return fetch(`/api/agent-lab?role=${role}`, { cache: "no-store", signal }).then(async response => {
      const payload: Payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "화면을 불러오지 못했습니다.");
      return payload;
    }).then(payload => {
      if (!signal?.aborted) setData(payload);
    }).catch(e => {
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : "연결을 확인하고 다시 시도해 주세요.");
    }).finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [role]);

  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh]);
  useEffect(() => { if (!data?.inProgress) return; const timer = window.setTimeout(() => void refresh(), 2000); return () => window.clearTimeout(timer); }, [data, refresh]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); }, [data?.view.chat.length, data?.approval, busy]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; return () => { document.documentElement.dataset.theme = "light"; }; }, [dark]);

  async function act(body: Record<string, unknown>) {
    if (busy || loading) return;
    setBusy(true); setError(""); setResetConfirm(false);
    try {
      const response = await fetch("/api/agent-lab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, role }) });
      const payload: Payload = await response.json();
      if (payload.view) setData(previous => ({ ...payload, configured: previous?.configured }));
      if (!response.ok) throw new Error(payload.error || "작업을 완료하지 못했습니다.");
      if (body.action === "message") setMessage("");
    } catch (e) { setError(e instanceof Error ? e.message : "연결이 끊겼습니다. 새로고침해서 업무 상태를 확인해 주세요."); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (message.trim()) void act({ action: "message", message: message.trim() });
  }

  const view = data?.view.role === role ? data.view : null;
  const isRequester = role === "requester";
  const blocked = busy || loading || !!data?.inProgress || !!data?.waitingFor || !data?.configured || data.remainingTurns <= 1;
  const prompts = !view ? [] : isRequester
    ? !view.draft && !view.request ? [{ label: "예시 요청으로 시작", text: EXAMPLE }]
      : !view.request ? [{ label: "기관에 요청 전달", text: "작성한 요청서를 두 예시 기관에 전달할 수 있게 확인 화면을 열어 줘." }]
      : view.comparisonOpen ? [{ label: "견적 차이 정리", text: "공개된 두 견적의 항목별 금액, 처리 기간, 포함·제외 범위를 비교해 줘. 임의의 순위는 매기지 마." }]
      : [{ label: "회신 현황 확인", text: "현재 참여와 회신 현황, 내가 답해야 할 질문을 정리해 줘." }]
    : !view.request ? [] : !view.joined ? [{ label: "참여 동의 준비", text: "이 테스트 요청에 참여할게. 참여 동의 확인 화면을 열어 줘." }]
      : !view.quoteDraft ? [{ label: "견적 초안 작성", text: "우리 기관의 등록된 예시 단가와 조건으로 견적 초안을 작성해 줘. 의뢰자의 요청과 다른 포함·제외 항목을 알려 줘. 제출은 아직 하지 마." }, { label: "추가 질문 준비", text: "의뢰자에게 검체의 보관 조건을 질문할 수 있게 준비해 줘." }]
      : !view.ownQuote ? [{ label: "견적 제출 준비", text: "견적 초안을 확인했어. 의뢰자에게 제출할 수 있게 확인 화면을 열어 줘." }]
      : [{ label: "내부 메모 저장", text: "내부 업무 메모에 '견적 제출 완료, 의뢰자 검토 결과 확인 예정'이라고 저장해 줘." }];

  return <main className="al">
    <header className="al-header"><Link href="/" className="al-brand" aria-label="단추 홈">단추<span>에이전트 테스트</span></Link><div className="al-header-actions"><button className="al-text-button" onClick={() => setDark(!dark)}>{dark ? "밝은 화면" : "어두운 화면"}</button><button className="al-text-button" disabled={busy || loading} onClick={() => setResetConfirm(true)}><ArrowCounterClockwise size={17} aria-hidden="true" />새 테스트</button></div></header>
    <div className="al-intro"><div><h1>각자의 에이전트로,<br className="al-mobile-break" /> 하나의 의뢰를 진행해요.</h1><p>의뢰자와 기관 역할을 바꿔 가며 요청부터 견적 비교까지 확인하세요.</p></div><span className="al-test-badge">예시 데이터 · 테스트 전용</span></div>
    <nav className="al-roles" aria-label="테스트 역할">{LAB_ROLES.map(value => <button key={value} aria-pressed={role === value} disabled={busy} onClick={() => { if (role !== value) { setLoading(true); setError(""); setRole(value); } setMessage(""); setResetConfirm(false); }}><span>{value === "requester" ? <ChatCircleText size={20} aria-hidden="true" /> : <Buildings size={20} aria-hidden="true" />}{ROLE_LABEL[value]}</span>{role === value && <span className="al-role-active">현재 역할</span>}</button>)}</nav>
    {resetConfirm && <div className="al-reset" role="alert"><p>예시 요청과 대화 기록을 지우고 처음부터 시작할까요?</p><button className="al-secondary" onClick={() => setResetConfirm(false)}>계속 작업</button><button className="al-primary" onClick={() => void act({ action: "reset" })}>새로 시작</button></div>}
    {error && <div className="al-error" role="alert"><p>{error}</p><button onClick={() => { setLoading(true); setError(""); void refresh(); }} disabled={busy}>업무 상태 새로고침</button></div>}
    {data?.configured === false && <div className="al-error" role="status">테스트용 AI 연결 설정이 필요합니다.</div>}
    <div className="al-workspace">
      <section className="al-conversation" aria-labelledby="al-chat-title">
        <div className="al-panel-title"><div><h2 id="al-chat-title">{isRequester ? "의뢰자 에이전트" : "기관 에이전트"}</h2><p>{isRequester ? "요청 준비 · 기관 문의 · 견적 비교" : "요청 검토 · 견적 작성 · 고객관리"}</p></div><span className="al-private"><LockSimple size={15} aria-hidden="true" />역할별 대화</span></div>
        <div className="al-messages" role="log" aria-label="에이전트 대화" aria-live="polite" aria-busy={busy || loading}>
          {loading ? <div className="al-skeleton" role="status"><span>대화를 불러오고 있어요.</span><i /><i /><i /></div> : view && !view.chat.length ? <div className="al-welcome"><span className="al-glyph"><ChatCircleText size={32} aria-hidden="true" /></span><h3>{isRequester ? "어떤 의뢰를 준비할까요?" : view.request ? "접수된 요청을 함께 검토해요." : "의뢰자의 요청을 기다리고 있어요."}</h3><p>{isRequester ? "조건을 알려 주면 요청서로 정리하고, 필요한 확인 사항을 찾아요." : view.request ? "참여에 동의하면 요청서 전체를 보고 우리 기관의 조건으로 견적을 준비할 수 있어요." : "의뢰자 역할에서 예시 요청서를 작성하고 전달해 보세요."}</p></div> : view?.chat.map(item => <article className={`al-message al-message--${item.from}`} key={item.id}><span className="al-message-label">{item.from === "user" ? ROLE_LABEL[role] : "단추 에이전트"}</span><div><MessageText text={item.text} /></div></article>)}
          {(busy || data?.inProgress) && <div className="al-working" role="status"><span className="al-working-line" />업무를 확인하고 있어요. 완료되면 문서에 반영돼요.</div>}
          {data?.approval?.role === role && <section className="al-approval" aria-label="실행 전 확인"><h3>실행 전에 확인해 주세요</h3>{data.approval.actions.map((action, i) => <div key={i}><strong>{action.label}</strong>{Object.entries(action.arguments).map(([key, value]) => <p key={key}>{key === "question" ? "질문" : key === "answer" ? "답변" : "질문 번호"}: {String(value)}</p>)}</div>)}<p>아래 작업 문서와 내용을 확인해 주세요. 이 테스트 안에서만 전달돼요.</p><div className="al-approval-actions"><button className="al-secondary" disabled={busy} onClick={() => void act({ action: "approval", approvalId: data.approval!.id, approve: false })}>취소</button><button className="al-primary" disabled={busy} onClick={() => void act({ action: "approval", approvalId: data.approval!.id, approve: true })}>확인하고 실행<Check size={17} aria-hidden="true" /></button></div></section>}
          {data?.waitingFor && !data.approval && <p className="al-waiting">{data.waitingFor} 역할에서 대기 중인 작업을 확인해 주세요.</p>}
          <div ref={endRef} />
        </div>
        <div className="al-compose"><div className="al-prompts">{prompts.map(prompt => <button key={prompt.label} disabled={blocked} onClick={() => { setMessage(prompt.text); inputRef.current?.focus(); }}>{prompt.label}<ArrowRight size={14} aria-hidden="true" /></button>)}</div><form onSubmit={submit}><label className="al-sr" htmlFor="agent-message">에이전트에게 맡길 업무</label><textarea ref={inputRef} id="agent-message" value={message} onChange={event => setMessage(event.target.value)} rows={3} maxLength={4000} disabled={blocked} placeholder={isRequester ? "시험 조건이나 확인하고 싶은 내용을 알려 주세요." : "검토하거나 작성할 업무를 알려 주세요."} /><button type="submit" className="al-send" disabled={blocked || !message.trim()} aria-label="메시지 보내기"><ArrowUp size={21} weight="bold" /></button></form><p className="al-compose-help">{data?.remainingTurns === 0 ? "이 세션의 테스트 호출 한도에 도달했어요." : "초안은 대화로 수정하고, 전달할 때 내용을 확인해요."}</p></div>
      </section>
      <aside className="al-documents" aria-labelledby="al-doc-title"><div className="al-panel-title"><div><h2 id="al-doc-title">작업 문서</h2><p>에이전트가 처리한 결과가 여기에 모여요.</p></div><FileText size={22} aria-hidden="true" /></div>
        {!view ? <div className="al-skeleton"><i /><i /><i /></div> : <>
          <div className="al-status"><span>{!view.request ? "요청 준비" : isRequester ? "회신 진행" : view.ownQuote ? "견적 제출 완료" : view.joined ? "검토·견적 작성" : "참여 확인"}</span><strong>{isRequester && view.request ? `참여 ${view.joined}/2 · 견적 ${view.submitted}/2` : view.comparisonOpen ? "비교표 공개" : "TEST-001"}</strong></div>
          {view.request || view.draft ? <section className="al-document-section"><h2>{view.request ? "전달된 요청서" : "요청서 초안"}</h2><RequestDocument draft={view.request ?? view.draft!} /></section> : <div className="al-empty"><FileText size={30} aria-hidden="true" /><p>요청서를 작성하면<br />조건과 진행 상황을 확인할 수 있어요.</p></div>}
          {view.quoteDraft && <section className="al-document-section"><h2>{view.ownQuote ? "제출한 견적" : "견적 초안"}<span>예시 단가 기준</span></h2><QuoteDocument quote={view.ownQuote ?? view.quoteDraft} /></section>}
          {view.comparisonOpen && <section className="al-document-section"><h2>견적 비교<span>예시 데이터</span></h2><div className="al-table-wrap"><table><caption className="al-sr">두 예시 기관의 견적 비교</caption><thead><tr><th>조건</th>{view.comparison.map(q => <th key={q.org}>{q.label}</th>)}</tr></thead><tbody><tr><th>공급가</th>{view.comparison.map(q => <td key={q.org}>{money(q.total)}</td>)}</tr><tr><th>처리 기간</th>{view.comparison.map(q => <td key={q.org}>{q.leadDays}일</td>)}</tr><tr><th>포함</th>{view.comparison.map(q => <td key={q.org}>{q.includes.join(", ")}</td>)}</tr><tr><th>별도</th>{view.comparison.map(q => <td key={q.org}>{q.excludes.join(", ")}</td>)}</tr></tbody></table></div><p className="al-note">가격·기간은 테스트용입니다. 실제 수행 가능 여부와 일정은 기관의 확인이 필요합니다.</p></section>}
          {isRequester && view.request && !view.comparisonOpen && <p className="al-note al-comparison-wait">두 예시 기관이 참여하고 견적을 모두 제출하면 비교표가 열려요.</p>}
          {view.questions.length > 0 && <section className="al-document-section"><h2>추가 질문</h2>{view.questions.map(q => <div key={q.id} className="al-question"><span>{isRequester ? ROLE_LABEL[q.org] : "의뢰자에게 보낸 질문"}</span><p>{q.question}</p>{q.answer ? <p className="al-answer">답변: {q.answer}</p> : <span className="al-pending-label">답변 대기 · {q.id}</span>}</div>)}</section>}
          {!isRequester && view.crmNotes.length > 0 && <section className="al-document-section"><h2>기관 내부 메모<LockSimple size={15} aria-hidden="true" /></h2>{view.crmNotes.map((note, i) => <p className="al-note" key={i}>{note}</p>)}</section>}
          {!isRequester && view.catalog && <details className="al-catalog"><summary>우리 기관의 예시 단가표</summary><dl>{Object.entries(view.catalog.prices).map(([item, amount]) => <div key={item}><dt>{item} / 검체 1개</dt><dd>{money(amount)}</dd></div>)}</dl><p className="al-note">단가표에 없는 항목은 금액을 추정하지 않아요.</p></details>}
        </>}
      </aside>
    </div>
    <footer className="al-footer"><p>예시 요청과 기관 두 곳으로 진행하는 테스트입니다. 실제 의뢰·메일 발송·계약은 이루어지지 않습니다.</p><p>테스트 세션은 2시간 동안 유지됩니다. 새 테스트를 시작하면 요청·대화가 초기화됩니다.</p></footer>
  </main>;
}
