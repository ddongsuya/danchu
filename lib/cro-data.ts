/**
 * CRO 화면용 데모 데이터.
 * 실제 서비스는 rfq_invites / cro_quotes 에서 읽는다. 토큰이 "demo-" 로 시작하면 이 데이터를 돌려준다.
 * 기관명·담당자는 예시이며 실제 계정 정보로 대체된다.
 */
import type { QuoteRow } from "./quote-items";

export const CRO_ME = { name: "켐온", user: "이지훈", title: "책임", glp: ["식약처(KGLP)", "OECD GLP", "US FDA GLP"], aaalac: true };

export type InboxItem = {
  token: string;
  no: string;
  title: string;
  client: string;
  purpose: string;
  tags: string[];
  dday: string;
  urgent: boolean;
  state: string;
  tone: "brand" | "err" | "ok";
  action: string;
  filter: "신규" | "작성 중" | "제출";
};

export const INBOX: InboxItem[] = [
  { token: "demo-9", no: "DC-2026-0009", title: "NV-308", client: "제약사 B사 (마스킹)", purpose: "허가자료 제출용 · US FDA", tags: ["일반독성", "안전성약리", "5곳 요청"], dday: "회신 D-6", urgent: true, state: "신규", tone: "brand", action: "요청서 보기", filter: "신규" },
  { token: "demo-10", no: "DC-2026-0010", title: "GL-2", client: "화장품 C사", purpose: "자체 연구용", tags: ["동물대체시험", "3곳 요청"], dday: "회신 D-8", urgent: false, state: "신규", tone: "brand", action: "요청서 보기", filter: "신규" },
  { token: "demo-8", no: "DC-2026-0008", title: "AB-14", client: "(주)바이오벤처", purpose: "허가자료 제출용 · 식약처", tags: ["안전성약리", "5곳 요청"], dday: "회신 D-2", urgent: true, state: "작성 중 · 2/3 항목", tone: "err", action: "이어서 작성", filter: "작성 중" },
  { token: "demo-7", no: "DC-2026-0007", title: "DC-101", client: "(주)바이오벤처", purpose: "허가자료 제출용 · 식약처 · US FDA", tags: ["일반독성", "유전독성"], dday: "제출 완료", urgent: false, state: "제출 · 1억 8,700만 원", tone: "ok", action: "수정 (D-9)", filter: "제출" },
];

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
};

const DEMO_RFQ: Record<string, RfqView> = {
  "demo-9": {
    no: "DC-2026-0009", substance: "NV-308", client: "제약사 B사", masked: true, ddayLabel: "회신 D-6", urgent: true,
    confid: "CDA 필요 (단추 표준 CDA)", replyBy: "2026-09-13", authorities: ["식약처(MFDS)", "US FDA"],
    overview: [["의뢰 목적", "허가자료 제출용"], ["개발 분야", "의약품(합성)"], ["제출처", "식약처(MFDS) · US FDA"], ["기밀 등급", "CDA 필요 (단추 표준)"], ["희망 착수", "1~3개월"], ["회신 기한", "2026-09-13 (D-6)"], ["CRO 수", "5곳"]],
    rows: [
      { seq: 1, category: "일반독성", name: "반복투여독성 4주", cond: "랫드 · 회복 2주 · TK 병행 · 조제물분석 포함 · GLP" },
      { seq: 2, category: "유전독성", name: "복귀돌연변이 Ames", cond: "TG 471 · GLP" },
      { seq: 3, category: "유전독성", name: "염색체이상 in vitro", cond: "TG 473 · GLP" },
      { seq: 4, category: "안전성약리", name: "hERG (in vitro)", cond: "GLP" },
    ],
    common: [["시험 투여경로", "경구(PO)"], ["임상 예정 투여기간", "1개월 이내"], ["함량분석법", "HPLC 보유 · 표준품 제공 가능"], ["적용 GLP", "식약처(KGLP) · US FDA GLP"], ["보고서 언어", "국문 + 영문 번역"], ["SEND", "필요 (IND)"]],
    attachments: "COA 1건 · CDA 체결 후 열람",
  },
  "demo-10": {
    no: "DC-2026-0010", substance: "GL-2", client: "화장품 C사", masked: false, ddayLabel: "회신 D-8", urgent: false,
    confid: "일반", replyBy: "2026-09-15", authorities: [],
    overview: [["의뢰 목적", "자체 연구용"], ["개발 분야", "화장품"], ["제출처", "—"], ["기밀 등급", "일반"], ["희망 착수", "1개월 이내"], ["회신 기한", "2026-09-15 (D-8)"], ["CRO 수", "3곳"]],
    rows: [
      { seq: 1, category: "동물대체시험", name: "피부자극 (TG 439)", cond: "Non-GLP" },
      { seq: 2, category: "동물대체시험", name: "안자극 (TG 492)", cond: "Non-GLP" },
    ],
    common: [["시험 투여경로", "경피"], ["보고서 언어", "국문"]],
    attachments: "없음",
  },
  "demo-8": {
    no: "DC-2026-0008", substance: "AB-14", client: "(주)바이오벤처", masked: false, ddayLabel: "회신 D-2", urgent: true,
    confid: "CDA 필요 (단추 표준 CDA)", replyBy: "2026-09-09", authorities: ["식약처(MFDS)"],
    overview: [["의뢰 목적", "허가자료 제출용"], ["개발 분야", "의약품(바이오·생물학적제제)"], ["제출처", "식약처(MFDS)"], ["기밀 등급", "CDA 필요 (단추 표준)"], ["희망 착수", "3~6개월"], ["회신 기한", "2026-09-09 (D-2)"], ["CRO 수", "5곳"]],
    rows: [
      { seq: 1, category: "안전성약리", name: "hERG (in vitro)", cond: "GLP" },
      { seq: 2, category: "안전성약리", name: "중추신경계 (FOB)", cond: "랫드 · GLP" },
      { seq: 3, category: "안전성약리", name: "심혈관계 (텔레메트리)", cond: "개(비글) · GLP" },
    ],
    common: [["시험 투여경로", "정맥(IV)"], ["적용 GLP", "식약처(KGLP)"], ["보고서 언어", "국문"]],
    attachments: "없음",
  },
  "demo-7": {
    no: "DC-2026-0007", substance: "DC-101", client: "(주)바이오벤처", masked: false, ddayLabel: "제출 완료", urgent: false,
    confid: "CDA 필요 (단추 표준 CDA)", replyBy: "2026-09-16", authorities: ["식약처(MFDS)", "US FDA"],
    overview: [["의뢰 목적", "허가자료 제출용"], ["개발 분야", "의약품(합성)"], ["제출처", "식약처(MFDS) · US FDA"], ["기밀 등급", "CDA 필요 (단추 표준)"], ["희망 착수", "1~3개월"], ["회신 기한", "2026-09-16 (D-9)"], ["CRO 수", "5곳"]],
    rows: [
      { seq: 1, category: "일반독성", name: "반복투여독성 4주 (랫드)", cond: "SD 랫드 · 회복 2주" },
      { seq: 2, category: "유전독성", name: "복귀돌연변이 Ames (TG 471)", cond: "5균주 · ±S9" },
      { seq: 3, category: "유전독성", name: "염색체이상 in vitro (TG 473)", cond: "CHL 세포" },
      { seq: 4, category: "유전독성", name: "소핵 in vivo (마우스)", cond: "ICR 마우스 · 3군" },
    ],
    common: [["시험 투여경로", "경구(PO)"], ["적용 GLP", "식약처(KGLP) · US FDA GLP"], ["보고서 언어", "국문 + 영문 번역"]],
    attachments: "COA 1건",
  },
};

export type ReplyItem = { seq: number; avail: "" | "가능" | "조건부 가능" | "불가"; amount: string; weeks: string };
export type ReplyDraft = { items: ReplyItem[]; note: string; pdfName: string; status: "draft" | "submitted" };

const DEMO_DRAFT: Record<string, ReplyDraft> = {
  "demo-8": { items: [{ seq: 1, avail: "가능", amount: "18000000", weeks: "6" }, { seq: 2, avail: "가능", amount: "22000000", weeks: "8" }, { seq: 3, avail: "", amount: "", weeks: "" }], note: "", pdfName: "", status: "draft" },
  "demo-7": { items: [{ seq: 1, avail: "가능", amount: "128000000", weeks: "22" }, { seq: 2, avail: "가능", amount: "9500000", weeks: "6" }, { seq: 3, avail: "가능", amount: "14500000", weeks: "8" }, { seq: 4, avail: "가능", amount: "35000000", weeks: "10" }], note: "영문 보고서 별도 +8,000,000원 · 시험물질 보관 비용 미포함", pdfName: "정식 견적서_켐온_DC-101.pdf", status: "submitted" },
};

export function demoRfq(token: string): RfqView | null {
  return DEMO_RFQ[token] ?? null;
}
export function demoDraft(token: string): ReplyDraft | null {
  return DEMO_DRAFT[token] ?? null;
}

export const DEADLINES = [
  { title: "AB-14 · 안전성약리", no: "DC-2026-0008", sub: "작성 중 2/3", pill: "회신 D-2", tone: "err" as const, bar: "err" as const, pct: 66, meta: "9월 9일 마감", token: "demo-8" },
  { title: "NV-308 · 일반독성 외", no: "DC-2026-0009", sub: "제출 완료 · 수정 가능", pill: "유효 D-60", tone: "ok" as const, bar: "brand" as const, pct: 100, meta: "9월 13일까지 수정", token: "demo-9" },
  { title: "DC-101 · 일반독성·유전독성", no: "DC-2026-0007", sub: "제출 완료 · 비교표 발송 대기", pill: "유효 D-60", tone: "ok" as const, bar: "brand" as const, pct: 100, meta: "9월 16일 회신 기한", token: "demo-7" },
  { title: "GL-2 · 동물대체시험", no: "DC-2026-0010", sub: "미작성", pill: "회신 D-8", tone: "sf" as const, bar: "brand" as const, pct: 0, meta: "9월 15일 마감", token: "demo-10" },
];

export const AWARD = {
  no: "DC-2026-0005", substance: "BV-22", cats: "안전성약리 핵심 배터리", amount: "6,800만 원", date: "9월 7일",
  client: { initial: "박", name: "박민호 · 연구소장", org: "(주)백신랩", email: "minho@vaccinelab.co.kr", phone: "010-2277-0000" },
};

export const RESULTS: [string, string, "선정" | "미선정"][] = [
  ["BV-22 · 안전성약리", "DC-2026-0005 · 6,800만 원", "선정"],
  ["KX-7 · 의료기기 생물학적 안전성", "DC-2026-0003 · 4,200만 원 · KTR 선정", "미선정"],
  ["DC-090 · 동물대체시험", "DC-2026-0002 · 1,900만 원 · 계약 완료", "선정"],
];
