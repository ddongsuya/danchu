import Link from "next/link";
import type { ReactNode } from "react";
import { Orbit } from "@/components/app/Orbit";
import { closedMessage, type Loaded } from "@/lib/quote-load";
import { replyProgress } from "@/lib/cro-story";
import { md, won } from "@/lib/format";

type Step = { n: string; t: string; s: string; state: "done" | "now" | "next" };

/**
 * 기관이 보는 요청 이야기 (2026-10-30, 의뢰자 요청 이야기와 같은 틀). 포털(/cro/r)과 토큰 링크(/q)가 함께 쓴다.
 * 첫 장면은 지금 상태 한 문장(참여 결정 / 남은 회신 항목 / 제출함 / 닫힘), 아래는 이 요청이 지나온 길.
 */
export function CroStory({ got, replyHref, children }: { got: Loaded; replyHref: string; children?: ReactNode }) {
  const { rfq, draft } = got;
  const submitted = draft?.status === "submitted";
  const summary = !rfq.full;
  const ended = got.closed || got.declined || got.expired;
  const p = replyProgress(rfq.rows, draft?.items);
  const total = draft?.items.reduce((a, it) => a + (it.avail !== "불가" && it.amount ? Number(it.amount) : 0), 0) ?? 0;
  const joinBy = got.joinBy ? md(new Date(got.joinBy).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })) : "";
  const field = `${rfq.categories.join(", ") || "비임상 시험"}`;

  let title: ReactNode;
  let lead: string;
  if (got.closed) {
    title = <>이 요청의<br />회신이 닫혔어요</>;
    lead = closedMessage(got.closedReason);
  } else if (got.withdrawn) {
    title = <>이 요청의<br />참여를 철회했어요</>;
    lead = "청구하지 않으며, 작성 중이던 내용은 의뢰자에게 보이지 않아요.";
  } else if (got.declined) {
    title = <>이 요청에<br />불참했어요</>;
    lead = got.canRejoin && joinBy ? `참여 결정 기한(${joinBy})까지는 남은 자리가 있으면 다시 참여할 수 있어요.` : "다음 참여 안내에는 영향이 없어요.";
  } else if (got.expired) {
    title = <>회신 기한이<br />지났어요</>;
    lead = "이 요청에는 더 회신할 수 없어요.";
  } else if (summary) {
    title = <>{field}<br />견적 요청이 왔어요</>;
    lead = `요약을 보고 참여를 정해 주세요.${joinBy ? ` 참여 결정 기한은 ${joinBy}이에요.` : ""} 시험물질명과 자세한 내용은 참여하면 열려요.`;
  } else if (submitted) {
    title = <>견적을<br /><span className="rs-mark">제출</span>했어요</>;
    lead = `총액 ${won(total)} (VAT 별도). ${got.locked ? "회신 기한이 지나 더 고칠 수 없어요." : "비교표가 열리기 전까지 고칠 수 있어요."}`;
  } else if (p.left.length === 0) {
    title = <>모든 항목을 썼어요<br />제출만 남았어요</>;
    lead = `회신 기한 ${md(rfq.replyBy)}까지 제출하면 이 요청의 비교표에 들어가요.`;
  } else {
    title = <>시험 {p.total}개 견적,<br /><span className="rs-mark">{p.left.length}개</span> 남았어요</>;
    lead = `${draft?.prefilled ? "카탈로그로 채운 초안이 있어요. 확인하고 저장해 주세요." : p.done ? "작성한 내용은 저장되어 있어요." : "항목마다 가능 여부와 금액·기간을 적어 주세요."} 회신 기한 ${md(rfq.replyBy)}까지 제출하면 이 요청의 비교표에 들어가요.`;
  }

  const steps: Step[] = [
    { n: "1", t: "요청이 도착했어요", s: `${field}${rfq.authorities.length ? ` · ${rfq.authorities.join(", ")} 제출용` : ""}`, state: "done" },
    { n: "2", t: summary ? (got.declined ? "불참했어요" : "요약을 보고 참여를 정해요") : got.withdrawn ? "참여했다가 철회했어요" : "참여했어요", s: summary ? (joinBy ? `참여 결정 기한 ${joinBy}` : "") : "요청서 전체가 열렸어요", state: summary && !ended ? "now" : "done" },
    { n: "3", t: submitted ? "회신을 다 썼어요" : summary ? "회신을 써요" : `회신 항목 ${p.total}개 중 ${p.done}개를 썼어요`, s: !summary && !submitted && p.left.length ? `남은 항목: ${p.left.slice(0, 3).join(", ")}${p.left.length > 3 ? ` 외 ${p.left.length - 3}개` : ""}` : "", state: submitted ? "done" : !summary && !ended ? "now" : "next" },
    { n: "4", t: submitted ? "견적을 제출했어요" : "회신 마감", s: `회신 기한 ${md(rfq.replyBy)}${got.closed ? "" : " · 지나면 이 요청에 회신할 수 없어요"}`, state: submitted ? "done" : "next" },
    { n: "5", t: "의뢰자가 비교표를 보고 기관을 골라요", s: got.closedReason === "selected" ? "의뢰자가 기관을 골랐어요. 결과는 알림으로 확인하세요" : "결과는 알림으로 알려요", state: got.closedReason === "selected" ? "done" : submitted && !got.closed ? "now" : "next" },
  ];
  // 제출한 뒤에는 "비교표 공개 기다림"이 지금 단계다. 닫힌 요청은 지금 단계가 없다
  if (ended) for (const s of steps) if (s.state === "now") s.state = "next";

  const canWrite = !summary && !ended;
  return (
    <>
      <section className="rs-scene" aria-labelledby="cro-story-title">
        <div className={canWrite || submitted ? "rs-hero" : "rs-hero rs-hero--solo"}>
          <div>
            <p className="rs-k"><span className="tnum">{rfq.no}</span> {summary ? field : rfq.substance} · {rfq.client}</p>
            <h1 id="cro-story-title" className="rs-h1">{title}</h1>
            <p className="rs-lead">{lead}</p>
            {canWrite && (
              <div className="rs-acts">
                <Link href={replyHref} className="b1 blg">{submitted ? (got.locked ? "제출한 회신 보기" : "제출한 회신 고치기") : draft ? "이어 쓰기" : "견적 쓰기"}</Link>
                <span className="rs-acts__note tnum">{rfq.ddayLabel}</span>
              </div>
            )}
          </div>
          {(canWrite || submitted) && p.total > 0 && (
            <Orbit rings={[{ key: "r", dots: rfq.rows.map((r) => (p.left.includes(r.name) ? "w" : "f")) }]} center={`${p.done}/${p.total}`} label={`회신 항목 ${p.total}개 중 ${p.done}개 작성`} />
          )}
        </div>
      </section>
      {children}
      <section className="rs-block" aria-labelledby="cro-path-title">
        <p className="rs-bk">어디까지 왔나요</p>
        <h2 id="cro-path-title" className="rs-h2">이 요청이 지나온 길</h2>
        <ol className="rs-steps">
          {steps.map((s) => (
            <li key={s.n} className={`rs-step rs-step--${s.state}`} aria-current={s.state === "now" ? "step" : undefined}>
              <span className="rs-step__n tnum">{s.n}</span>
              <span className="rs-step__t">
                <b>{s.t}</b>
                {s.s && <span>{s.s}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
