import Link from "next/link";
import type { ReactNode } from "react";
import type { Stuck } from "@/lib/stuck";
import { md } from "@/lib/format";
import { Crumb } from "@/components/app/ui";
import { AdminTabs } from "./Blocks";

export type RequestTab = "" | "dist" | "cda" | "contract" | "hist";

const TABS: [RequestTab, string][] = [["", "회신 현황"], ["dist", "참여 안내"], ["cda", "CDA"], ["contract", "계약"], ["hist", "이력"]];

export const requestTabOf = (v: string | undefined): RequestTab => (TABS.some(([k]) => k === v) ? (v as RequestTab) : "");

/**
 * 운영자 요청 상세의 틀 (시안 v7 a-r). 제목 줄(번호 · 시험물질 · 의뢰자), 상태 태그, 멈춘 이유 띠, 밑줄 탭.
 * 예전에는 패널 10개가 한 화면에 세로로 쌓였다. 탭은 ?tab= 이고 내용은 children.
 */
export function RequestFrame({ no, substance, company, createdAt, tags, stuck, tab, showCda, base = `/admin/r/${no}`, children }: {
  no: string; substance: string; company: string; createdAt: string; tags: ReactNode; stuck: Stuck[]; tab: RequestTab; showCda: boolean; base?: string; children: ReactNode;
}) {
  const tabHref = (k: RequestTab) => (k ? `${base}${base.includes("?") ? "&" : "?"}tab=${k}` : base);
  return (
    <>
      <Crumb href="/admin" label="접수" />
      <div className="ph">
        <div>
          <h1 className="tnum">{no}</h1>
          <p>{substance} · {company} · <span className="tnum">{md(createdAt)}</span> 접수</p>
        </div>
        <div className="ph__actions">
          <Link href={`/app/r/${no}`} className="b2 bsm">의뢰자 화면으로 보기</Link>
          <Link href={`/admin/r/${no}/qna`} className="b2 bsm">질의응답 기록</Link>
        </div>
      </div>
      <div className="adm-tags">{tags}</div>
      {stuck.length > 0 && (
        <div className="note note--warn adm-note" role="status">
          <b>멈춘 이유: {stuck.map((s) => s.label).join(", ")}</b>
          <span>할 일: {stuck[0].action}</span>
        </div>
      )}
      <AdminTabs label="요청 상세" items={TABS.filter(([k]) => k !== "cda" || showCda).map(([k, label]) => ({ href: tabHref(k), label, on: tab === k }))} />
      {children}
    </>
  );
}
