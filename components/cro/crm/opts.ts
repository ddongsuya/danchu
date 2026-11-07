/**
 * 기관 CRM 화면 공통 (서버 컴포넌트용). 경로는 디자인 검토 화면(/design-preview/cro-crm)이 바꿔 쓴다.
 */
import { personLabel, quoteStage, wonKo, type CrmCompany, type CrmContact, type CrmQuote, type Member } from "@/lib/crm-shape";
import type { CrmOpts } from "./forms";

export type CrmPaths = { clients: string; calendar: string; pipe: string; docs: string; newDoc: string; ics: string };
export const CRM_PATHS: CrmPaths = { clients: "/cro/clients", calendar: "/cro/calendar", pipe: "/cro", docs: "/cro/docs", newDoc: "/cro/docs/new", ics: "/api/cro/crm/ics" };

/** 폼에 넘길 고를 거리 (이름만) */
export function buildOpts(a: { companies: CrmCompany[]; contacts: CrmContact[]; members: Member[]; quotes: CrmQuote[]; me: string }): CrmOpts {
  const co = [...a.companies].sort((x, y) => x.name.localeCompare(y.name, "ko"));
  return {
    companies: co.map((c) => ({ id: c.id, name: c.name })),
    contacts: a.contacts.map((c) => ({ id: c.id, name: personLabel(c.name, c.title), companyId: c.company_id })),
    members: a.members.map((m) => ({ id: m.id, name: m.name })),
    quotes: a.quotes.filter((q) => quoteStage(q) !== "lost").map((q) => ({ id: q.id, name: q.doc_no, sub: [q.title, q.supply ? wonKo(q.supply) : ""].filter(Boolean).join(" · "), companyId: q.company_id })),
    me: a.me,
  };
}

export const qs = (base: string, p: Record<string, string | null | undefined>) => {
  const s = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join("&");
  return s ? `${base}?${s}` : base;
};
