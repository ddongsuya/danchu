import Link from "next/link";
import type { ReactNode } from "react";
import { closedMessage, type Loaded } from "@/lib/quote-load";
import { replyProgress } from "@/lib/cro-story";
import { md, won } from "@/lib/format";
import "./layout-request.css";

/** 2차 상세 견적 요청을 받은 기관에 보이는 안내 (0042) */
export type DetailCue = { open: boolean; status: "sent" | "submitted" | "kept" | "declined"; replyBy: string; href: string };

/** 질의응답 바로가기 (0045). 참여한 기관만 */
export type QnaCue = { href: string; total: number; pending: number };

type Step = { n: string; t: string; s: string; state: "done" | "now" | "next" };
type Act = { href: string; label: string; primary: boolean };

/**
 * 기관이 보는 요청 화면의 틀 (시안 v7 c-r · q-view, 2026-11-26 배치 점검). 포털(/cro/r)과 토큰 링크(/q)가 함께 쓴다.
 * 제목 줄(요청 번호 · 제목 · 조건 한 줄 · 기한 · 질의응답) → 지금 상태 한 줄과 다음 행동 하나 → 본문(main) + 오른쪽 열(기한 · 참여 현황 · 바로 가기).
 * notices: 상태 줄 아래 전체 폭 안내. side: 오른쪽 열 맨 위(참여 결정), sideEnd: 오른쪽 열 맨 아래(참여 철회)
 */
export function CroStory({ got, replyHref, detail, qna, notices, main, side, sideEnd }: { got: Loaded; replyHref: string; detail?: DetailCue | null; qna?: QnaCue | null; notices?: ReactNode; main?: ReactNode; side?: ReactNode; sideEnd?: ReactNode }) {
  const { rfq, draft } = got;
  const submitted = draft?.status === "submitted";
  const summary = !rfq.full;
  const ended = got.closed || got.declined || got.expired;
  const deciding = summary && !ended;
  const p = replyProgress(rfq.rows, draft?.items);
  const total = draft?.items.reduce((a, it) => a + (it.avail !== "불가" && it.amount ? Number(it.amount) : 0), 0) ?? 0;
  const joinBy = got.joinBy ? md(new Date(got.joinBy).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })) : "";
  const field = `${rfq.categories.join(", ") || "비임상 시험"}`;

  let status: string;
  let lead: string;
  if (detail?.open) {
    status = "상세 견적 요청이 도착했어요";
    lead = `의뢰자가 1차 견적을 본 뒤 상세 조건을 보냈어요. 2차 회신 기한 ${md(detail.replyBy)}.`;
  } else if (detail && detail.status !== "sent" && got.closedReason === "compared") {
    status = "2차 회신을 보냈어요";
    lead = detail.status === "submitted" ? "의뢰자가 1차와 2차 견적을 함께 보고 있어요." : detail.status === "kept" ? "1차 견적 그대로 진행한다고 답했어요." : "이번에는 2차 견적을 내지 않는다고 답했어요.";
  } else if (got.closed) {
    status = "이 요청의 회신이 닫혔어요";
    lead = closedMessage(got.closedReason, { submitted });
  } else if (got.withdrawn) {
    status = "이 요청의 참여를 철회했어요";
    lead = "청구하지 않으며, 작성 중이던 내용은 의뢰자에게 보이지 않아요.";
  } else if (got.declined) {
    status = "이 요청에 불참했어요";
    lead = got.canRejoin && joinBy ? `참여 결정 기한(${joinBy})까지는 남은 자리가 있으면 다시 참여할 수 있어요.` : "다음 참여 안내에는 영향이 없어요.";
  } else if (got.expired) {
    status = "회신 기한이 지났어요";
    lead = "이 요청에는 더 회신할 수 없어요.";
  } else if (summary) {
    status = "견적 요청이 왔어요";
    lead = `요약을 보고 참여를 정해 주세요.${joinBy ? ` 참여 결정 기한은 ${joinBy}이에요.` : ""} 시험물질명과 자세한 내용은 참여하면 열려요.`;
  } else if (submitted) {
    status = "견적을 제출했어요";
    lead = `총액 ${won(total)} (VAT 별도). ${got.locked ? "회신 기한이 지나 더 고칠 수 없어요." : "비교표가 열리기 전까지 고칠 수 있어요."}`;
  } else if (p.left.length === 0) {
    status = "모든 항목을 썼어요. 제출만 남았어요";
    lead = `회신 기한 ${md(rfq.replyBy)}까지 제출하면 이 요청의 비교표에 들어가요.`;
  } else {
    status = `시험 ${p.total}개 견적, ${p.left.length}개 남았어요`;
    lead = `${draft?.prefilled ? "시험 목록으로 채운 초안이 있어요. 확인하고 저장해 주세요." : p.done ? "작성한 내용은 저장되어 있어요." : "항목마다 가능 여부와 금액·기간을 적어 주세요."} 회신 기한 ${md(rfq.replyBy)}까지 제출하면 이 요청의 비교표에 들어가요.`;
  }

  const steps: Step[] = [
    { n: "1", t: "요청이 도착했어요", s: `${field}${rfq.authorities.length ? ` · ${rfq.authorities.join(", ")} 제출용` : ""}`, state: "done" },
    { n: "2", t: summary ? (got.declined ? "불참했어요" : got.closed ? "참여하기 전에 닫혔어요" : "요약을 보고 참여를 정해요") : got.withdrawn ? "참여했다가 철회했어요" : "참여했어요", s: summary ? (got.closed && !got.declined ? "" : joinBy ? `참여 결정 기한 ${joinBy}` : "") : "요청서 전체가 열렸어요", state: summary && !ended ? "now" : "done" },
    { n: "3", t: submitted ? "회신을 다 썼어요" : summary ? "회신을 써요" : `회신 항목 ${p.total}개 중 ${p.done}개를 썼어요`, s: !summary && !submitted && p.left.length ? `남은 항목: ${p.left.slice(0, 3).join(", ")}${p.left.length > 3 ? ` 외 ${p.left.length - 3}개` : ""}` : "", state: submitted ? "done" : !summary && !ended ? "now" : "next" },
    { n: "4", t: submitted ? "견적을 제출했어요" : "회신 마감", s: `회신 기한 ${md(rfq.replyBy)}${got.closed ? "" : " · 지나면 이 요청에 회신할 수 없어요"}`, state: submitted ? "done" : "next" },
    { n: "5", t: "의뢰자가 비교표를 보고 기관을 골라요", s: got.closedReason === "selected" ? "의뢰자가 기관을 골랐어요" : summary ? "" : "결과는 알림으로 알려요", state: got.closedReason === "selected" ? "done" : submitted && !got.closed ? "now" : "next" },
  ];
  // 제출한 뒤에는 "비교표 공개 기다림"이 지금 단계다. 닫힌 요청은 지금 단계가 없다
  if (ended) for (const s of steps) if (s.state === "now") s.state = "next";

  const canWrite = !summary && !ended;
  const replyLabel = submitted ? (got.locked ? "제출한 회신 보기" : "제출한 회신 고치기") : draft ? "이어 쓰기" : "견적 쓰기";
  const qnaLabel = `질의응답${qna?.pending ? ` · 답변 대기 ${qna.pending}` : qna?.total ? ` ${qna.total}` : ""}`;
  // 상태 줄의 다음 행동은 하나만. 나머지는 오른쪽 열 바로 가기에 남는다
  const next: Act | null = detail?.open
    ? { href: detail.href, label: "2차 견적 쓰기", primary: true }
    : deciding || (got.canRejoin && !got.withdrawn)
      ? { href: "#join-title", label: deciding ? "참여 결정" : "다시 참여", primary: true }
      : canWrite
        ? { href: replyHref, label: replyLabel, primary: !submitted }
        : detail && detail.status !== "sent"
          ? { href: detail.href, label: "2차 회신 보기", primary: false }
          : qna?.pending
            ? { href: qna.href, label: qnaLabel, primary: true }
            : null;
  const links: Act[] = [
    ...(canWrite ? [{ href: replyHref, label: replyLabel, primary: false }] : []),
    ...(detail && (detail.open || detail.status !== "sent") ? [{ href: detail.href, label: detail.open ? "2차 견적 쓰기" : "2차 회신 보기", primary: false }] : []),
    ...(qna ? [{ href: qna.href, label: qnaLabel, primary: false }] : []),
  ].filter((l) => l.href !== next?.href);

  const dueLabel = deciding && joinBy ? `참여 결정 ${joinBy}` : `회신 기한 ${md(rfq.replyBy)}`;
  const duePill = got.expired ? "pill pill--err" : ended ? "pill pill--sf" : rfq.urgent ? "pill pill--warn" : "pill pill--sf";
  const sub = [summary ? "" : field, rfq.client, rfq.authorities.length ? `${rfq.authorities.join(", ")} 제출용` : "", `시험 ${rfq.rows.length}개`].filter(Boolean).join(" · ");

  return (
    <div className="lr">
      <header className="lr-head">
        <div className="lr-head__main">
          <span className="lr-no tnum">{rfq.no}</span>
          <h1>{summary ? field : rfq.substance || field}</h1>
          <p className="lr-sub">{sub}</p>
        </div>
        <div className="lr-head__side">
          <span className={duePill}>
            <span className="tnum">{dueLabel}</span>
            {!ended && rfq.ddayLabel && <span className="tnum">· {rfq.ddayLabel}</span>}
          </span>
          {qna && <Link href={qna.href} className="b2 bsm">{qnaLabel}</Link>}
        </div>
      </header>

      <section className={`lr-ban${ended ? " lr-ban--end" : ""}`} aria-label="지금 상태">
        <p className="lr-ban__t">
          <b>{status}</b>
          <span>{lead}</span>
        </p>
        {next && <Link href={next.href} className={next.primary ? "b1" : "b2"}>{next.label}</Link>}
      </section>

      {notices}

      <div className="lr-split">
        <div className="lr-main">{main}</div>
        <aside className="lr-side" aria-label="기한과 참여 현황">
          {side}
          <section className="card lr-box" aria-labelledby="lr-due-title">
            <h2 id="lr-due-title" className="lr-box__h">기한 · 일정</h2>
            <dl className="lr-dl">
              {joinBy && <div><dt>참여 결정 기한</dt><dd className="tnum">{joinBy}</dd></div>}
              <div><dt>회신 기한</dt><dd className="tnum">{md(rfq.replyBy)}{!ended && rfq.ddayLabel ? ` · ${rfq.ddayLabel}` : ""}</dd></div>
              {detail && <div><dt>2차 회신 기한</dt><dd className="tnum">{md(detail.replyBy)}</dd></div>}
              {!summary && p.total > 0 && <div><dt>회신 항목</dt><dd className="tnum">{p.done} / {p.total}</dd></div>}
              {submitted && <div><dt>제출 총액</dt><dd className="tnum">{won(total)}</dd></div>}
            </dl>
          </section>
          <section className="card lr-box" aria-labelledby="lr-path-title">
            <h2 id="lr-path-title" className="lr-box__h">참여 현황</h2>
            <ol className="lr-steps">
              {steps.map((s) => (
                <li key={s.n} className={`lr-step lr-step--${s.state}`} aria-current={s.state === "now" ? "step" : undefined}>
                  <span className="lr-step__n tnum" aria-hidden="true">{s.n}</span>
                  <span className="lr-step__t">
                    <b>{s.t}</b>
                    {s.s && <span>{s.s}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          {links.length > 0 && (
            <nav className="card lr-box" aria-label="바로 가기">
              <h2 className="lr-box__h">바로 가기</h2>
              <ul className="lr-links">
                {links.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}
              </ul>
            </nav>
          )}
          {sideEnd}
        </aside>
      </div>
    </div>
  );
}
