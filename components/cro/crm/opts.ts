/**
 * 기관 CRM 화면 공통 (서버 컴포넌트용). 경로는 디자인 검토 화면(/design-preview/cro-crm)이 바꿔 쓴다.
 */
import { personLabel, wonKo, type CrmCompany, type CrmContact, type CrmDeal, type CrmQuote, type Member } from "@/lib/crm-shape";
import type { CrmOpts } from "./forms";

export type CrmPaths = { today: string; deals: string; clients: string; reports: string; import: string; calendar: string; log: string; docs: string; newDoc: string; ics: string; exportXlsx: string };
export const CRM_PATHS: CrmPaths = {
  today: "/cro", deals: "/cro/deals", clients: "/cro/clients", reports: "/cro/reports", import: "/cro/import", calendar: "/cro/calendar", log: "/cro/log",
  docs: "/cro/docs", newDoc: "/cro/docs/new", ics: "/api/cro/crm/ics", exportXlsx: "/api/cro/crm/export",
};

/** 폼에 넘길 고를 거리 (이름만) */
export function buildOpts(a: { companies: CrmCompany[]; contacts: CrmContact[]; members: Member[]; quotes: CrmQuote[]; deals: CrmDeal[]; me: string }): CrmOpts {
  const co = [...a.companies].sort((x, y) => x.name.localeCompare(y.name, "ko"));
  const cname = new Map(a.companies.map((c) => [c.id, c.name]));
  return {
    companies: co.map((c) => ({ id: c.id, name: c.name })),
    contacts: a.contacts.map((c) => ({ id: c.id, name: personLabel(c.name, c.title), companyId: c.company_id })),
    members: a.members.map((m) => ({ id: m.id, name: m.name })),
    quotes: a.quotes.map((q) => ({ id: q.id, name: q.doc_no, sub: [q.title, q.supply ? wonKo(q.supply) : ""].filter(Boolean).join(" · "), companyId: q.company_id, dealId: q.deal_id })),
    deals: a.deals.filter((d) => d.status === "open").map((d) => ({ id: d.id, name: d.title, sub: d.company_id ? cname.get(d.company_id) ?? "" : d.rfq_no ? `단추 요청 ${d.rfq_no}` : "", companyId: d.company_id })),
    me: a.me,
  };
}

export const qs = (base: string, p: Record<string, string | null | undefined>) => {
  const s = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join("&");
  return s ? `${base}?${s}` : base;
};
