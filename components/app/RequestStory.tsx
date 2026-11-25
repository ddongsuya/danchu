import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";
import type { Funnel } from "@/lib/request-story";
import { md } from "@/lib/format";

export type StoryProps = {
  no: string;
  substance: string;
  categories: string[];
  status: string;
  outcome: string | null;
  started: boolean;
  /** 접수일 (rfq.created_at) */
  createdAt: string;
  replyBy: string | null;
  distributedAt: string | null;
  comparedAt: string | null;
  award: { name: string; at: string; reportedAt: string | null } | null;
  /** 계약이 확정됐다 (기관 보고 뒤 의뢰자 확인·자동·운영자 확정) */
  contractDone?: boolean;
  f: Funnel;
  /** 비교 보고서를 열 수 있다 (열렸고 견적이 있다) */
  canCompare: boolean;
  /** 기관이 체결을 보고했고 의뢰자 확인을 기다린다. 상태 줄의 행동을 확인 한 가지로 바꾼다 (2026-11-02 가상 35명 테스트 2번) */
  confirm?: boolean;
  /** 질의응답 바로가기 (0045). 참여한 기관이 있을 때. 없으면 운영자 문의 */
  qna?: { total: number; pending: number } | null;
  /** 제목 아래 붙는 주요 조건 (규제 기관, 참여 자리, CDA 등) */
  conditions?: string[];
  /** 상태 줄 아래 (다음 할 일 띠) */
  next?: ReactNode;
  /** 왼쪽 열 맨 위 (계약 확인·결과 알림처럼 지금 정할 것) */
  top?: ReactNode;
  /** 왼쪽 열 활동 아래 (요청 내용, 마무리) */
  main?: ReactNode;
  /** 오른쪽 열 맨 위 (계약 카드) */
  side?: ReactNode;
  /** 참여 현황 카드 숫자 아래 (지명 기관, 공개 시점 안내 등) */
  children?: ReactNode;
};

type Step = { t: string; s: string; state: "done" | "now" | "next" };
type Track = { t: string; s: string; state: "done" | "now" | "next" | "stop" };

const TRACK = ["접수", "참여 안내", "견적 도착", "비교표", "선택", "계약"] as const;

/** 단계 띠에서 지금 단계 (모두 끝났으면 TRACK.length) */
function trackAt(p: StoryProps): number {
  if (!p.started || p.f.sent === 0) return 0;
  if (!p.comparedAt) return p.f.submitted > 0 ? 2 : 1;
  if (!p.award) return 3;
  return p.contractDone || p.status === "closed" ? TRACK.length : 5;
}

function trackOf(p: StoryProps, ended: boolean): Track[] {
  const at = trackAt(p);
  const subs = [
    md(p.createdAt),
    p.f.sent ? `${p.f.sent}곳` : "",
    p.f.submitted ? `${p.f.submitted}건` : p.replyBy ? `기한 ${md(p.replyBy)}` : "",
    p.comparedAt ? md(p.comparedAt) : "",
    p.award?.name ?? "",
    p.contractDone ? "확정" : p.award?.reportedAt ? "확인 대기" : "",
  ];
  return TRACK.map((t, i) => ({ t, s: subs[i], state: i < at ? "done" : i === at ? (ended ? "stop" : "now") : "next" }));
}

/** 활동: 접수부터 지금까지 일어난 일. 숫자는 합계만 쓴다 (기관 이름·기관별 불참 여부는 보이지 않는다, lib/request-story.ts) */
function stepsOf(p: StoryProps, ended: boolean): Step[] {
  const { f } = p;
  const pending = Math.max(0, f.joined - f.submitted);
  const steps: Step[] = [{ t: "요청 접수", s: md(p.createdAt), state: "done" }];
  if (f.sent > 0) {
    steps.push({ t: `기관 ${f.sent}곳에 요청 전달`, s: `${p.distributedAt ? `${md(p.distributedAt)} · ` : ""}분야가 맞는 기관`, state: "done" });
    steps.push({ t: f.opened ? `${f.opened}곳이 요청 요약 확인` : "요약을 연 기관 없음", s: f.sent > f.opened ? `${f.sent - f.opened}곳 아직 열지 않음` : "보낸 곳 모두 확인", state: "done" });
    steps.push({ t: f.joined ? `${f.joined}곳 참여` : "참여한 기관 없음", s: f.rest ? `${f.rest}곳 불참 또는 결정 전` : "보낸 곳 모두 참여", state: "done" });
    steps.push({
      t: f.submitted ? `견적 ${f.submitted}건 도착` : "도착한 견적 없음",
      s: p.comparedAt ? "회신 마감. 도착한 견적은 더 바뀌지 않아요" : pending ? `${pending}곳 작성 중${p.replyBy ? ` · 회신 기한 ${md(p.replyBy)}` : ""}` : p.replyBy ? `회신 기한 ${md(p.replyBy)}` : "",
      state: "done",
    });
    if (p.comparedAt) steps.push({ t: f.submitted ? "비교 보고서 열림" : "견적 없이 회신 마감", s: md(p.comparedAt), state: "done" });
    else if (!ended) steps.push({ t: "비교 보고서 열림 예정", s: p.replyBy ? `참여한 곳이 모두 내거나 회신 기한 ${md(p.replyBy)}이 지나면` : "참여한 곳이 모두 내면", state: "next" });
    if (p.award) {
      steps.push({ t: `${p.award.name} 선택`, s: md(p.award.at), state: "done" });
      steps.push({ t: p.award.reportedAt ? "기관이 계약 체결 보고" : "계약 소식 기다리는 중", s: p.award.reportedAt ? md(p.award.reportedAt) : "계약은 기관과 직접 진행해요", state: p.award.reportedAt ? "done" : "next" });
    } else if (p.status === "closed") steps.push({ t: "선택 없이 마무리", s: p.outcome ?? "", state: "done" });
  }
  // 지금 단계: 끝나지 않은 첫 단계 바로 앞. 모두 끝났으면 마지막
  const firstNext = steps.findIndex((s) => s.state === "next");
  const nowAt = firstNext === -1 ? steps.length - 1 : firstNext - 1;
  if (nowAt >= 0 && !ended) steps[nowAt] = { ...steps[nowAt], state: "now" };
  return steps;
}

/** 상태 줄의 굵은 한 마디와 설명 */
function statusOf(p: StoryProps): { title: string; lead: string } {
  const { f } = p;
  if (p.status === "cancelled") return { title: "취소한 요청", lead: "이 요청은 더 진행하지 않아요." };
  if (p.award && p.confirm) return { title: "계약 내용 확인", lead: `${p.award.name}에서 계약 체결을 보고했어요. 체결일과 금액이 맞는지 봐 주세요.` };
  if (p.award) return { title: `${p.award.name} 선택`, lead: "서로 연락처를 주고받았고, 계약은 기관과 직접 진행해요." };
  if (p.status === "closed") return { title: "선택 없이 마무리", lead: p.outcome ?? "" };
  if (!p.started) return { title: "아직 기관에 보내지 않음", lead: "첨부를 확인한 뒤 참여 안내를 보낼 수 있어요." };
  if (f.sent === 0) return { title: "보낼 기관 확인 중", lead: "분야에 바로 맞는 기관이 없어 운영자가 안내할 기관을 확인하고 있어요. 보통 영업일 1~2일 걸려요." };
  if (p.comparedAt) return f.submitted ? { title: `비교 보고서 열림 · 견적 ${f.submitted}건`, lead: "참여한 기관의 금액·기간·항목을 같은 기준으로 맞춰 봤어요." } : { title: "견적 없이 회신 마감", lead: "기한을 늘리거나 마무리할지 정해 주세요." };
  return {
    title: `기관 ${f.sent}곳에 요청 · 참여 ${f.joined}곳 · 견적 ${f.submitted}건`,
    lead: f.joined ? (p.replyBy ? `비교 보고서는 늦어도 회신 기한 ${md(p.replyBy)} 다음 날 열려요.` : "참여한 곳이 모두 내면 비교 보고서가 열려요.") : "기관이 요약을 보고 참여를 정하는 중이에요.",
  };
}

/**
 * 요청 진행 상황 (2026-11-26 시안 v7 배치): 단계 띠 → 제목 → 상태 줄(행동 하나) → 두 열 카드.
 * 왼쪽 활동·요청 내용, 오른쪽 숫자·바로 가기(계약 단계는 계약 카드). 계산과 공개 규칙은 그대로다.
 */
export function RequestStory(p: StoryProps) {
  const { f } = p;
  const ended = p.status === "closed" || p.status === "cancelled";
  const track = trackOf(p, ended);
  const steps = stepsOf(p, ended);
  const st = statusOf(p);
  const sub = [`접수 ${md(p.createdAt)}`, p.categories.join(", "), ...(p.conditions ?? [])].filter(Boolean).join(" · ");
  const action = p.confirm ? (
    <a href="#contract-confirm" className="b1">계약 내용 확인</a>
  ) : p.canCompare ? (
    <Link href={`/app/r/${p.no}/compare`} className={p.award ? "b2" : "b1"}>비교 보고서 받아보기</Link>
  ) : p.qna?.pending ? (
    <Link href={`/app/r/${p.no}/qna`} className="b1">질의응답 <span className="tnum">답변 대기 {p.qna.pending}</span></Link>
  ) : null;

  return (
    <div className="rq">
      <ol className="rq-track" aria-label="진행 단계">
        {track.map((s) => (
          <li key={s.t} className={`rq-track__s rq-track__s--${s.state}`} aria-current={s.state === "now" ? "step" : undefined}>
            <span className="rq-track__i" aria-hidden="true">{s.state === "done" && <Check size={12} weight="bold" />}</span>
            <span className="rq-track__t">
              <b>{s.t}</b>
              {s.s && <small className="tnum">{s.s}</small>}
            </span>
          </li>
        ))}
      </ol>

      <header className="rq-head">
        <p className="rq-head__k only-narrow"><span className="tnum">{p.no}</span> {p.substance}</p>
        <h1 id="story-title">진행 상황</h1>
        <p className="rq-head__sub">{sub}</p>
      </header>

      <div className="rq-banner" role="status">
        <p className="rq-banner__t">
          <b>{st.title}</b>
          {st.lead && <span>{st.lead}</span>}
        </p>
        {action && <div className="rq-banner__a">{action}</div>}
      </div>
      {p.next}

      <div className="rq-grid">
        <div className="rq-grid__main">
          {p.top}
          <section className="card rq-card" aria-labelledby="act-title">
            <h2 id="act-title" className="rq-card__h">활동</h2>
            <ol className="rq-tl">
              {steps.map((s, i) => (
                <li key={i} className={`rq-tl__i rq-tl__i--${s.state}`} aria-current={s.state === "now" ? "step" : undefined}>
                  <b>{s.t}</b>
                  {s.s && <span>{s.s}</span>}
                </li>
              ))}
            </ol>
          </section>
          {p.main}
        </div>
        <aside className="rq-grid__side" aria-label="요약">
          {p.side}
          <section className="card rq-card" aria-labelledby="num-title">
            <h2 id="num-title" className="rq-card__h">참여 현황</h2>
            <dl className="rq-nums">
              <div><dt>보낸 곳</dt><dd className="tnum">{f.sent}</dd></div>
              <div><dt>열람</dt><dd className="tnum">{f.opened}</dd></div>
              <div><dt>참여</dt><dd className="tnum">{f.joined}</dd></div>
              <div><dt>제출</dt><dd className="tnum">{f.submitted}</dd></div>
            </dl>
            {p.children && <div className="rq-card__more">{p.children}</div>}
          </section>
          <section className="card rq-card" aria-labelledby="go-title">
            <h2 id="go-title" className="rq-card__h">바로 가기</h2>
            <ul className="rq-links">
              {p.canCompare && <li><Link href={`/app/r/${p.no}/compare`}>비교 보고서</Link></li>}
              {p.qna && (
                <li>
                  <Link href={`/app/r/${p.no}/qna`}>질의응답</Link>
                  <span className="tnum">{p.qna.pending ? `답변 대기 ${p.qna.pending}` : p.qna.total ? `${p.qna.total}건` : ""}</span>
                </li>
              )}
              <li><Link href={`/app/support?rfq=${p.no}`}>이 요청 문의</Link></li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
