import Link from "next/link";
import type { ReactNode } from "react";
import { Orbit } from "@/components/app/Orbit";
import { dotsOf, type Funnel } from "@/lib/request-story";
import type { Stuck } from "@/lib/stuck";
import { md } from "@/lib/format";

type Step = { n: string; t: string; s: string; state: "done" | "now" | "next" };

/**
 * 운영자 요청 상세 첫 장면 (2026-10-30, 세 역할 같은 틀). 지금 상태 한 문장과 멈춘 이유, 지나온 길.
 * 운영자는 기관 이름까지 보므로 기관별 진행은 아래 회신 현황 표가 맡는다.
 */
export function AdminStory(p: {
  no: string; substance: string; company: string; categories: string[]; status: string; createdAt: string; distributedAt: string | null;
  replyBy: string | null; comparedAt: string | null; award: { name: string; at: string; reportedAt: string | null } | null; f: Funnel; stuck: Stuck[]; children?: ReactNode;
}) {
  const { f } = p;
  const ended = p.status === "closed" || p.status === "cancelled";
  const late = p.stuck.length > 0;
  let title: ReactNode;
  if (ended) title = <>{p.status === "cancelled" ? "취소된" : "마무리된"}<br />요청이에요</>;
  else if (p.award) title = <>{p.award.name} 선택,<br />계약 단계예요</>;
  else if (p.comparedAt) title = <>견적 {f.submitted}건으로<br />비교표가 열렸어요</>;
  else if (f.sent === 0) title = <>요청이 접수됐어요<br />기관 안내 전이에요</>;
  else if (late && f.joined === 0) title = <>기관 {f.sent}곳에 전달했지만<br /><span className="rs-mark">참여 0곳</span>이에요</>;
  else title = <>기관 <span className="rs-mark">{f.sent}곳</span>에<br />전달된 요청이에요</>;
  const progress = f.opened === 0 ? `${f.sent}곳 모두 아직 요약을 열지 않았어요.` : f.joined === 0 ? `${f.opened}곳이 요약을 열었지만 참여한 곳은 없어요.` : `${f.opened}곳이 요약을 열었고, ${f.joined}곳이 참여해 견적 ${f.submitted}건이 도착했어요.`;
  const lead = f.sent ? `${progress}${late ? ` 멈춘 이유: ${p.stuck.map((s) => s.label).join(", ")}.` : ""}` : "분야가 맞는 기관을 골라 참여 안내를 보내 주세요.";
  const steps: Step[] = [
    { n: "1", t: "요청 접수", s: `${md(p.createdAt)} · ${p.categories.join(", ")}`, state: "done" },
    { n: "2", t: f.sent ? `기관 ${f.sent}곳에 참여 안내` : "참여 안내 전", s: p.distributedAt ? md(p.distributedAt) : "", state: f.sent ? "done" : "now" },
    { n: "3", t: `요약 열람 ${f.opened}곳 · 참여 ${f.joined}곳`, s: f.sent > f.opened ? `${f.sent - f.opened}곳은 아직 열지 않았어요` : "", state: f.sent ? "done" : "next" },
    { n: "4", t: `견적 ${f.submitted}건`, s: p.replyBy ? `회신 기한 ${md(p.replyBy)}` : "회신 기한 미정", state: p.comparedAt ? "done" : f.sent ? "now" : "next" },
    { n: "5", t: p.comparedAt ? "비교표 공개" : "비교표 공개 전", s: p.comparedAt ? md(p.comparedAt) : "참여한 곳이 모두 내거나 기한 다음 날", state: p.comparedAt ? "done" : "next" },
    ...(p.award ? [{ n: "6", t: `${p.award.name} 선택`, s: `${md(p.award.at)}${p.award.reportedAt ? ` · 계약 보고 ${md(p.award.reportedAt)}` : " · 계약 보고 기다리는 중"}`, state: (p.award.reportedAt ? "done" : "now") as Step["state"] }] : []),
  ];
  if (p.comparedAt && !p.award && !ended) steps[4].state = "now";
  if (ended) for (const s of steps) if (s.state === "now") s.state = "done";
  return (
    <>
      <section className="rs-scene" aria-labelledby="adm-story-title">
        <div className={f.sent ? "rs-hero" : "rs-hero rs-hero--solo"}>
          <div>
            <p className="rs-k"><span className="tnum">{p.no}</span> {p.substance} · {p.company}</p>
            <h1 id="adm-story-title" className="rs-h1">{title}</h1>
            <p className="rs-lead">{lead}</p>
            <div className="rs-acts">
              <Link href="#ops" className="b1 blg">{late ? p.stuck[0].action : "운영 작업 보기"}</Link>
              <Link href={`/app/r/${p.no}`} className="b2 blg">의뢰자 화면으로 보기</Link>
            </div>
          </div>
          {f.sent > 0 && <Orbit rings={[{ key: "r", dots: dotsOf(f, 32), late }]} center={`${f.joined}/${f.sent}`} label={`기관 ${f.sent}곳 중 ${f.joined}곳 참여, 견적 ${f.submitted}건`} />}
        </div>
      </section>
      <section className="rs-block" aria-labelledby="adm-path-title">
        <p className="rs-bk">어디까지 왔나요</p>
        <h2 id="adm-path-title" className="rs-h2">이 요청이 지나온 길</h2>
        <ol className="rs-steps">
          {steps.map((s) => (
            <li key={s.n} className={`rs-step rs-step--${s.state}`} aria-current={s.state === "now" ? "step" : undefined}>
              <span className="rs-step__n tnum">{s.n}</span>
              <span className="rs-step__t"><b>{s.t}</b>{s.s && <span>{s.s}</span>}</span>
            </li>
          ))}
        </ol>
        {p.children}
      </section>
    </>
  );
}
