import Link from "next/link";
import { Orbit } from "@/components/app/Orbit";
import { InviteList, type InviteItem } from "@/components/cro/InviteList";
import { actionLabel, croTodo, croTotals, needsAction, type PendingAward } from "@/lib/cro-story";
import { dday, md } from "@/lib/format";

/**
 * 기관 홈 (2026-10-29 대표 지시, 의뢰자 홈과 같은 틀). 첫 장면은 "진행 중인 요청 n건" 한 문장과 궤도 그림,
 * 흐름 숫자(받은 요청 → 참여 → 제출 → 선정), 지금 할 일 하나, 그 아래 요청마다 내 차례인지.
 */
export function CroHome({ orgName, items, awards, now }: { orgName: string; items: InviteItem[]; awards: PendingAward[]; now: number }) {
  const t = croTotals(items, now);
  const todo = croTodo(items, awards, now);
  const soon = items.filter((i) => needsAction(i, now) && dday(i.replyBy).n <= 2);
  const n = t.active.length;
  const rings = t.active.slice(0, 5).map((i) => ({ key: i.id, dots: [i.stage === "submitted" ? "f" : i.stage === "undecided" ? "w" : "h"] as ("f" | "h" | "w")[], tag: i.no.slice(-4) }));
  const lead = [
    soon.length ? `회신 마감이 ${Math.max(0, Math.min(...soon.map((i) => dday(i.replyBy).n)))}일 안으로 남은 요청이 ${soon.length}건 있어요.` : "",
    t.undecided ? `참여 결정을 기다리는 요청이 ${t.undecided}건이에요.` : "",
    awards.length ? `선정된 요청 ${awards.length}건은 계약 결과 보고를 기다리고 있어요.` : "",
  ].filter(Boolean).join(" ") || (items.length ? "지금 회신할 요청은 없어요. 새 요청이 오면 알림으로 알려요." : "분야가 맞는 요청이 들어오면 참여 안내를 이메일과 알림으로 보내요.");
  const todoHref = todo?.kind === "invite" ? `/cro/r/${todo.item.id}` : "/cro/awards";
  const todoLabel = todo?.kind === "invite" ? actionLabel(todo.item) : todo ? "계약 결과 보고" : "";

  return (
    <div className="rs-home">
      <section className="rs-scene" aria-labelledby="cro-home-title">
        <div className={n ? "rs-hero" : "rs-hero rs-hero--solo"}>
          <div>
            <p className="rs-k">{orgName}, 받은 요청 {t.received}건</p>
            <h1 id="cro-home-title" className="rs-h1">
              {n ? <>진행 중인 요청<br /><span className="rs-mark">{n}건</span>이에요</> : <>지금 진행 중인<br />요청은 없어요</>}
            </h1>
            <p className="rs-lead">{lead}</p>
            <div className="rs-acts">
              {todo && <Link href={todoHref} className="b1 blg">{todoLabel}</Link>}
              <Link href="/cro/catalog" className={todo ? "b2 blg" : "b1 blg"}>카탈로그 보기</Link>
            </div>
          </div>
          {n > 0 && <Orbit rings={rings} label={`진행 중인 요청 ${n}건. 고리 하나가 요청 하나예요. 채운 점은 제출, 반 채운 점은 참여·작성 중, 빈 점은 참여 결정 전이에요.`} />}
        </div>
        {items.length > 0 && (
          <ol className="rs-flow" aria-label="회신 흐름">
            <li><b className="tnum">{t.received}<small>건</small></b><span>받은 요청</span></li>
            <li><b className="tnum">{t.joined}<small>건</small></b><span>참여한 요청</span></li>
            <li><b className="tnum">{t.submitted}<small>건</small></b><span>제출한 견적</span></li>
            <li><b className="tnum">{t.awarded}<small>건</small></b><span>선정</span></li>
          </ol>
        )}
      </section>

      {todo && (
        <section className="rs-block rs-block--tight" aria-labelledby="cro-todo-title">
          <h2 id="cro-todo-title" className="rs-bk">지금 할 일</h2>
          <Link href={todoHref} className="rs-todo">
            {todo.kind === "invite" ? (
              <span>
                <b>{todo.item.no} {todo.item.stage === "undecided" ? "참여 여부를 정해 주세요" : "회신을 마무리해 주세요"}</b>
                <span>회신 기한 {md(todo.item.replyBy)} · {dday(todo.item.replyBy).label}</span>
              </span>
            ) : (
              <span>
                <b>{todo.award.no} 계약 결과를 보고해 주세요</b>
                <span>선정된 지 {todo.award.days}일이에요. 계약했거나 진행하지 않기로 했다면 알려 주세요</span>
              </span>
            )}
            <span className="rs-todo__go">{todo.kind === "invite" ? actionLabel(todo.item) : "결과 보고"}</span>
          </Link>
        </section>
      )}

      <section className="rs-block" aria-labelledby="cro-list-title">
        <p className="rs-bk">받은 요청 {items.length}건</p>
        <h2 id="cro-list-title" className="rs-h2">요청마다 내 차례인지</h2>
        <InviteList items={items} />
      </section>
    </div>
  );
}
