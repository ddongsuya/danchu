import type { ReactNode } from "react";
import { md } from "@/lib/format";

export type AdminFunnel = { reqs: number; sent: number; opened: number; joined: number; submitted: number; selected: number; per: { rfq_no: string; sent: number; joined: number; submitted: number }[] };

/**
 * 운영자 홈 맨 위 (시안 v7 a-intake): 제목 줄과 진행 중인 요청의 흐름 숫자 한 줄 (2026-10-29 "요청 7건 → 몇 기관에 전달 → 응답 몇 건").
 * 멈춘 요청 목록(StuckList)이 바로 아래로 이어진다.
 */
export function AdminHero({ f, stuck, today, actions }: { f: AdminFunnel; stuck: string[]; today: string; actions?: ReactNode }) {
  const sub = f.reqs === 0
    ? `${md(today)} · 진행 중인 요청이 없습니다`
    : `${md(today)} · 진행 중 ${f.reqs}건 · ${stuck.length ? `멈춘 요청 ${stuck.length}건` : "멈춘 요청 없음"}`;
  return (
    <>
      <div className="ph">
        <div>
          <h1>접수</h1>
          <p className="tnum">{sub}</p>
        </div>
        {actions && <div className="ph__actions">{actions}</div>}
      </div>
      {f.reqs > 0 && (
        <ol className="adm-flow" aria-label="진행 중인 요청 흐름">
          <li><b>{f.reqs}<small>건</small></b><span>요청</span></li>
          <li><b>{f.sent}<small>곳</small></b><span>전달</span></li>
          <li><b>{f.opened}<small>곳</small></b><span>요약 열람</span></li>
          <li><b>{f.joined}<small>곳</small></b><span>참여</span></li>
          <li><b>{f.submitted}<small>건</small></b><span>견적</span></li>
          <li><b>{f.selected}<small>건</small></b><span>기관 선택</span></li>
        </ol>
      )}
    </>
  );
}
