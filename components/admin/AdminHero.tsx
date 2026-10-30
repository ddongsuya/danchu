import Link from "next/link";
import { Orbit } from "@/components/app/Orbit";
import { dotsOf } from "@/lib/request-story";
import { md } from "@/lib/format";

export type AdminFunnel = { reqs: number; sent: number; opened: number; joined: number; submitted: number; selected: number; per: { rfq_no: string; sent: number; joined: number; submitted: number }[] };

/**
 * 운영자 홈 첫 장면 (2026-10-29 대표 지시 "요청 7건 → 몇 기관에 전달 → 응답 몇 건").
 * 진행 중인 요청 전체의 흐름 숫자와, 멈춘 요청을 빨간 고리로 먼저 보여 준다. 아래는 멈춘 요청 목록(StuckList)으로 이어진다.
 */
export function AdminHero({ f, stuck, today }: { f: AdminFunnel; stuck: string[]; today: string }) {
  // 멈춘 요청을 먼저, 나머지는 최근 순. 고리는 5개까지
  const order = [...f.per].sort((a, b) => Number(stuck.includes(b.rfq_no)) - Number(stuck.includes(a.rfq_no)));
  const rings = order.slice(0, 5).map((r) => ({ key: r.rfq_no, dots: dotsOf(r, 16), late: stuck.includes(r.rfq_no), tag: r.rfq_no.slice(-4) }));
  return (
    <section className="rs-scene" aria-labelledby="adm-home-title">
      <div className={f.sent ? "rs-hero" : "rs-hero rs-hero--solo"}>
        <div>
          <p className="rs-k">{md(today)} · 단추 운영</p>
          <h1 id="adm-home-title" className="rs-h1">
            {f.reqs === 0 ? <>진행 중인<br />요청이 없어요</> : f.sent === 0 ? <>요청 {f.reqs}건이<br />안내를 기다려요</> : <>요청 {f.reqs}건이<br />기관 <span className="rs-mark">{f.sent}곳</span>에<br />전달됐어요</>}
          </h1>
          <p className="rs-lead">
            {f.reqs === 0
              ? "새 요청이 들어오면 여기에 흐름이 채워져요."
              : `${f.opened}곳이 요약을 열었고, ${f.joined}곳이 참여해 견적 ${f.submitted}건이 도착했어요.${stuck.length ? ` 사람 손이 필요한 요청이 ${stuck.length}건 있어요.` : " 멈춘 요청은 없어요."}`}
          </p>
          <div className="rs-acts">
            {stuck.length > 0 && <Link href="#stuck-h" className="b1 blg">멈춘 요청 보기</Link>}
            <Link href="#all-requests" className={stuck.length ? "b2 blg" : "b1 blg"}>전체 요청</Link>
          </div>
        </div>
        {f.sent > 0 && <Orbit rings={rings} label={`진행 중인 요청 일부. 고리 하나가 요청 하나, 점 하나가 기관 하나예요. 빨간 고리는 사람 손이 필요한 요청이에요.`} />}
      </div>
      {f.reqs > 0 && (
        <ol className="rs-flow rs-flow--6" aria-label="진행 중인 요청 흐름">
          <li><b className="tnum">{f.reqs}<small>건</small></b><span>요청</span></li>
          <li><b className="tnum">{f.sent}<small>곳</small></b><span>전달</span></li>
          <li><b className="tnum">{f.opened}<small>곳</small></b><span>요약 열람</span></li>
          <li><b className="tnum">{f.joined}<small>곳</small></b><span>참여</span></li>
          <li><b className="tnum">{f.submitted}<small>건</small></b><span>견적</span></li>
          <li><b className="tnum">{f.selected}<small>건</small></b><span>기관 선택</span></li>
        </ol>
      )}
    </section>
  );
}
