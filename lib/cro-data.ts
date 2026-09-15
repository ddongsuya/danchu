/**
 * CRO 회신 화면 타입.
 * 데이터는 rfq_invites / cro_quotes 에서 읽는다 (lib/quote-load.ts).
 */
import type { QuoteRow } from "./quote-items";

export type RfqView = {
  no: string;
  substance: string;
  client: string;
  masked: boolean;
  ddayLabel: string;
  urgent: boolean;
  confid: string;
  overview: [string, string][];
  rows: QuoteRow[];
  common: [string, string][];
  attachments: string;
  replyBy: string;
  authorities: string[];
  /** 첨부 파일 (CDA 마스킹이 아닐 때만 채움) */
  files: { id: string; name: string; size: number }[];
};

export type ReplyItem = {
  seq: number;
  avail: "" | "가능" | "조건부 가능" | "불가";
  amount: string;
  weeks: string;
  reason?: string;
  /** 설계 요약 (카탈로그에서 채우거나 CRO가 수정) */
  design?: Record<string, unknown>;
  /** 초안 출처 */
  source?: "catalog" | "learned" | "manual";
  /** 요청 조건이 표준 설계와 달라 확인이 필요한 칸 */
  checks?: string[];
  unit?: "total" | "per_sample";
  unitPrice?: string;
  sampleCount?: string;
};

/** 회신 공통 조건 (§5) — 항목 3칸 외에 CRO가 채우는 것 */
export type ReplyCommon = {
  validUntil: string;   // 견적 유효기간 (YYYY-MM-DD)
  startDate: string;    // 전체 착수 가능일
  payTerms: string;     // 결제 조건 "30 · 40 · 30"
  substanceQty: string; // 시험물질 필요량
  reportLang: string;   // 보고서 언어
  includes: string[];   // 기본 포함 항목
};

export const INCL_KEYS = ["임상병리", "조직병리(검경 포함)", "TK 분석", "조제물분석", "통계분석", "QA 점검", "영문 보고서", "시험물질 보관"];
export const REPORT_LANGS = ["국문", "영문", "국문 + 영문 번역", "일문"];

export const EMPTY_COMMON: ReplyCommon = { validUntil: "", startDate: "", payTerms: "", substanceQty: "", reportLang: "", includes: [] };

export type ReplyDraft = { items: ReplyItem[]; note: string; pdfName: string; status: "draft" | "submitted"; common: ReplyCommon; /** 저장된 회신이 없어 카탈로그로 만든 초안 */ prefilled?: boolean };
