import type { ReactNode } from "react";
import "./layout-request.css";

/** 2차 상세 견적 요청을 받은 기관에 보이는 안내 (0042) */
export type DetailCue = { open: boolean; status: "sent" | "submitted" | "kept" | "declined"; replyBy: string; href: string };

/** 질의응답 바로가기 (0045). 참여한 기관만 */
export type QnaCue = { href: string; total: number; pending: number };

/** 요청 화면 위 띠 한 줄 (시안 검토판 ban). tone: bad 는 실패·만료, end 는 끝난 요청 */
export function Ban({ children, tone, action }: { children: ReactNode; tone?: "bad" | "end"; action?: ReactNode }) {
  return (
    <div className={`lr-ban${tone === "end" ? " lr-ban--end" : tone === "bad" ? " lr-ban--bad" : ""}`} role={tone === "bad" ? "alert" : "status"}>
      <p className="lr-ban__t"><span>{children}</span></p>
      {action}
    </div>
  );
}

/** 시험 이름 한 줄: 두 개까지, 넘으면 "외 n" */
export function testsLine(names: string[]): string {
  const u = [...new Set(names)];
  return u.length > 2 ? `${u[0]} 외 ${u.length - 1}` : u.join(" · ");
}

/**
 * 기관이 보는 요청 화면의 틀 (시안 검토판 c-r · c-join · q-view, 2026-11-27). 포털(/cro/r)과 토큰 링크(/q)가 함께 쓴다.
 * 제목 줄(요청 번호 / 시험 · 의뢰자 한 줄 · 오른쪽 행동) → 띠(bans) → 본문(main) + 오른쪽 칸(side). 좁으면 한 열.
 */
export function CroStory({ no, tail, sub, actions, bans, main, side }: { no: string; tail: string; sub: string; actions?: ReactNode; bans?: ReactNode; main: ReactNode; side?: ReactNode }) {
  return (
    <div className="lr">
      <header className="lr-head">
        <div className="lr-head__main">
          <h1><span className="tnum">{no}</span>{tail && <span className="lr-tail"> / {tail}</span>}</h1>
          {sub && <p className="lr-sub">{sub}</p>}
        </div>
        {actions && <div className="lr-head__side">{actions}</div>}
      </header>
      {bans}
      <div className="lr-split">
        <div className="lr-main">{main}</div>
        {side && <aside className="lr-side" aria-label="참여와 기한">{side}</aside>}
      </div>
    </div>
  );
}
