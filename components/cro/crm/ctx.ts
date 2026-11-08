/**
 * CRM 화면이 함께 받는 묶음 (서버 컴포넌트용). 실제 화면은 loadCrmSynced, 디자인 검토 화면은 예시 데이터로 만든다.
 */
import type { CrmData } from "@/lib/crm";
import { dealRows, type DanchuSrc, type DealRow } from "@/lib/crm-deals";
import type { CrmPaths } from "./opts";

export type CrmCtx = {
  data: CrmData;
  /** 초대 id → 단추 요청 (기관 자신의 것만) */
  danchu: Map<string, DanchuSrc>;
  me: string;
  paths: CrmPaths;
  now: number;
  /** 미리보기: 저장 버튼이 막힌다는 안내를 붙인다 */
  preview?: boolean;
};

export function rowsOf(c: CrmCtx): DealRow[] {
  return dealRows({ deals: c.data.deals, companies: c.data.companies, contacts: c.data.contacts, tasks: c.data.tasks, events: c.data.events, quotes: c.data.quotes, danchu: c.danchu, me: c.me, now: c.now, base: c.paths.deals });
}

