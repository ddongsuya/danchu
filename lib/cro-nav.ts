import type { NavItem } from "@/components/shell/Shell";
import { PLANS, inPilotPeriod, planOn, type PlanId, type PlanFeature } from "./plans";

/** 기관 메뉴 경로. 검토 화면은 다른 경로를 넘긴다 */
export type CroPaths = Record<"today" | "deals" | "clients" | "reports" | "log" | "requests" | "docs" | "prices" | "catalog" | "calendar" | "notifications" | "org" | "billing" | "more", string>;
export const CRO_PATHS: CroPaths = {
  today: "/cro", deals: "/cro/deals", clients: "/cro/clients", reports: "/cro/reports", log: "/cro/log", requests: "/cro/requests", docs: "/cro/docs", prices: "/cro/prices",
  catalog: "/cro/catalog", calendar: "/cro/calendar", notifications: "/cro/notifications", org: "/cro/org", billing: "/cro/billing", more: "/cro/more",
};

/** 화면 구성에 쓰는 등급. 시범 운영 중에는 모두 Pro 구성 */
export type CroTier = PlanId;
export function croTier(org: { plan?: string | null; plan_next?: string | null; plan_next_from?: string | null } | null | undefined, today: string): CroTier {
  return inPilotPeriod(today) ? "pro" : planOn(org, today);
}

/**
 * 등급별 메뉴 (2026-11-13). 요금제에 없는 메뉴는 감춘다. 무엇이 더 생기는지는 요금제·결제 화면에서만 보인다.
 * - 무료: 받은 요청, 알림 / 기관, 요금제·결제. 첫 화면 받은 요청
 * - Plus: 위 + 시험 목록, 캘린더
 * - Pro: 위 + 오늘, 안건, 고객사, 보고서(+기록), 견적서. 첫 화면 오늘
 */
export function croNav(tier: CroTier, unread: number, p: CroPaths = CRO_PATHS): { nav: NavItem[]; tabs: NavItem[]; home: string } {
  const has = (f: PlanFeature) => PLANS[tier].features.includes(f);
  const nav: NavItem[] = [];
  // 2026-11-26 시안 v7: Pro는 업무 / CRM / 견적 / 설정 네 묶음. 알림은 넓은 화면에서 위 바의 종으로 간다
  if (has("crm")) {
    nav.push(
      { href: p.today, label: "오늘", icon: "today", exact: true, group: "업무" },
      { href: p.requests, label: "받은 요청", icon: "inbox", group: "업무" },
      { href: p.deals, label: "안건", icon: "deals", group: "CRM" },
      { href: p.clients, label: "고객사", icon: "clients", group: "CRM" },
      { href: p.log, label: "활동", icon: "note", group: "CRM" },
    );
    if (has("tests")) nav.push({ href: p.calendar, label: "캘린더", icon: "calendar", group: "CRM" });
    nav.push({ href: p.reports, label: "분석", icon: "report", group: "CRM" });
    if (has("quote_tool")) nav.push({ href: p.docs, label: "견적서", icon: "quote", group: "견적" }, { href: p.prices, label: "단가표", icon: "tag", group: "견적" });
    if (has("tests")) nav.push({ href: p.catalog, label: "시험 목록", icon: "list", group: "견적" });
  } else {
    nav.push({ href: p.requests, label: "받은 요청", icon: "inbox" });
    if (has("quote_tool")) nav.push({ href: p.docs, label: "견적서", icon: "quote" }, { href: p.prices, label: "단가표", icon: "tag" });
    if (has("tests")) nav.push({ href: p.catalog, label: "시험 목록", icon: "list" }, { href: p.calendar, label: "캘린더", icon: "calendar" });
  }
  nav.push({ href: p.notifications, label: "알림", icon: "bell", badge: unread });
  nav.push({ href: p.org, label: "기관", icon: "org", group: "설정" }, { href: p.billing, label: "요금제·결제", icon: "receipt", group: "설정" });

  const tabs: NavItem[] = has("crm")
    ? [
        { href: p.today, label: "오늘", icon: "today", exact: true },
        { href: p.deals, label: "안건", icon: "deals" },
        { href: p.log, label: "활동", icon: "note" },
        { href: p.more, label: "더보기", icon: "more", badge: unread },
      ]
    : [
        { href: p.requests, label: "받은 요청", icon: "inbox" },
        ...(has("tests") ? [{ href: p.catalog, label: "시험 목록", icon: "list" as const }] : []),
        { href: p.notifications, label: "알림", icon: "bell", badge: unread },
        { href: p.more, label: "더보기", icon: "more" },
      ];
  return { nav, tabs, home: has("crm") ? p.today : p.requests };
}
