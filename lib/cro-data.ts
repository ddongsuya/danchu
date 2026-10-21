/**
 * CRO 회신 화면 타입.
 * 데이터는 rfq_invites / cro_quotes 에서 읽는다 (lib/quote-load.ts).
 */
import type { QuoteLineDef } from "./quote-items";

export type RfqView = {
  /**
   * false: 참여 전 요약 (0023). 설계 규칙표 "참여 전에 보이는 것"만 채운다: 분야, 시험 항목(종·기간·GLP), 제출처, 요청 성격,
   * 의뢰자 기관 유형, 희망 착수, 회신 기한, 참여 결정 기한, 기밀 등급·CDA 필요 여부, 첨부 개수, 자리, 이용 조건 판.
   * 시험물질명(substance)·의뢰자 설명(situation·ask·common)·첨부 목록(files)은 비어 있다. true: 참여 뒤 요청서 전체
   */
  full: boolean;
  no: string;
  /** 참여 전 요약에서는 빈 문자열 */
  substance: string;
  /** 요청 시험 분야 (대분류) */
  categories: string[];
  client: string;
  /** CDA 요청의 첨부·상세가 체결 확인 전이라 비공개 */
  masked: boolean;
  /** 회사명·연락처 비공개 (선정 전). 모든 요청에 적용 */
  identityMasked: boolean;
  ddayLabel: string;
  urgent: boolean;
  confid: string;
  overview: [string, string][];
  rows: QuoteLineDef[];
  common: [string, string][];
  /** 의뢰자가 제안 받기에서 답한 상황 */
  situation: string[];
  /** 기관마다 달라 회신에서 설명을 요청하는 항목 */
  ask: string[];
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
