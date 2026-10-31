import Link from "next/link";
import type { ReactNode } from "react";
import { Orbit } from "@/components/app/Orbit";
import { dotsOf, type Funnel } from "@/lib/request-story";
import { md } from "@/lib/format";

export type StoryProps = {
  no: string;
  substance: string;
  categories: string[];
  status: string;
  outcome: string | null;
  started: boolean;
  replyBy: string | null;
  distributedAt: string | null;
  comparedAt: string | null;
  award: { name: string; at: string; reportedAt: string | null } | null;
  f: Funnel;
  /** 비교 보고서를 열 수 있다 (열렸고 견적이 있다) */
  canCompare: boolean;
  /** 첫 장면 아래, 지나온 길 위에 둘 것 (다음 할 일 띠) */
  next?: ReactNode;
  /** 지나온 길 아래에 붙는 설명 (지명 기관, 공개 시점 안내 등) */
  children?: ReactNode;
};

/** n 은 단계 번호가 아니라 그 단계의 수(곳·건)다. u 로 단위를 붙여 단계 번호로 읽히지 않게 한다 */
type Step = { n: string; u?: string; t: string; s: string; dots?: boolean; state: "done" | "now" | "next" };

/**
 * 요청 이야기 (2026-10-29 대표 지시): "몇 곳에 요청 → 몇 곳이 확인 → 참여 → 견적 → 비교 보고서".
 * 숫자는 합계만 쓴다. 기관 이름·기관별 불참 여부는 여기서 보이지 않는다 (lib/request-story.ts).
 */
export function RequestStory(p: StoryProps) {
  const { f } = p;
  const ended = p.status === "closed" || p.status === "cancelled";
  const pending = Math.max(0, f.joined - f.submitted);
  const steps: Step[] = [];
  if (f.sent > 0) {
    steps.push({ n: String(f.sent), u: "곳", t: `기관 ${f.sent}곳에 요청이 전달됐어요`, s: `${p.distributedAt ? `${md(p.distributedAt)} · ` : ""}분야가 맞는 기관에게`, dots: true, state: "done" });
    steps.push({ n: String(f.opened), u: "곳", t: f.opened ? `${f.opened}곳이 요청 요약을 확인했어요` : "아직 요약을 연 기관이 없어요", s: f.sent > f.opened ? `${f.sent - f.opened}곳은 아직 열어 보지 않았어요` : "보낸 곳 모두 확인했어요", state: "done" });
    steps.push({ n: String(f.joined), u: "곳", t: f.joined ? `${f.joined}곳이 참여했어요` : "아직 참여한 기관이 없어요", s: f.rest ? `${f.rest}곳은 참여하지 않았거나 아직 정하지 않았어요` : "보낸 곳 모두 참여했어요", state: "done" });
    steps.push({
      n: String(f.submitted),
      u: "건",
      t: f.submitted ? `${f.submitted}곳이 견적을 보냈어요` : "아직 도착한 견적이 없어요",
      s: p.comparedAt ? "회신이 마감됐어요. 도착한 견적은 더 바뀌지 않아요" : pending ? `남은 ${pending}곳은 작성 중이에요${p.replyBy ? ` · 회신 기한 ${md(p.replyBy)}` : ""}` : p.replyBy ? `회신 기한 ${md(p.replyBy)}` : "",
      state: "done",
    });
    if (p.comparedAt) steps.push({ n: "", t: f.submitted ? "비교 보고서가 열렸어요" : "견적 없이 회신이 마감됐어요", s: md(p.comparedAt), state: "done" });
    else if (!ended) steps.push({ n: "", t: "비교 보고서가 열려요", s: p.replyBy ? `참여한 곳이 모두 내거나 회신 기한 ${md(p.replyBy)}이 지나면` : "참여한 곳이 모두 내면", state: "next" });
    if (p.award) {
      steps.push({ n: "", t: `${p.award.name} 선택`, s: md(p.award.at), state: "done" });
      steps.push({ n: "", t: p.award.reportedAt ? "기관이 계약 체결을 보고했어요" : "계약 소식을 기다리는 중이에요", s: p.award.reportedAt ? md(p.award.reportedAt) : "계약은 기관과 직접 진행해요", state: p.award.reportedAt ? "done" : "next" });
    } else if (p.status === "closed") steps.push({ n: "", t: "선택 없이 마무리했어요", s: p.outcome ?? "", state: "done" });
    // 지금 단계: 끝나지 않은 첫 단계 바로 앞. 모두 끝났으면 마지막
    const firstNext = steps.findIndex((s) => s.state === "next");
    const nowAt = firstNext === -1 ? steps.length - 1 : firstNext - 1;
    if (nowAt >= 0 && !ended) steps[nowAt].state = "now";
  }

  let title: ReactNode;
  let lead: string;
  if (p.status === "cancelled") {
    title = <>취소한<br />요청이에요</>;
    lead = "이 요청은 더 진행하지 않아요.";
  } else if (p.award) {
    title = <>기관 선택을<br />마쳤어요</>;
    lead = `${p.award.name} 선택. 서로 연락처를 주고받았고, 계약은 기관과 직접 진행해요.`;
  } else if (p.status === "closed") {
    title = <>요청을<br />마무리했어요</>;
    lead = p.outcome ? `선택 없이 마무리했어요 · ${p.outcome}` : "선택 없이 마무리했어요.";
  } else if (!p.started) {
    title = <>아직 기관에<br />보내지 않았어요</>;
    lead = "첨부를 확인한 뒤 참여 안내를 보낼 수 있어요.";
  } else if (f.sent === 0) {
    title = <>보낼 기관을<br />찾고 있어요</>;
    lead = "분야에 바로 맞는 기관이 없어 운영자가 안내할 기관을 확인하고 있어요. 보통 영업일 1~2일 걸려요.";
  } else if (p.comparedAt) {
    title = f.submitted ? <>견적 {f.submitted}건이<br /><span className="rs-mark">비교 보고서</span>로<br />모였어요</> : <>도착한 견적 없이<br />회신이 마감됐어요</>;
    lead = f.submitted ? "참여한 기관의 금액·기간·항목을 같은 기준으로 맞춰 봤어요." : "기한을 늘리거나 마무리할지 정해 주세요.";
  } else {
    title = <>기관 <span className="rs-mark">{f.sent}곳</span>에<br />요청했어요</>;
    lead = f.joined
      ? `지금까지 ${f.joined}곳이 참여했고 그중 ${f.submitted}곳이 견적을 보냈어요.${p.replyBy ? ` 비교 보고서는 늦어도 회신 기한 ${md(p.replyBy)} 다음 날 열려요.` : ""}`
      : "기관이 요약을 보고 참여를 정하는 중이에요.";
  }

  return (
    <>
      <section className="rs-scene rs-scene--story" aria-labelledby="story-title">
        <div className={f.sent > 0 ? "rs-hero" : "rs-hero rs-hero--solo"}>
          <div>
            <p className="rs-k"><span className="tnum">{p.no}</span> {p.substance} · {p.categories.join(", ")}</p>
            <h1 id="story-title" className="rs-h1">{title}</h1>
            <p className="rs-lead">{lead}</p>
            <div className="rs-acts">
              {p.canCompare && <Link href={`/app/r/${p.no}/compare`} className={p.award ? "b2 blg" : "b1 blg"}>비교 보고서 받아보기</Link>}
              <Link href={`/app/support?rfq=${p.no}`} className="b2 blg">이 요청 문의하기</Link>
            </div>
          </div>
          {f.sent > 0 && <Orbit rings={[{ key: "r", dots: dotsOf(f, 32) }]} center={f.sent} label={`기관 ${f.sent}곳에 요청했어요. 참여 ${f.joined}곳, 견적 ${f.submitted}건.`} />}
        </div>
      </section>
      {p.next}
      {steps.length > 0 && (
        <section className="rs-block" aria-labelledby="path-title">
          <p className="rs-bk">어디까지 왔나요</p>
          <h2 id="path-title" className="rs-h2">요청이 지나온 길</h2>
          <ol className="rs-steps">
            {steps.map((s, i) => (
              <li key={i} className={`rs-step rs-step--${s.state}`} aria-current={s.state === "now" ? "step" : undefined}>
                <span className="rs-step__n tnum">{s.n}{s.n && s.u && <small>{s.u}</small>}</span>
                <span className="rs-step__t">
                  <b>{s.t}</b>
                  {s.s && <span>{s.s}</span>}
                </span>
                {s.dots && (
                  <span className="rs-dots" aria-hidden="true">
                    {dotsOf(f, 16).map((d, k) => <i key={k} className={`rs-dot rs-dot--${d}`} />)}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {p.children}
        </section>
      )}
      {steps.length === 0 && p.children && <section className="rs-block">{p.children}</section>}
    </>
  );
}
