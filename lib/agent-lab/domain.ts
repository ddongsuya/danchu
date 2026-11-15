/** Isolated, synthetic test workflow. Never reads or writes production records. */
export const LAB_ROLES = ["requester", "cro-a", "cro-b"] as const;
export type LabRole = (typeof LAB_ROLES)[number];
export type CroRole = Exclude<LabRole, "requester">;
export const ROLE_LABEL: Record<LabRole, string> = { requester: "의뢰자", "cro-a": "예시 기관 A", "cro-b": "예시 기관 B" };

export type RequestDraft = {
  title: string;
  kind: "tox" | "pd" | "pk" | "other";
  material: string;
  samples: number;
  items: string[];
  deadline: string;
  note: string;
};
export type Quote = {
  lines: { item: string; quantity: number; unitPrice: number | null; amount: number | null }[];
  total: number | null;
  leadDays: number;
  includes: string[];
  excludes: string[];
  note: string;
};
export type Question = { id: string; org: CroRole; question: string; answer: string | null };
export type ChatMessage = { id: string; from: "user" | "agent"; text: string };
export type LabCase = {
  draft: RequestDraft | null;
  request: RequestDraft | null;
  joined: CroRole[];
  drafts: Partial<Record<CroRole, Quote>>;
  quotes: Partial<Record<CroRole, Quote>>;
  questions: Question[];
  crmNotes: Record<CroRole, string[]>;
  chats: Record<LabRole, ChatMessage[]>;
  events: { actor: LabRole; text: string }[];
};

/** Clearly labelled example prices, used for repeatable arithmetic tests only. */
export const CATALOG: Record<CroRole, {
  prices: Record<string, number>; leadDays: number; includes: string[]; excludes: string[];
}> = {
  "cro-a": { prices: { ALT: 5000, AST: 5000, BUN: 6000, CREA: 6000 }, leadDays: 7, includes: ["결과표", "국문 결과 요약"], excludes: ["검체 운송", "부가세"] },
  "cro-b": { prices: { ALT: 4500, AST: 4500, BUN: 5500, CREA: 5500 }, leadDays: 10, includes: ["결과표"], excludes: ["결과 요약 보고서", "검체 운송", "부가세"] },
};

export function newLabCase(): LabCase {
  return { draft: null, request: null, joined: [], drafts: {}, quotes: {}, questions: [], crmNotes: { "cro-a": [], "cro-b": [] }, chats: { requester: [], "cro-a": [], "cro-b": [] }, events: [] };
}

export function isLabRole(value: unknown): value is LabRole {
  return typeof value === "string" && (LAB_ROLES as readonly string[]).includes(value);
}

export function comparisonOpen(state: LabCase): boolean {
  return state.joined.length === 2 && !!state.quotes["cro-a"] && !!state.quotes["cro-b"];
}

function requireCro(role: LabRole): CroRole {
  if (role === "requester") throw new Error("기관 담당자만 사용할 수 있는 기능입니다.");
  return role;
}

function requireJoined(state: LabCase, role: LabRole): CroRole {
  const org = requireCro(role);
  if (!state.request || !state.joined.includes(org)) throw new Error("참여를 승인한 뒤 요청서를 열 수 있습니다.");
  return org;
}

export function saveRequestDraft(state: LabCase, role: LabRole, input: RequestDraft) {
  if (role !== "requester") throw new Error("의뢰자만 요청서를 작성할 수 있습니다.");
  if (state.request) throw new Error("이미 전달한 요청입니다. 새 테스트에서 변경해 주세요.");
  if (!Number.isSafeInteger(input.samples) || input.samples < 1 || input.samples > 10000) throw new Error("검체 수는 1~10,000개로 입력해 주세요.");
  // Normalize only explicit labels for the four synthetic catalogue entries.
  // Do not fuzzy-match unknown tests or infer clinical equivalence.
  const items = [...new Set(input.items.map(s => {
    const label = s.trim().toUpperCase();
    return /^(ALT|AST|BUN|CREA)\s*(?:분석|검사|측정)$/.exec(label)?.[1] ?? label;
  }).filter(Boolean))];
  if (!items.length || items.length > 30) throw new Error("시험 항목을 1~30개 입력해 주세요.");
  if (!input.title.trim() || !input.material.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.deadline) || !Number.isFinite(Date.parse(input.deadline)) || new Date(input.deadline).toISOString().slice(0, 10) !== input.deadline) throw new Error("제목, 검체 종류, 유효한 희망 완료일을 확인해 주세요.");
  state.draft = structuredClone({ ...input, title: input.title.trim(), material: input.material.trim(), items });
  return state.draft;
}

export function sendRequest(state: LabCase, role: LabRole) {
  if (role !== "requester" || !state.draft || state.request) throw new Error("의뢰자가 작성한 미전달 요청 초안이 필요합니다.");
  state.request = structuredClone(state.draft);
  state.events.push({ actor: role, text: "두 예시 기관에 참여 안내를 전달했습니다." });
  return "테스트 요청 전달 완료";
}

export function joinRequest(state: LabCase, role: LabRole) {
  const org = requireCro(role);
  if (!state.request) throw new Error("아직 접수된 요청이 없습니다.");
  if (state.joined.includes(org)) throw new Error("이미 참여한 요청입니다.");
  state.joined.push(org);
  state.events.push({ actor: role, text: "담당자가 참여를 승인했습니다." });
  return "참여 완료. 요청서 전체를 확인할 수 있습니다.";
}

export function prepareQuote(state: LabCase, role: LabRole, note: string) {
  const org = requireJoined(state, role);
  if (state.quotes[org]) throw new Error("이미 제출한 견적입니다. 이 테스트에서는 다시 제출할 수 없습니다.");
  const request = state.request!;
  const catalog = CATALOG[org];
  const lines = request.items.map(item => {
    const unitPrice = catalog.prices[item] ?? null;
    return { item, quantity: request.samples, unitPrice, amount: unitPrice === null ? null : unitPrice * request.samples };
  });
  const total = lines.some(line => line.amount === null) ? null : lines.reduce((sum, line) => sum + line.amount!, 0);
  const draft: Quote = { lines, total, leadDays: catalog.leadDays, includes: [...catalog.includes], excludes: [...catalog.excludes], note };
  state.drafts[org] = draft;
  return draft;
}

export function submitQuote(state: LabCase, role: LabRole) {
  const org = requireJoined(state, role);
  const draft = state.drafts[org];
  if (!draft || draft.total === null) throw new Error("등록된 단가가 없는 항목을 확인해야 합니다. 금액을 추정해 제출할 수 없습니다.");
  if (state.quotes[org]) throw new Error("이미 제출한 견적입니다.");
  if (state.questions.some(q => q.org === org && q.answer === null)) throw new Error("추가 질문의 답변을 확인한 뒤 제출해 주세요.");
  state.quotes[org] = structuredClone(draft);
  state.events.push({ actor: role, text: "담당자가 검토한 견적을 제출했습니다." });
  return "견적 제출 완료";
}

export function askQuestion(state: LabCase, role: LabRole, question: string) {
  const org = requireJoined(state, role);
  if (state.quotes[org]) throw new Error("견적 제출 전에 질문해 주세요.");
  if (!question.trim() || question.length > 1000) throw new Error("질문은 1~1,000자로 작성해 주세요.");
  const q: Question = { id: `q-${state.questions.length + 1}`, org, question: question.trim(), answer: null };
  state.questions.push(q);
  return q;
}

export function answerQuestion(state: LabCase, role: LabRole, id: string, answer: string) {
  if (role !== "requester") throw new Error("의뢰자만 질문에 답할 수 있습니다.");
  const question = state.questions.find(q => q.id === id);
  if (!question || question.answer !== null) throw new Error("답변할 질문이 없습니다.");
  if (!answer.trim() || answer.length > 1000) throw new Error("답변은 1~1,000자로 작성해 주세요.");
  question.answer = answer.trim();
  return question;
}

export function saveCrmNote(state: LabCase, role: LabRole, note: string) {
  const org = requireJoined(state, role);
  if (!note.trim() || note.length > 1000) throw new Error("메모는 1~1,000자로 작성해 주세요.");
  state.crmNotes[org].push(note.trim());
  return "이 기관의 내부 메모에 저장했습니다.";
}

/** The model and browser receive this projection, never the complete case. */
export function viewFor(state: LabCase, role: LabRole) {
  const isRequester = role === "requester";
  const joined = !isRequester && state.joined.includes(role);
  const request = state.request;
  return structuredClone({
    role,
    request: !request ? null : isRequester || joined ? request : { title: "검체 분석 견적 요청", kind: request.kind, samples: request.samples, items: request.items, deadline: request.deadline },
    draft: isRequester ? state.draft : null,
    joined: isRequester ? state.joined.length : joined,
    submitted: isRequester ? Object.keys(state.quotes).length : !!state.quotes[role],
    comparisonOpen: isRequester && comparisonOpen(state),
    comparison: isRequester && comparisonOpen(state) ? ["cro-a", "cro-b"].map(org => ({ org, label: ROLE_LABEL[org as CroRole], ...state.quotes[org as CroRole]! })) : [],
    quoteDraft: isRequester ? null : state.drafts[role] ?? null,
    ownQuote: isRequester ? null : state.quotes[role] ?? null,
    catalog: isRequester ? null : CATALOG[role],
    questions: state.questions.filter(q => isRequester || q.org === role),
    crmNotes: isRequester ? [] : state.crmNotes[role],
    chat: state.chats[role],
    events: state.events.filter(e => e.actor === role),
  });
}
export type LabView = ReturnType<typeof viewFor>;

export const APPROVAL_LABELS: Record<string, string> = {
  send_request: "두 예시 기관에 요청 전달",
  join_request: "참여 동의 후 요청서 열람",
  ask_requester: "의뢰자에게 추가 질문 전달",
  answer_question: "질문한 기관에 답변 전달",
  submit_quote: "검토한 견적 제출",
};

export function labEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DANCHU_AGENT_LAB !== "1") return false;
  if (env.NODE_ENV === "development") return true;
  return env.VERCEL_ENV === "preview"
    && env.VERCEL_GIT_COMMIT_REF === "feat/dual-ai-agents"
    && !!env.DANCHU_AGENT_BLOB_STORE_ID
    && /^[a-f0-9]{64}$/.test(env.DANCHU_AGENT_ACCESS_HASH ?? "")
    && Date.parse(env.DANCHU_AGENT_ACCESS_EXPIRES_AT ?? "") > Date.now();
}
