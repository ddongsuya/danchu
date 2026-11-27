import type { Funnel } from "@/lib/request-story";
import { md, nextDay } from "@/lib/format";
import "./compare.css";

/**
 * 비교 보고서가 열리기 전 (2026-11-27 시안 r-compare "열리기 전"). 공개 예정 시각과 숫자(보낸 곳 · 열람 · 참여 · 제출)만 보인다.
 * 기관 이름 · 금액 · 도착 순서는 열릴 때 함께 공개한다 (2026-10-20 결정 1)
 */
export function ComparePending({ replyBy, f, ended }: { replyBy: string | null; f: Funnel; ended: boolean }) {
  const openAt = replyBy ? `${md(nextDay(replyBy))} 오전 9시 공개 예정` : "회신 기한 다음 날 오전 9시 공개 예정";
  return (
    <div className="rs-report">
      <header className="rp-head cmp-head">
        <div>
          <h1 className="rp-h1">비교 견적 보고서</h1>
          <p className="rp-meta tnum">{ended ? "열리기 전에 마무리한 요청" : openAt}</p>
        </div>
      </header>
      {ended ? (
        <div className="empty">
          <b>보고서가 열리기 전에 마무리한 요청이에요</b>
          보고서가 열리지 않아 기관 이름과 견적은 공개되지 않아요.
        </div>
      ) : (
        <div className="cmp-pre">
          <h2 className="tnum">{openAt}</h2>
          <p>참여 {f.joined}곳 중 {f.submitted}곳이 견적을 냈어요. 참여한 곳이 모두 내면 더 빨리 열려요.</p>
        </div>
      )}
      <dl className="cmp-stats" aria-label="회신 현황">
        <div><dt>보낸 곳</dt><dd className="tnum">{f.sent}</dd></div>
        <div><dt>열람</dt><dd className="tnum">{f.opened}</dd></div>
        <div><dt>참여</dt><dd className="tnum">{f.joined}</dd></div>
        <div><dt>제출</dt><dd className="tnum">{f.submitted}</dd></div>
      </dl>
      <p className="cmp-msg">기관 이름과 금액은 비교표가 열릴 때 공개돼요.</p>
    </div>
  );
}
