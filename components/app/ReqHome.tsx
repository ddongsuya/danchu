import Link from "next/link";
import { ArrowUp } from "@phosphor-icons/react/dist/ssr";
import type { HomeCheck } from "@/lib/home-checks";
import "./home.css";

const CHIPS: [string, string][] = [
  ["독성", "/app/new?start=manual&kind=tox"],
  ["효력", "/app/new?start=manual&kind=pd"],
  ["약동학", "/app/new?start=manual&kind=pk"],
  ["개별 분석", "/app/new?start=manual&kind=other"],
];

/**
 * 의뢰자 홈 (2026-11-27 시안 검토판 r-home): 입력창과 네 갈래 칩, 그 아래 "확인 필요" 묶음. 요청 목록은 사이드바에 있다.
 * 입력창은 독성 요청서를 시험물질 이름을 채운 채로 연다 (?substance=). 첫 요청 전에는 필요한 시험 찾아보기와 자료실만 둔다.
 */
export function ReqHome({ checks, first }: { checks: HomeCheck[]; first: boolean }) {
  return (
    <div className="rh">
      <h1 className="rh__h">어떤 시험의 견적이 필요하세요?</h1>
      <form className="rh-comp" action="/app/new" method="get" role="search" aria-label="새 견적 요청">
        <input type="hidden" name="start" value="manual" />
        <input type="hidden" name="kind" value="tox" />
        <label className="sr-only" htmlFor="rh-q">시험 이름 또는 시험물질</label>
        <input id="rh-q" className="rh-comp__in" name="substance" maxLength={100} autoComplete="off" placeholder="시험 이름 또는 시험물질 입력" />
        <div className="rh-comp__row">
          <div className="rh-chips" role="group" aria-label="시험 갈래">
            {CHIPS.map(([label, href]) => <Link key={label} href={href} className="rh-chip">{label}</Link>)}
          </div>
          <button type="submit" className="rh-send" aria-label="새 견적 요청"><ArrowUp size={18} weight="bold" /></button>
        </div>
      </form>
      {first && (
        <div className="rh-acts">
          <Link href="/app/new?start=advisor" className="b2 bsm">필요한 시험 찾아보기</Link>
          <Link href="/guide/library" className="b2 bsm">가이드라인 자료실</Link>
        </div>
      )}
      {checks.length > 0 && (
        <section className="rh-sec" aria-labelledby="rh-check">
          <h2 id="rh-check" className="rh-sec__h">확인 필요 <span className="tnum">{checks.length}</span></h2>
          <ul className="rh-list">
            {checks.map((c) => (
              <li key={c.no} className="rh-row">
                <div className="rh-row__t">
                  <Link href={`/app/r/${c.no}`} className="rh-row__no tnum">{c.title}</Link>
                  <span className="tnum">{c.line}</span>
                </div>
                <span className={`pill ${c.tone === "late" ? "pill--err" : "pill--warn"}`}>{c.pill}</span>
                <Link href={c.href} className={c.tone === "wait" ? "b1 bsm" : "b2 bsm"}>{c.action}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
