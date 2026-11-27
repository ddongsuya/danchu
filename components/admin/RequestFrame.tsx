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
 * 운영자 요청 상세의 틀 (시안 검토판 a-r). 제목 줄(번호 / 시험 · 의뢰자 · 접수일, 오른쪽 "의뢰자 화면으로 보기"와 회신 기한 변경), 상태 태그, 멈춘 이유 띠, 밑줄 탭.
 * 탭은 ?tab= 이고 내용은 children. CDA 탭은 CDA 등급 요청에만 있다.
 */
export function RequestFrame({ no, substance, company, createdAt, tags, stuck, tab, showCda, actions, base = `/admin/r/${no}`, children }: {
  no: string; substance: string; company: string; createdAt: string; tags: ReactNode; stuck: Stuck[]; tab: RequestTab; showCda: boolean; actions?: ReactNode; base?: string; children: ReactNode;
}) {
  const tabHref = (k: RequestTab) => (k ? `${base}${base.includes("?") ? "&" : "?"}tab=${k}` : base);
  return (
    <>
      <Crumb href="/admin" label="접수" />
      <div className="ph">
        <div>
          <h1 className="tnum">{no} <span className="adm-muted" style={{ fontWeight: 500 }}>/ {substance}</span></h1>
          <p>{company} · <span className="tnum">{md(createdAt)}</span> 접수</p>
        </div>
        <div className="ph__actions">
          <Link href={`/app/r/${no}`} className="b2 bsm">의뢰자 화면으로 보기</Link>
          {actions}
        </div>
      </div>
      {tags && <div className="adm-tags">{tags}</div>}
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
