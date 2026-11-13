/**
 * 의뢰자·기관 직접 질의응답 (0045, 2026-11-13 대표 결정). 화면에 보낼 모양과 열람·가림 규칙만 둔다 (DB 읽기는 lib/qna-data.ts).
 *
 * 열람
 * - 의뢰자: 이 요청의 질의 전부. 비교표가 열리기 전에는 기관 이름 대신 기관 A·B·C(참여 순서).
 * - 기관: 자기 초대의 질의 전부 + 다른 기관 질의 가운데 의뢰자가 "참여 기관 전체"로 답한 것(질의 기관은 밝히지 않음).
 * - 운영자: 전부 원문 (읽기 전용, 열람 감사 기록).
 * 가림 (lib/contact-guard.ts): 상대가 쓴 글의 연락처는 선정 전에는 가린다. 선정한 기관과 의뢰자 사이의 글만 원문.
 * 전체 공개 답변은 다른 기관에게 언제나 가린다.
 */
import { maskContacts } from "./contact-guard";
import type { Tables } from "./db-types";

export type QnaRow = Tables<"rfq_questions">;
export type QnaTopic = QnaRow["topic"];
export type QnaScope = "private" | "all";

export const QNA_TOPICS: [QnaTopic, string][] = [
  ["terms", "요청 조건"],
  ["substance", "시험물질"],
  ["schedule", "일정"],
  ["quote", "견적"],
  ["other", "기타"],
];
export const QNA_TOPIC_LABEL: Record<QnaTopic, string> = Object.fromEntries(QNA_TOPICS) as Record<QnaTopic, string>;
export const QNA_MAX = 1000;

export function isTopic(x: unknown): x is QnaTopic {
  return typeof x === "string" && QNA_TOPICS.some(([k]) => k === x);
}

/** 화면 한 줄 */
export type QnaItem = {
  id: string;
  direction: "cro" | "sponsor";
  topic: string;
  test: string | null;
  body: string;
  bodyMasked: boolean;
  at: string;
  answer: string | null;
  answerMasked: boolean;
  answeredAt: string | null;
  scope: QnaScope | null;
  /** 의뢰자 화면: 기관 표시명. 기관 화면의 공개 답변: 빈 문자열 */
  party: string;
  inviteId: string;
  /** 지금 보는 사람이 답할 차례인가 */
  toAnswer: boolean;
};

export type QnaTarget = { inviteId: string; label: string };

/**
 * 의뢰자 화면의 기관 표시명. 비교표가 열리면 기관 이름, 열리기 전에는 참여 순서대로 기관 A·B·C.
 * 참여 순서(joined_at, 없으면 sent_at)로 매겨 새로 고쳐도 글자가 바뀌지 않는다
 */
export function partyLabels(invites: { id: string; cro_name: string; joined_at?: string | null; sent_at: string }[], named: boolean): Map<string, string> {
  const order = [...invites].sort((a, b) => (a.joined_at ?? a.sent_at).localeCompare(b.joined_at ?? b.sent_at) || a.id.localeCompare(b.id));
  return new Map(order.map((i, n) => [i.id, named ? i.cro_name : `기관 ${letter(n)}`]));
}

function letter(n: number): string {
  let s = "";
  let k = n;
  do {
    s = String.fromCharCode(65 + (k % 26)) + s;
    k = Math.floor(k / 26) - 1;
  } while (k >= 0);
  return s;
}

function show(text: string | null, mask: boolean): { text: string; masked: boolean } {
  if (text == null) return { text: "", masked: false };
  if (!mask) return { text, masked: false };
  const m = maskContacts(text);
  return { text: m.text, masked: m.masked };
}

function testName(seq: number | null, tests: Map<number, string>): string | null {
  return seq == null ? null : tests.get(seq) ?? null;
}

/** 의뢰자 화면. 기관이 쓴 글(기관 질의, 기관 답변)은 선정한 기관 것만 원문 */
export function sponsorItems(rows: QnaRow[], o: { labels: Map<string, string>; selectedInviteId: string | null; tests: Map<number, string> }): QnaItem[] {
  return rows.map((r) => {
    const open = r.invite_id === o.selectedInviteId;
    const body = show(r.body, r.direction === "cro" && !open);
    const answer = show(r.answer, r.direction === "sponsor" && !open);
    return {
      id: r.id,
      direction: r.direction,
      topic: QNA_TOPIC_LABEL[r.topic] ?? "기타",
      test: testName(r.test_seq, o.tests),
      body: body.text,
      bodyMasked: body.masked,
      at: r.created_at,
      answer: r.answer == null ? null : answer.text,
      answerMasked: answer.masked,
      answeredAt: r.answered_at,
      scope: r.scope,
      party: o.labels.get(r.invite_id) ?? "기관",
      inviteId: r.invite_id,
      toAnswer: r.direction === "cro" && r.answer == null,
    };
  });
}

/**
 * 기관 화면. mine = 이 초대의 질의(묻고 받은 것 모두), shared = 다른 기관 질의 중 전체 공개로 답한 것.
 * 다른 기관의 비공개 질의와 아직 답이 없는 질의는 보이지 않는다
 */
export function croItems(rows: QnaRow[], o: { inviteId: string; selectedInviteId: string | null; tests: Map<number, string> }): { mine: QnaItem[]; shared: QnaItem[] } {
  const open = o.inviteId === o.selectedInviteId;
  const mine = rows
    .filter((r) => r.invite_id === o.inviteId)
    .map((r) => {
      const body = show(r.body, r.direction === "sponsor" && !open);
      const answer = show(r.answer, r.direction === "cro" && !open);
      return {
        id: r.id,
        direction: r.direction,
        topic: QNA_TOPIC_LABEL[r.topic] ?? "기타",
        test: testName(r.test_seq, o.tests),
        body: body.text,
        bodyMasked: body.masked,
        at: r.created_at,
        answer: r.answer == null ? null : answer.text,
        answerMasked: answer.masked,
        answeredAt: r.answered_at,
        scope: r.scope,
        party: "",
        inviteId: r.invite_id,
        toAnswer: r.direction === "sponsor" && r.answer == null,
      } satisfies QnaItem;
    });
  const shared = rows
    .filter((r) => r.invite_id !== o.inviteId && r.direction === "cro" && r.scope === "all" && r.answer != null)
    .map((r) => {
      const body = show(r.body, true);
      const answer = show(r.answer, true);
      return {
        id: r.id,
        direction: r.direction,
        topic: QNA_TOPIC_LABEL[r.topic] ?? "기타",
        test: testName(r.test_seq, o.tests),
        body: body.text,
        bodyMasked: body.masked,
        at: r.answered_at ?? r.created_at,
        answer: answer.text,
        answerMasked: answer.masked,
        answeredAt: r.answered_at,
        scope: r.scope,
        party: "",
        // 다른 기관의 초대 번호는 내보내지 않는다
        inviteId: "",
        toAnswer: false,
      } satisfies QnaItem;
    });
  return { mine, shared };
}

/** 요청 상태로 본 질의응답 창 (DB 함수가 잠금 안에서 다시 본다) */
export function qnaWindow(rfq: { compared_at: string | null; selected_quote_id: string | null; status: string }): { croAsk: boolean; sponsorAsk: boolean; answer: boolean } {
  const done = !!rfq.selected_quote_id || ["selected", "contracting", "closed", "cancelled"].includes(rfq.status);
  return { croAsk: !done && !rfq.compared_at, sponsorAsk: !done && !!rfq.compared_at, answer: !done };
}

/** 요청 본문 검사 (라우트). 앞뒤 공백을 지우고 1~1000자 */
export function cleanText(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const t = x.trim();
  return t.length >= 1 && t.length <= QNA_MAX ? t : null;
}

/** 원문에 연락처가 있는가 (DB 에 has_contact 로 남긴다) */
export function hasContact(text: string): boolean {
  return maskContacts(text).masked;
}
