"use client";

/**
 * 기록 남기기 (시안 v5 휴대폰 3번). 통화·미팅이 끝나고 바로 한 화면에서: 안건 고르기 → 종류 → 내용 → 다음 할 일 날짜 → 저장.
 * 방금 끝난 일정의 안건이 먼저 골라져 있다. 저장하면 그 안건 화면으로 간다.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "@phosphor-icons/react";
import { Composer } from "./deal-ui";
import type { Opt } from "./forms";

export type LogDeal = { id: string; title: string; who: string; stage: string; companyId: string | null; contacts: Opt[] };

export function LogView({ deals, start, members, me, back, base }: { deals: LogDeal[]; start: string | null; members: Opt[]; me: string; back: string; base: string }) {
  const router = useRouter();
  const [id, setId] = useState(start ?? deals[0]?.id ?? "");
  const d = deals.find((x) => x.id === id) ?? null;
  return (
    <div className="cx cx-log">
      <header className="cx-log__top">
        <Link href={back} className="cx-log__x"><X size={18} aria-hidden="true" />닫기</Link>
        <h1>기록 남기기</h1>
        <span aria-hidden="true" />
      </header>
      {deals.length ? (
        <>
          <label className="cx-pick">
            <span className="cx-av" aria-hidden="true">{(d?.who || d?.title || "안").slice(0, 1)}</span>
            <span className="cx-pick__x"><b>{d ? d.who || d.title : "안건 고르기"}</b><small>{d ? `${d.title} · ${d.stage}` : "기록을 붙일 안건"}</small></span>
            <span className="sr-only">안건</span>
            <select value={id} onChange={(e) => setId(e.target.value)}>
              {deals.map((x) => <option key={x.id} value={x.id}>{[x.who, x.title].filter(Boolean).join(" · ")}</option>)}
            </select>
          </label>
          <Composer key={id} dealId={id} companyId={d?.companyId ?? null} contacts={d?.contacts ?? []} members={members} me={me} compact startTab="call" onDone={() => router.push(`${base}/${id}`)} />
        </>
      ) : (
        <p className="cx-none">진행 중인 안건이 없어요. 안건을 먼저 만들면 통화와 미팅을 붙여 남길 수 있어요.</p>
      )}
    </div>
  );
}
