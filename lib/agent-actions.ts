/**
 * 에이전트 액션 등록부 (2026-11-19, 기관 비서 기능 지도 1단계).
 *
 * 단추의 기능을 "액션" 하나씩으로 적는다. 화면 버튼과 비서가 같은 처리(웹 라우트)를 부른다.
 * 여기 한 줄을 더하면 에이전트가 GET /api/agent/actions 로 읽어 비서 도구·확인 카드에 붙인다.
 *
 * 실행 수준(level)
 *   read    읽기. 바로 한다.
 *   auto    기관 안의 기록(고객관리·할 일·일정). 바로 하고 실행 기록을 남긴다. 사람이 "되돌리기"를 누르면 되돌린다.
 *   confirm 기관 밖으로 나가는 일(질의·답변·제출·선정·접수). 사람이 에이전트 앱에서 승인한 정확한 본문만, 한 번.
 *           단추는 승인 여부를 볼 수 없다. 에이전트 서버가 보내기 장부(사람 승인)를 거친 뒤에만 부른다.
 *   human   사람만 한다(지우기 등). 목록에 적어 두지만 에이전트로는 실행하지 않는다.
 *
 * 입력(input)은 JSON Schema. 다른 행을 가리키는 칸에는 "x-ref"(deal·task·event·contact·company·member)를 단다.
 * 에이전트는 이 칸을 브리핑 목록의 번호로 바꿔 모델에 보여 주고, 실행할 때 id 로 되돌린다.
 * 금액 칸은 비서 도구(tool)에 두지 않는다(금액은 단추 계산 또는 사람이 넣는다).
 */
import type { AgentRole, AgentSession } from "./agent-api";
import { agentJson } from "./agent-api";
import { callAs, inviteForOrg, markVia } from "./agent-act";
import { buildAgentReport, buildBrief, reportRange } from "./agent-brief";
import { loadCrmSynced } from "./crm";
import { getRfqByNo, getRfqDetail, listNotifications, ownsRfq } from "./data";
import { comparisonOpened } from "./reply-window";
import { compareView } from "./compare-view";
import { loadDetail, loadDetailForInvite } from "./detail-data";
import { DETAIL_STATUS_LABEL, MAX_DETAIL_TARGETS, PRIVATE_KEYS, cleanLabel, detailFieldMap, detailLines, showValue } from "./detail-quote";
import { testOptions } from "./qna-data";
import { awardForRfq } from "./contract-draft-db";
import { contractView } from "./agent-contract";
import { loadCroQna, loadSponsorQna } from "./qna-data";
import { QNA_TOPICS } from "./qna";
import { submittedDoc } from "./quote-doc-db";
import { getSupabaseAdmin } from "./supabase";
import { featureError } from "./plan-usage";
import { awardForOrgByRfq, draftForAward, draftSentAt, sendDraft } from "./contract-draft-db";
import { createDocFromRequest, docForInvite, findDocs, loadDoc, priceRequest, requestInputFor, saveDoc, type RequestInput } from "./quote-doc-db";
import { applyDocEdits, applyReplyFields, docView, parseDocEdits, replyFromDoc, setManualAmount, submitFromDoc, submitPreview, type EditError } from "./agent-quote-doc";
import { loadQuote } from "./quote-load";
import { RETENTION } from "./retention";
import { ACT_KINDS, CONTACT_ROLES, EVENT_KINDS, EVENT_MODES, TASK_CATS } from "./crm-shape";
import { LOST_REASONS, STAGES, STATUSES } from "./crm-deals";
import type { PlanFeature } from "./plans";
import { checkRequestValues, createGate, requestSchema, REQUEST_SCHEMA_VERSION } from "./agent-request";
import { matchOrgs } from "./distribute";
import { rateLimited } from "./rate-limit";
import type { RfqRow } from "./data";
import type { Values } from "./rfq-schema";
import { POST as sponsorQna } from "@/app/api/rfq/[no]/qna/route";
import { POST as select } from "@/app/api/rfq/[no]/select/route";
import { POST as detail } from "@/app/api/rfq/[no]/detail/route";
import { POST as contractConfirm } from "@/app/api/rfq/[no]/contract/route";
import { POST as contractResult } from "@/app/api/rfq/[no]/contract-result/route";
import { POST as outcomeRfq } from "@/app/api/rfq/[no]/outcome/route";
import { POST as reopenRfq } from "@/app/api/rfq/[no]/reopen/route";
import { POST as fileUrl } from "@/app/api/rfq/[no]/files/retry/route";
import { POST as fileDone } from "@/app/api/rfq/[no]/files/confirm/route";
import { POST as notificationsRead } from "@/app/api/notifications/read/route";
import { POST as catalogSave } from "@/app/api/cro/catalog/route";
import { POST as substancePost } from "@/app/api/awards/[id]/substance/route";
import { POST as supportPost } from "@/app/api/support/route";
import { GET as fileGet } from "@/app/api/files/[id]/route";
import { runAsAgent } from "./agent-context";
import { extractText, fileKind, maskForCro } from "./agent-file-text";
import { anonymousFileLabel } from "./request-policy";
import { loadCatalog } from "./catalog-db";
import { loadCrm } from "./crm";
import { catalogPatch, crmFind } from "./agent-cro-tools";
import { invoiceView, INVOICE_VIEW_LABEL } from "./invoices";
import { todaySeoul } from "./format";
import { POST as createRfq } from "@/app/api/rfq/route";
import { POST as startRfq } from "@/app/api/rfq/[no]/start/route";
import { POST as detailReply } from "@/app/api/quote/[token]/detail/route";
import { POST as contractReport } from "@/app/api/awards/[id]/contract/route";
import { POST as join } from "@/app/api/quote/[token]/join/route";
import { POST as decline } from "@/app/api/quote/[token]/decline/route";
import { POST as croQna } from "@/app/api/quote/[token]/qna/route";
import { POST as submitQuote, PUT as saveQuote } from "@/app/api/quote/[token]/route";
import { POST as uploadUrl } from "@/app/api/quote/[token]/upload-url/route";
import { POST as crmWrite, PATCH as crmPatch } from "@/app/api/cro/crm/[kind]/route";
import { GET as bookRead } from "@/app/api/cro/price-book/route";
import { POST as bookImport } from "@/app/api/cro/price-book/import/route";

export type ActionLevel = "read" | "auto" | "confirm" | "human";
export type ActionArea = "intake" | "qna" | "quote" | "contract" | "crm" | "calendar" | "report" | "brief" | "price";
export type CrmKind = "companies" | "contacts" | "deals" | "activities" | "events" | "tasks";
export type JsonSchema = Record<string, unknown>;
/** before: 실행 기록에 남길 바꾸기 전 모습(응답에는 넣지 않는다) */
export type ActOut = { status: number; body: Record<string, unknown>; before?: Record<string, unknown> };
export type ActCtx = { s: AgentSession; req: Request; no: string | null; body: Record<string, unknown> };

export type ActionDef = {
  name: string;
  role: AgentRole;
  /** rfq: 단추 요청 번호가 있어야 한다. org: 번호 없이 */
  scope: "rfq" | "org";
  level: ActionLevel;
  area: ActionArea;
  /** 확인 카드·실행 기록에 보일 짧은 이름 */
  label: string;
  /** 모델·사양서용 설명 */
  description: string;
  input: JsonSchema;
  /** 비서(AI)가 대화에서 부를 수 있는지. 읽기·바로 실행 가운데 고른 것만. 나머지는 앱이 사람 값으로 만든다 */
  tool?: boolean;
  /** 이 기능이 있는 요금제에서만 */
  feature?: PlanFeature;
  /** 바로 실행 기록의 대상. create 는 응답 id, update·move 는 입력 id */
  target?: { kind: CrmKind; op: "create" | "update" | "move" };
  run?: (c: ActCtx) => Promise<ActOut>;
};

/* ── 입력 모양 도우미 ── */
const str = (description: string, maxLength = 200) => ({ type: "string", maxLength, description });
const ymd = (description: string) => ({ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description });
const hm = (description: string) => ({ type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", description });
const oneOf = (values: readonly string[], description: string) => ({ type: "string", enum: [...values], description });
const ref = (to: "deal" | "task" | "event" | "contact" | "company" | "member", description: string) => ({ type: "string", format: "uuid", "x-ref": to, description });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
/** 웹 본문을 그대로 넘기는 동작(모양 검사는 웹 라우트가 한다) */
const passthrough = (description: string) => ({ type: "object", additionalProperties: true, description });

/* ── 실행 도우미 ── */
/** 기관: 이 요청의 견적서 툴 입력(참여한 초대만) */
async function requestFor(c: ActCtx): Promise<{ input: RequestInput } | ActOut> {
  const inv = await inviteForOrg(c.no!, c.s.org!.id);
  if (!inv) return notFound();
  const input = await requestInputFor(c.s.org!.id, inv.id);
  if (input === "not_joined") return { status: 409, body: { error: "not_joined" } };
  return input ? { input } : notFound();
}

const bad = (): ActOut => ({ status: 400, body: { error: "bad_request" } });
const notFound = (): ActOut => ({ status: 404, body: { error: "not_found" } });

/** 기관: 이 요청에 우리 기관이 받은 초대로 웹 회신 처리를 부른다 */
function viaInvite(handler: Parameters<typeof callAs<{ token: string }>>[2], opts: { method?: "POST" | "PUT"; withAction?: string; mark?: boolean } = {}) {
  return async (c: ActCtx): Promise<ActOut> => {
    const inv = await inviteForOrg(c.no!, c.s.org!.id);
    if (!inv) return notFound();
    const body = opts.withAction ? { ...c.body, action: opts.withAction } : c.body;
    const r = await callAs(c.s, c.req, handler, { token: inv.token }, body, opts.method ?? "POST");
    if (r.status === 200 && opts.mark) await markVia("cro_quotes", "invite_id", inv.id);
    if (r.status === 200 && opts.withAction === "ask" && typeof r.body.id === "string") await markVia("rfq_questions", "id", r.body.id);
    return r;
  };
}

/** 의뢰자: 이 요청의 웹 처리를 부른다 */
function viaRfq(handler: Parameters<typeof callAs<{ no: string }>>[2], opts: { withAction?: string; mark?: "rfq_awards" | "rfq_details" } = {}) {
  return async (c: ActCtx): Promise<ActOut> => {
    const body = opts.withAction ? { ...c.body, action: opts.withAction } : c.body;
    const r = await callAs(c.s, c.req, handler, { no: c.no! }, body);
    if (r.status === 200 && opts.withAction === "ask" && typeof r.body.id === "string") await markVia("rfq_questions", "id", r.body.id);
    if (r.status === 200 && opts.mark) {
      const rfq = await getRfqByNo(c.no!);
      if (rfq) await markVia(opts.mark, "rfq_id", rfq.id);
    }
    return r;
  };
}

/** 기관 CRM 쓰기(/api/cro/crm/<kind>)를 그대로 부른다 */
function viaCrm(kind: string, method: "POST" | "PATCH" = "POST") {
  return async (c: ActCtx): Promise<ActOut> => {
    const r = await callAs(c.s, c.req, method === "POST" ? crmWrite : crmPatch, { kind }, c.body, method);
    if (r.status === 200 && kind === "activities" && method === "POST" && typeof r.body.id === "string") await markVia("cro_crm_activities", "id", r.body.id);
    return r;
  };
}

/** 의뢰자: 담당자 칸은 본문 값이 아니라 단추 프로필에서 채운다(접수·검사 같음) */
function withProfile(c: ActCtx, body: Record<string, unknown>): Values {
  const p = c.s.profile;
  return { ...(body as Values), company: p.company ?? "", name: p.name ?? "", dept: p.dept ?? "", phone: p.phone ?? "", email: c.s.email, orgType: (p.org_type ?? body.orgType) as string | undefined };
}

/** 기관: 이 요청으로 만든 견적서(참여한 초대만) */
async function docFor(c: ActCtx): Promise<{ inv: { id: string; token: string }; head: Awaited<ReturnType<typeof loadDoc>> & object } | ActOut> {
  const inv = await inviteForOrg(c.no!, c.s.org!.id);
  if (!inv) return notFound();
  const d = await docForInvite(c.s.org!.id, inv.id);
  if (!d) return { status: 404, body: { error: "doc_missing" } };
  const got = await loadDoc(c.s.org!.id, d.id);
  return got ? { inv, head: got } : notFound();
}
const editErr = (e: EditError): ActOut => ({ status: e === "not_found" ? 404 : 400, body: { error: e } });

/**
 * 제출 본문의 견적서 판(docUpdatedAt, 앱 확인 카드가 본 판). 있으면 지금 판과 같아야 하고, 본문 금액이 견적서 금액과 달라도 막는다(사람이 본 금액만 나간다).
 * 없으면(옛 앱) 견적서 금액으로 바꿔 채운다(overridden).
 */
function docVersionErr(c: ActCtx, head: { updatedAt: string }, filled?: { before: import("./cro-data").ReplyItem[]; after: import("./cro-data").ReplyItem[] }): ActOut | null {
  const v = c.body.docUpdatedAt;
  if (v === undefined) return null;
  if (typeof v !== "string" || !v) return bad();
  if (v !== head.updatedAt) return { status: 409, body: { error: "changed", updatedAt: head.updatedAt } };
  if (!filled) return null;
  const sent = new Map(filled.before.map((it) => [it.seq, String(it.amount ?? "")]));
  const seqs = filled.after.filter((it) => it.avail !== "불가" && sent.get(it.seq) !== String(it.amount ?? "")).map((it) => it.seq);
  return seqs.length ? { status: 409, body: { error: "changed", seqs, updatedAt: head.updatedAt } } : null;
}
const withoutDocVersion = (b: Record<string, unknown>) => {
  const { docUpdatedAt: _v, ...rest } = b;
  return rest;
};

/** 견적서를 판 비교로 저장. 바꾸기 전 모습을 실행 기록에 남긴다 */
async function saveDocAs(c: ActCtx, got: { head: { head: { id: string; client: string; substance: string; issuedOn: string; validUntil: string | null; memo: string; updatedAt: string }; data: unknown } }, data: unknown, extra: Record<string, unknown>): Promise<ActOut> {
  const h = got.head.head;
  const ifUpdatedAt = typeof c.body.updatedAt === "string" ? c.body.updatedAt : "";
  if (!ifUpdatedAt) return bad();
  if (ifUpdatedAt !== h.updatedAt) return { status: 409, body: { error: "changed", updatedAt: h.updatedAt } };
  if (featureError(c.s.org, "branding") && data && typeof data === "object") data = { ...(data as object), layout: null };
  const r = await saveDoc(c.s.org!.id, h.id, { client: h.client, substance: h.substance, issuedOn: h.issuedOn, validUntil: h.validUntil, memo: h.memo, data }, { ifUpdatedAt });
  if (!r.ok) return r.changed ? { status: 409, body: { error: "changed" } } : { status: 500, body: { error: "unavailable" } };
  return { status: 200, body: { ok: true, docId: h.id, updatedAt: r.updatedAt, ...extra }, before: { docId: h.id, updatedAt: h.updatedAt, data: got.head.data } };
}

/** 기관: 이 요청의 회신 초안(없으면 단추가 만든 초안)을 읽어 고친 뒤 임시 저장한다 */
async function editDraft(c: ActCtx, edit: (d: { items: import("./cro-data").ReplyItem[]; common: import("./cro-data").ReplyCommon; rows: { seq: number; name: string }[] }) => { items: import("./cro-data").ReplyItem[]; common: import("./cro-data").ReplyCommon; extra?: Record<string, unknown> } | ActOut): Promise<ActOut> {
  const inv = await inviteForOrg(c.no!, c.s.org!.id);
  if (!inv) return notFound();
  const got = await loadQuote(inv.token, { markOpened: false });
  if (!got?.joined || !got.draft) return { status: 409, body: { error: "not_joined" } };
  if (got.draft.status === "submitted") return { status: 409, body: { error: "submitted" } };
  const next = edit({ items: got.draft.items, common: got.draft.common, rows: got.rfq.rows });
  if ("status" in next) return next;
  const r = await callAs(c.s, c.req, saveQuote, { token: inv.token }, { items: next.items, note: got.draft.note, common: next.common, steps: got.draft.steps ?? [] }, "PUT");
  if (r.status !== 200) return r;
  await markVia("cro_quotes", "invite_id", inv.id);
  return { status: 200, body: { ok: true, items: next.items.map((i) => ({ seq: i.seq, avail: i.avail, amount: i.amount, weeks: i.weeks, reason: i.reason ?? "" })), common: next.common, ...(next.extra ?? {}) } };
}

/** 내 알림(웹 알림 화면과 같은 목록). 본문은 120자까지 */
async function myNotifications(c: ActCtx): Promise<ActOut> {
  const unread = c.body.unread === true;
  const { list } = await listNotifications(c.s.userId, 30);
  const rows = (unread ? list.filter((n) => !n.read_at) : list).map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: (n.body ?? "").slice(0, 120), href: n.href, read: !!n.read_at, at: n.created_at }));
  return { status: 200, body: { notifications: rows } };
}
const NOTI_INPUT = obj({ unread: { type: "boolean", description: "읽지 않은 것만" } });
const NOTI_READ_INPUT = obj({ id: { type: "string", format: "uuid", description: "읽음 처리할 알림. 없으면 전부" } });

/** 의뢰자: 내 요청(없거나 남의 것이면 null) */
async function ownRfq(c: ActCtx) {
  const rfq = await getRfqByNo(c.no!);
  return rfq && ownsRfq(rfq, c.s.userId) ? rfq : null;
}

const SUPPORT_INPUT = obj({ type: oneOf(["이용 문의", "오류 신고", "요금·청구", "기타"], "문의 종류"), rfqNo: str("관련 요청 번호", 20), text: str("문의 내용", 4000) }, ["text"]);
/** 단추 운영자에게 문의(답변은 계정 이메일로) */
const supportRun = async (c: ActCtx): Promise<ActOut> => callAs(c.s, c.req, supportPost, {}, { email: c.s.email, type: c.body.type ?? "기타", rfqNo: c.body.rfqNo ?? "", text: c.body.text });

/* 질의응답 본문은 웹 라우트 그대로(app/api/rfq/[no]/qna, app/api/quote/[token]/qna). 주제·시험 행은 qna_view 의 topics·tests */
const QNA_TOPIC_IDS = QNA_TOPICS.map(([k]) => k);
const testSeq = { type: "integer", minimum: 1, description: "관련 시험 행(qna_view tests 의 seq). 없으면 요청 전체" };
const SPONSOR_ASK_INPUT = obj({ inviteId: str("질의할 기관(qna_view targets 의 inviteId)", 64), topic: oneOf(QNA_TOPIC_IDS, "주제"), testSeq, body: str("질의 본문", 1000) }, ["inviteId", "topic", "body"]);
const SPONSOR_ANSWER_INPUT = obj({ questionId: str("답할 기관 질의 id", 64), answer: str("답변", 1000), scope: oneOf(["private", "all"], "private 질의 기관만, all 참여 기관 전체") }, ["questionId", "answer", "scope"]);
const CRO_ASK_INPUT = obj({ topic: oneOf(QNA_TOPIC_IDS, "주제"), testSeq, body: str("질의 본문", 1000) }, ["topic", "body"]);
const CRO_ANSWER_INPUT = obj({ questionId: str("답할 의뢰자 질의 id", 64), answer: str("답변", 1000) }, ["questionId", "answer"]);

/**
 * 요청 첨부 읽기 (2026-11-20 사용자 결정: AI가 첨부 내용까지 읽는다).
 * 권한은 웹 내려받기(/api/files)와 같다: 의뢰자는 내 요청, 기관은 참여한 요청(CDA·2차 대상·참여 중지 규칙 그대로).
 * 선정 전 기관에게는 파일 이름을 "첨부 n"으로, 본문의 의뢰자 회사명·담당자 이름·연락처를 가린다.
 */
const FILE_INPUT = obj({ fileId: { type: "string", format: "uuid", description: "읽을 첨부 id. 없으면 첨부 목록만" } });
async function fileTextRun(c: ActCtx): Promise<ActOut> {
  const sb = getSupabaseAdmin();
  if (!sb) return { status: 503, body: { error: "unavailable" } };
  const { data: rfq } = await sb.from("rfq_requests").select("id, user_id, company, contact_name, selected_quote_id, payload").eq("rfq_no", c.no!).maybeSingle();
  if (!rfq) return notFound();
  let hide = false;
  let detailOk = true;
  if (c.s.role === "requester") {
    if (!rfq.user_id || rfq.user_id !== c.s.userId) return notFound();
  } else {
    const inv = await inviteForOrg(c.no!, c.s.org!.id);
    if (!inv) return notFound();
    const [{ data: q }, { data: t }] = await Promise.all([
      sb.from("cro_quotes").select("id").eq("invite_id", inv.id).maybeSingle(),
      sb.from("rfq_detail_targets").select("id").eq("invite_id", inv.id).maybeSingle(),
    ]);
    hide = !(q && rfq.selected_quote_id === q.id);
    detailOk = !!t;
  }
  const { data: rows } = await sb.from("rfq_files").select("id, file_name, size_bytes, mime_type, scope, created_at").eq("rfq_id", rfq.id).order("created_at");
  const seen: Record<string, number> = {};
  const files = (rows ?? []).filter((f) => f.scope !== "detail" || detailOk).map((f) => {
    const idx = (seen[f.scope] = (seen[f.scope] ?? -1) + 1);
    return { id: f.id as string, name: hide ? anonymousFileLabel(idx, f.file_name, f.size_bytes) : (f.file_name as string), size: f.size_bytes as number, scope: f.scope as string, kind: fileKind(f.file_name, f.mime_type), raw: f };
  });
  const id = typeof c.body.fileId === "string" ? c.body.fileId : "";
  if (!id) return { status: 200, body: { files: files.map(({ raw: _raw, ...f }) => f) } };
  const f = files.find((x) => x.id === id);
  if (!f) return notFound();
  if (f.kind === "unsupported") return { status: 415, body: { error: "unsupported", file: { id: f.id, name: f.name, kind: f.kind } } };
  if (await rateLimited("agent:file_text", c.s.userId, 40, 10 * 60)) return { status: 429, body: { error: "too_many" } };
  // 권한 판단과 내려받기는 웹 라우트를 그대로 쓴다
  const res = await runAsAgent(c.s, () => fileGet(new Request(new URL(`/api/files/${id}`, c.req.url)), { params: Promise.resolve({ id }) }));
  let bytes: ArrayBuffer | null = null;
  if (res.status === 302 || res.status === 307) {
    const loc = res.headers.get("location");
    const got = loc ? await fetch(loc).catch(() => null) : null;
    if (got?.ok) bytes = await got.arrayBuffer();
  } else if (res.status === 200) bytes = await res.arrayBuffer();
  else return { status: res.status, body: { error: res.status === 403 ? "forbidden" : res.status === 404 ? "not_found" : "unavailable" } };
  if (!bytes) return { status: 502, body: { error: "unavailable" } };
  const file = { id: f.id, name: f.name, kind: f.kind };
  // 이미지·스캔 PDF 는 글이 없어 파일째 AI에 넘긴다. 가릴 수 없으므로 선정 전 기관에는 주지 않는다
  const whole = (mime: string, max: number): ActOut => {
    if (hide) return { status: 403, body: { error: "hidden_before_award", file } };
    if (bytes!.byteLength > max) return { status: 413, body: { error: "too_large", file } };
    return { status: 200, body: { file, media: { mime, base64: Buffer.from(bytes!).toString("base64") } } };
  };
  if (f.kind === "image") return whole(f.raw.mime_type === "image/png" || /\.png$/i.test(f.raw.file_name) ? "image/png" : "image/jpeg", 5 * 1024 * 1024);
  const out = await extractText(new Uint8Array(bytes), f.raw.file_name, f.raw.mime_type);
  if ("error" in out) return { status: out.error === "unsupported" ? 415 : 422, body: { error: out.error, file } };
  if (out.kind === "pdf" && !out.text) return whole("application/pdf", 10 * 1024 * 1024);
  let text = out.text;
  let masked = false;
  if (hide) {
    const p = (rfq.payload ?? {}) as Record<string, unknown>;
    const m = maskForCro(text, [rfq.company, rfq.contact_name, typeof p.dept === "string" ? p.dept : null, typeof p.company === "string" ? p.company : null, typeof p.name === "string" ? p.name : null]);
    text = m.text;
    masked = m.masked;
  }
  return { status: 200, body: { file, text, chars: out.chars, truncated: out.truncated, masked } };
}

/* ── 등록부 ── */
export const AGENT_ACTIONS: readonly ActionDef[] = [
  // ─ 의뢰자 ─
  {
    name: "create", role: "requester", scope: "org", level: "confirm", area: "intake", label: "요청 접수",
    description: "사람이 승인한 요청서를 단추에 접수하고 기관 안내를 시작한다. 회사명·연락처는 단추 프로필에서 채운다.",
    input: passthrough("단추 요청서 본문(웹 위자드와 같은 모양)"),
    run: async (c) => {
      const p = c.s.profile;
      if (!p.company?.trim() || !p.name?.trim()) return { status: 409, body: { error: "profile_incomplete" } };
      // 단추 양식 검사(D1). 판을 보낸 새 앱은 엄격하게, 판 없는 옛 앱은 경고만 남기고 받는다
      const { schemaVersion, ...raw } = c.body;
      const chk = checkRequestValues(withProfile(c, raw));
      const gate = createGate(schemaVersion, chk.issues);
      if (gate.kind === "outdated") return { status: 409, body: { error: "schema_outdated", schemaVersion: REQUEST_SCHEMA_VERSION } };
      if (gate.kind === "reject") return { status: 400, body: { error: gate.error, issues: gate.issues } };
      if (gate.kind === "lenient") console.warn("agent create: lenient", gate.codes.join(","));
      // 새 앱은 양식에 없는 칸을 빼고 보낸다(기관에게 칸 이름이 그대로 보이지 않게). 옛 앱 본문은 그대로
      const payload = withProfile(c, schemaVersion === undefined ? raw : chk.payload);
      const made = await callAs(c.s, c.req, createRfq, {}, { payload, files: [] });
      const rfqNo = typeof made.body.rfqNo === "string" ? made.body.rfqNo : null;
      if (made.status !== 200 || !rfqNo || made.body.persisted !== true) return made;
      if (!made.body.duplicate) await markVia("rfq_requests", "rfq_no", rfqNo);
      const started = await callAs(c.s, c.req, startRfq, { no: rfqNo }, {});
      return { status: 200, body: { rfqNo, duplicate: !!made.body.duplicate, started: started.status === 200 && started.body.ok === true } };
    },
  },
  {
    name: "request_schema", role: "requester", scope: "org", level: "read", area: "intake", label: "요청서 양식", tool: true,
    description: "단추 요청서 양식(분야·시험 종류·조건 칸·선택지)과 양식 판을 읽는다. 요청서는 이 칸과 선택지 글자 그대로 채운다.",
    input: obj({}),
    run: async () => ({ status: 200, body: requestSchema() }),
  },
  {
    name: "request_check", role: "requester", scope: "org", level: "read", area: "intake", label: "요청서 검사", tool: true,
    description: "요청서 본문을 단추 접수와 같은 규칙으로 검사한다(저장하지 않는다). 빠진 칸, 선택지에 없는 값, 회신 표 행, 보낼 수 있는지를 돌려준다.",
    input: obj({ payload: passthrough("단추 요청서 본문(request_schema 칸)"), schemaVersion: str("request_schema 의 양식 판", 20) }, ["payload"]),
    run: async (c) => {
      const raw = c.body.payload;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return bad();
      if (await rateLimited("agent:request_check", c.s.userId, 30, 10 * 60)) return { status: 429, body: { error: "too_many" } };
      const schemaVersion = c.body.schemaVersion;
      const chk = checkRequestValues(withProfile(c, raw as Record<string, unknown>));
      const ok = chk.issues.length === 0;
      // 받을 기관이 있는지만 알린다. 기관 이름·수는 주지 않는다(접수 전 기관 시험 목록 추정 방지)
      let deliverable: boolean | null = null;
      if (ok) {
        try {
          const m = await matchOrgs({ categories: (chk.payload.categories as string[]) ?? [], payload: chk.payload } as unknown as RfqRow);
          deliverable = m.orgs.length > 0;
        } catch {
          deliverable = null;
        }
      }
      return {
        status: 200,
        body: {
          schemaVersion: REQUEST_SCHEMA_VERSION,
          outdated: schemaVersion !== undefined && schemaVersion !== REQUEST_SCHEMA_VERSION,
          ok, issues: chk.issues, warnings: chk.warnings, rows: chk.rows, payload: chk.payload, deliverable,
        },
      };
    },
  },
  {
    name: "qna_view", role: "requester", scope: "rfq", level: "read", area: "qna", label: "질의응답 보기", tool: true,
    description: "이 요청의 질의응답(기관 표시명은 비교표 전 기관 A·B, 선정 전 연락처 가림), 질의할 수 있는 기관, 답할 질의 수, 주제·시험 행 목록.",
    input: obj({}),
    run: async (c) => {
      const rfq = await ownRfq(c);
      if (!rfq) return notFound();
      return { status: 200, body: { qna: await loadSponsorQna(rfq), topics: QNA_TOPICS.map(([id, label]) => ({ id, label })) } };
    },
  },
  { name: "ask", role: "requester", scope: "rfq", level: "confirm", area: "qna", label: "기관에 질의", description: "비교표가 열린 뒤 견적을 낸 기관에 질의를 보낸다.", input: SPONSOR_ASK_INPUT, run: viaRfq(sponsorQna, { withAction: "ask" }) },
  { name: "answer", role: "requester", scope: "rfq", level: "confirm", area: "qna", label: "기관 질의에 답변", description: "기관이 보낸 질의에 답한다. 다른 참여 기관에도 공개할지(scope) 고른다.", input: SPONSOR_ANSWER_INPUT, run: viaRfq(sponsorQna, { withAction: "answer" }) },
  { name: "select", role: "requester", scope: "rfq", level: "confirm", area: "quote", label: "기관 선정", description: "비교표가 열린 뒤 견적 하나를 선정한다. 선정 사유를 함께 남긴다.", input: passthrough("단추 선정 본문"), run: viaRfq(select, { mark: "rfq_awards" }) },
  {
    name: "detail_view", role: "requester", scope: "rfq", level: "read", area: "quote", label: "2차 상세 요청 보기", tool: true,
    description: "2차 상세 요청을 보낼 수 있는지, 보낼 수 있는 기관(1차 견적을 낸 곳, 최대 3곳)과 바꿀 수 있는 조건 칸(지금 값), 보냈으면 바꾼 조건과 기관별 회신 상태.",
    input: obj({}),
    run: async (c) => {
      const rfq = await ownRfq(c);
      if (!rfq) return notFound();
      const [d, sent] = await Promise.all([getRfqDetail(rfq), loadDetail(rfq.id)]);
      const payload = (rfq.payload ?? {}) as Values;
      const cats = rfq.categories ?? [];
      const submitted = d.quotes.filter((q) => q.status === "submitted");
      const labOf = new Map(submitted.map((q) => [q.id, q.cro_name]));
      const opened = comparisonOpened(rfq);
      // 단추 send_detail_request 와 같은 조건: 비교표가 열린 뒤, 선정·마무리 전, 요청마다 한 번
      const canSend = opened && !sent && !rfq.selected_quote_id && !["selected", "contracting", "closed", "cancelled"].includes(rfq.status) && submitted.length > 0;
      return {
        status: 200,
        body: {
          canSend,
          maxTargets: MAX_DETAIL_TARGETS,
          targets: opened ? submitted.map((q) => ({ quoteId: q.id, lab: q.cro_name })) : [],
          // 바꿀 수 있는 조건(요청서 키 그대로). 예산은 기관에 가지 않는다
          fields: [...detailFieldMap(cats)].map(([key, { field, group }]) => ({ key, group, label: cleanLabel(field.label), type: field.type, ...(field.options ? { options: [...field.options] } : {}), current: showValue(payload[key]) || null, private: PRIVATE_KEYS.includes(key) })),
          sent: sent
            ? {
                replyBy: sent.replyBy,
                note: sent.note,
                ...detailLines(sent.values, payload, cats),
                targets: sent.targets.map((t) => ({ quoteId: t.quoteId, lab: labOf.get(t.quoteId) ?? "", status: t.status, statusLabel: DETAIL_STATUS_LABEL[t.status] ?? t.status, total: t.total, weeks: t.weeks, respondedAt: t.respondedAt })),
              }
            : null,
        },
      };
    },
  },
  { name: "detail", role: "requester", scope: "rfq", level: "confirm", area: "quote", label: "2차 상세 요청", description: "기관에 2차 상세 견적을 요청한다.", input: passthrough("단추 2차 요청 본문"), run: viaRfq(detail, { mark: "rfq_details" }) },
  { name: "contract_confirm", role: "requester", scope: "rfq", level: "confirm", area: "contract", label: "계약 보고 확인", description: "기관의 계약 체결 보고를 확인하거나 이의를 남긴다.", input: passthrough("단추 계약 확인 본문"), run: viaRfq(contractConfirm) },
  { name: "contract_result", role: "requester", scope: "rfq", level: "confirm", area: "contract", label: "계약 결과 알림", description: "계약 결과를 단추에 알린다.", input: passthrough("단추 계약 결과 본문"), run: viaRfq(contractResult) },
  {
    name: "contract_status", role: "requester", scope: "rfq", level: "read", area: "contract", label: "계약 진행 보기", tool: true,
    description: "선정한 기관의 계약 체결 보고, 확인 기한, 확정 여부, 내가 알린 계약 결과와 지금 할 수 있는 동작(확인·이의, 결과 알리기). 선정 전이면 not_selected.",
    input: obj({}),
    run: async (c) => {
      const rfq = await ownRfq(c);
      if (!rfq) return notFound();
      const got = await contractRow({ rfqId: rfq.id });
      if (!got) return { status: 409, body: { error: "not_selected" } };
      return { status: 200, body: { contract: contractView("requester", got.award, rfq.status, got.quoteAmount) } };
    },
  },

  {
    name: "request_close", role: "requester", scope: "rfq", level: "confirm", area: "intake", label: "선정 없이 마무리",
    description: "기관을 선정하지 않고 요청을 마무리한다(외부 진행·보류·취소). 외부 진행이면 어느 기관과 하는지 적는다.",
    input: obj({ outcome: oneOf(["외부 진행", "보류", "취소"], "마무리 사유"), note: str("메모", 500) }, ["outcome"]),
    run: viaRfq(outcomeRfq),
  },
  { name: "request_reopen", role: "requester", scope: "rfq", level: "confirm", area: "intake", label: "보류한 요청 다시 열기", description: "비교표가 열린 뒤 보류한 요청을 다시 열어 선정할 수 있게 한다.", input: obj({}), run: viaRfq(reopenRfq) },
  {
    name: "request_file_url", role: "requester", scope: "rfq", level: "confirm", area: "intake", label: "요청 첨부 올릴 주소",
    description: "요청서 첨부(또는 2차 상세 견적 첨부)를 올릴 주소를 받는다. 올린 뒤 request_file_done 을 부른다. 내용은 file_text 로 읽는다.",
    input: obj({ name: str("파일 이름"), size: { type: "integer", minimum: 1 }, type: str("파일 형식", 100), scope: oneOf(["request", "detail"], "첨부 범위") }, ["name", "size"]),
    run: viaRfq(fileUrl),
  },
  {
    name: "request_file_done", role: "requester", scope: "rfq", level: "confirm", area: "intake", label: "요청 첨부 올림 확인",
    description: "주소로 올린 첨부를 단추가 확인한다.",
    input: obj({ paths: { type: "array", maxItems: 20, items: { type: "string", maxLength: 300 } } }, ["paths"]),
    run: viaRfq(fileDone),
  },
  {
    name: "quote_view", role: "requester", scope: "rfq", level: "read", area: "quote", label: "기관 견적서 보기", tool: true,
    description: "비교표가 열린 뒤, 기관이 단추 견적서 툴로 만든 견적서(제출 금액과 같은 것)의 시험 줄·금액·조건을 읽는다.",
    input: obj({ quoteId: { type: "string", format: "uuid", description: "견적 id(요청 상세의 견적)" } }, ["quoteId"]),
    run: async (c) => {
      const rfq = await ownRfq(c);
      if (!rfq) return notFound();
      if (!comparisonOpened(rfq)) return { status: 409, body: { error: "not_open" } };
      const d = await getRfqDetail(rfq);
      const q = d.quotes.find((x) => x.id === c.body.quoteId && x.status === "submitted");
      if (!q) return notFound();
      const doc = await submittedDoc(q);
      if (!doc) return { status: 404, body: { error: "doc_missing" } };
      const v = docView(doc.head, doc.data);
      return { status: 200, body: { croName: q.cro_name, docNo: v.head.docNo, validUntil: v.head.validUntil, tests: v.tests.map(({ uid: _u, source: _s, ...t }) => t), totals: v.totals, terms: v.terms, path: `/app/r/${rfq.rfq_no}/q/${q.id}/doc` } };
    },
  },
  {
    name: "compare_view", role: "requester", scope: "rfq", level: "read", area: "quote", label: "비교표 보기", tool: true,
    description: "비교표가 열린 뒤 기관별 견적을 회신 도착 순으로 읽는다(총액·기간·착수·조건·시험별 금액·포함 항목). 시험마다 기관 간 갈리는 포함 항목(diff)과 모두 같은 항목(common)을 함께 준다. 순위·추천은 없다.",
    input: obj({}),
    run: async (c) => {
      const rfq = await ownRfq(c);
      if (!rfq) return notFound();
      if (!comparisonOpened(rfq)) return { status: 409, body: { error: "not_open" } };
      const d = await getRfqDetail(rfq);
      const detail = await loadDetail(rfq.id);
      return { status: 200, body: compareView(rfq, d.quotes, detail) as unknown as Record<string, unknown> };
    },
  },
  {
    name: "contract_draft_view", role: "requester", scope: "rfq", level: "read", area: "contract", label: "받은 계약서(안) 보기", tool: true,
    description: "선정한 기관이 보낸 계약서(안)를 읽는다. 받기 전이면 not_sent.",
    input: obj({}),
    run: async (c) => {
      const rfq = await ownRfq(c);
      if (!rfq) return notFound();
      const [award, sentAt] = await Promise.all([awardForRfq(rfq.id), draftSentAt(rfq.id)]);
      if (!award || !sentAt) return { status: 409, body: { error: "not_sent" } };
      const draft = await draftForAward(award);
      return draft ? { status: 200, body: { sentAt, draft: draft as unknown as Record<string, unknown>, path: `/app/r/${rfq.rfq_no}/contract` } } : notFound();
    },
  },
  { name: "support_send", role: "requester", scope: "org", level: "confirm", area: "brief", label: "단추에 문의", description: "단추 운영자에게 문의를 보낸다. 답변은 계정 이메일로 온다.", input: SUPPORT_INPUT, run: supportRun },
  {
    name: "file_text", role: "requester", scope: "rfq", level: "read", area: "intake", label: "첨부 읽기", tool: true,
    description: "내 요청 첨부의 목록, 또는 한 파일의 글(PDF·한글 hwp/hwpx·Word doc/docx·Excel xls/xlsx·PowerPoint). 3만 자에서 자른다. 이미지와 글 없는 PDF(스캔본)는 media(base64)로 준다.",
    input: FILE_INPUT, run: fileTextRun,
  },
  { name: "notifications", role: "requester", scope: "org", level: "read", area: "brief", label: "알림 보기", tool: true, description: "내 알림 최근 30개를 읽는다.", input: NOTI_INPUT, run: myNotifications },
  { name: "notifications_read", role: "requester", scope: "org", level: "auto", area: "brief", label: "알림 읽음", tool: true, description: "알림을 읽음으로 표시한다.", input: NOTI_READ_INPUT, run: async (c) => callAs(c.s, c.req, notificationsRead, {}, c.body) },

  // ─ 기관: 받은 요청 ─
  { name: "join", role: "cro", scope: "rfq", level: "confirm", area: "intake", label: "참여", description: "받은 요청에 참여한다. 이용 조건 판(terms)을 그대로 넘긴다.", input: passthrough("단추 참여 본문"), run: viaInvite(join) },
  { name: "decline", role: "cro", scope: "rfq", level: "confirm", area: "intake", label: "불참", description: "받은 요청에 참여하지 않는다.", input: passthrough("단추 불참 본문"), run: viaInvite(decline) },
  {
    name: "qna_view", role: "cro", scope: "rfq", level: "read", area: "qna", label: "질의응답 보기", tool: true,
    description: "참여한 요청의 우리 기관 질의응답과 의뢰자가 모두에게 공개한 답변, 질의·답변 가능 여부, 답할 질의 수, 주제·시험 행 목록. 참여 전이면 not_joined.",
    input: obj({}),
    run: async (c) => {
      const inv = await inviteForOrg(c.no!, c.s.org!.id);
      const rfq = inv ? await getRfqByNo(c.no!) : null;
      if (!inv || !rfq) return notFound();
      if (!(await joinedInvite(inv.id))) return { status: 409, body: { error: "not_joined" } };
      const qna = await loadCroQna(inv.id, rfq.id);
      return qna ? { status: 200, body: { qna, topics: QNA_TOPICS.map(([id, label]) => ({ id, label })) } } : notFound();
    },
  },
  { name: "ask", role: "cro", scope: "rfq", level: "confirm", area: "qna", label: "의뢰자에게 질의", description: "참여 뒤 비교표가 열리기 전까지 의뢰자에게 질의를 보낸다(투여 경로·물질 보유량 등).", input: CRO_ASK_INPUT, run: viaInvite(croQna, { withAction: "ask" }) },
  { name: "answer", role: "cro", scope: "rfq", level: "confirm", area: "qna", label: "의뢰자 질의에 답변", description: "의뢰자 질의에 답한다.", input: CRO_ANSWER_INPUT, run: viaInvite(croQna, { withAction: "answer" }) },
  { name: "quote_draft", role: "cro", scope: "rfq", level: "auto", area: "quote", label: "견적 임시 저장", description: "견적 초안을 단추에 임시 저장한다(의뢰자에게 보이지 않는다). 금액은 단추 계산 또는 사람이 넣은 값.", input: passthrough("단추 회신 본문"), run: viaInvite(saveQuote, { method: "PUT" }) },
  { name: "quote_upload", role: "cro", scope: "rfq", level: "auto", area: "quote", label: "견적서 PDF 올릴 주소", description: "견적서 PDF를 올릴 주소를 받는다(선택 첨부).", input: obj({ name: str("파일 이름"), size: { type: "integer", minimum: 1 }, type: str("파일 형식", 60) }, ["name", "size"]), run: viaInvite(uploadUrl) },
  {
    name: "quote_price", role: "cro", scope: "rfq", level: "read", area: "quote", label: "견적 금액 계산", feature: "quote_tool",
    description: "요청 행마다 견적서 툴로 금액을 계산한다(독성·약동학·개별 분석·효력). 이 요청으로 만든 견적서가 있으면 그 값을 읽는다. 표준가·단가가 없는 행은 금액을 내지 않는다.",
    input: obj({}),
    run: async (c) => {
      const got = await requestFor(c);
      if ("status" in got) return got;
      return { status: 200, body: { price: await priceRequest(c.s.org!.id, c.s.org!.name, got.input) } };
    },
  },
  {
    name: "quote_doc", role: "cro", scope: "rfq", level: "auto", area: "quote", label: "견적서 만들기", feature: "quote_tool",
    description: "이 요청으로 견적서 툴 견적서를 만든다(이미 있으면 그것). 의뢰자에게 보이지 않는다.",
    input: obj({}),
    run: async (c) => {
      const got = await requestFor(c);
      if ("status" in got) return got;
      const r = await createDocFromRequest(c.s.org!.id, c.s.org!.name, c.s.userId, got.input);
      if (!r.id) return { status: 500, body: { error: "unavailable" } };
      const doc = await docForInvite(c.s.org!.id, got.input.inviteId);
      return { status: 200, body: { ok: true, docId: r.id, docNo: doc?.docNo ?? null, created: !!r.created, path: `/cro/docs/${r.id}/fill` } };
    },
  },
  {
    name: "quote_doc_get", role: "cro", scope: "rfq", level: "read", area: "quote", label: "견적서 보기", feature: "quote_tool", tool: true,
    description: "이 요청으로 만든 견적서의 시험 줄(조건·군 구성·옵션·기간), 단추가 계산한 금액, 저장 판(updatedAt)을 읽는다. source=manual 이고 금액 0인 줄은 시험 목록·단가표에 맞는 항목이 없어 담당자가 금액을 넣어야 한다.",
    input: obj({}),
    run: async (c) => {
      const got = await docFor(c);
      if ("status" in got) return got;
      return { status: 200, body: docView(got.head.head, got.head.data) as unknown as Record<string, unknown> };
    },
  },
  {
    name: "quote_doc_edit", role: "cro", scope: "rfq", level: "confirm", area: "quote", label: "견적서 설계 고치기", feature: "quote_tool",
    description: "견적서의 설계(군별 동물 수, 조건, 옵션 켜기·끄기, 수량, 기간, 고친 이유, 확인할 것, 거래 조건 글)만 바꾼다. 금액 칸은 받지 않고, 바꾸기 전·후 금액은 단추가 계산해 돌려준다. updatedAt 이 지금 판과 다르면 409 changed.",
    input: obj({ updatedAt: str("quote_doc_get 의 updatedAt", 64), tests: { type: "array", maxItems: 30, items: { type: "object" } }, terms: { type: "object" } }, ["updatedAt"]),
    run: async (c) => {
      const got = await docFor(c);
      if ("status" in got) return got;
      const { updatedAt: _v, ...rest } = c.body;
      const e = parseDocEdits(rest);
      if (typeof e === "string") return editErr(e);
      const r = applyDocEdits(got.head.data, e);
      if (typeof r === "string") return editErr(r);
      return saveDocAs(c, got, r.data, { diffs: r.diffs, before: r.before, after: r.after });
    },
  },
  {
    name: "quote_doc_set_amount", role: "cro", scope: "rfq", level: "confirm", area: "quote", label: "견적서 금액 넣기", feature: "quote_tool",
    description: "사람이 앱 입력란에 넣은 금액을 적는다. 시험 목록·단가표에 금액이 없는 줄(uid)과 할인(discount)만. 비서 도구가 아니다.",
    input: obj({ updatedAt: str("quote_doc_get 의 updatedAt", 64), uid: str("시험 줄", 64), amount: { type: "integer", minimum: 0 }, label: str("금액 줄 이름", 80), discount: { type: "integer", minimum: 0 } }, ["updatedAt"]),
    run: async (c) => {
      const got = await docFor(c);
      if ("status" in got) return got;
      const r = setManualAmount(got.head.data, c.body);
      if (typeof r === "string") return editErr(r);
      return saveDocAs(c, got, r, {});
    },
  },
  {
    name: "quote_doc_preview", role: "cro", scope: "rfq", level: "read", area: "quote", label: "견적서 미리보기", feature: "quote_tool", tool: true,
    description: "견적서 미리보기·인쇄 화면과 엑셀 내려받기 주소(단추 웹, 로그인 필요)를 돌려준다.",
    input: obj({}),
    run: async (c) => {
      const got = await docFor(c);
      if ("status" in got) return got;
      const id = got.head.head.id;
      return { status: 200, body: { docId: id, docNo: got.head.head.docNo, print: `/cro/docs/${id}/print`, edit: `/cro/docs/${id}`, xlsx: `/api/cro/docs/${id}/xlsx` } };
    },
  },
  {
    name: "quote_submit_preview", role: "cro", scope: "rfq", level: "read", area: "quote", label: "제출 미리보기", feature: "quote_tool",
    description: "견적 제출(quote_submit)이 줄마다 채울 금액(할인 반영)·기간·설계 설명과 견적서 판(updatedAt)을 미리 읽는다. 앱 견적 확인 카드가 그대로 보이고, 제출 때 docUpdatedAt 으로 판을 넘긴다. 비서 도구가 아니다.",
    input: obj({}),
    run: async (c) => {
      const got = await docFor(c);
      if ("status" in got) return got;
      const q = await loadQuote(got.inv.token, { markOpened: false });
      if (!q) return notFound();
      const h = got.head.head;
      return { status: 200, body: { docId: h.id, docNo: h.docNo, updatedAt: h.updatedAt, path: `/cro/docs/${h.id}/fill`, ...submitPreview(got.head.data, new Map(q.rfq.rows.map((x) => [x.seq, x.name]))) } };
    },
  },
  {
    name: "quote_from_doc", role: "cro", scope: "rfq", level: "confirm", area: "quote", label: "견적서 금액으로 회신 채우기", feature: "quote_tool",
    description: "견적서의 시험별 금액(할인을 줄마다 나눠 반영)·기간·설계 설명을 회신 초안에 옮겨 임시 저장한다. 가능 여부는 바꾸지 않는다. 금액을 못 채운 줄은 empty, 요청서와 시험 이름이 달라진 줄은 mismatched 로 돌려준다.",
    input: obj({}),
    run: async (c) => {
      const got = await docFor(c);
      if ("status" in got) return got;
      return editDraft(c, (d) => {
        const names = new Map(d.rows.map((r) => [r.seq, r.name]));
        const mismatched = got.head.data.tests.filter((t) => typeof t.rfqSeq === "number" && t.item && names.has(t.rfqSeq) && names.get(t.rfqSeq) !== t.item).map((t) => t.rfqSeq as number);
        const data = { ...got.head.data, tests: got.head.data.tests.filter((t) => !mismatched.includes(t.rfqSeq as number)) };
        const r = replyFromDoc(data, d.items);
        return { items: r.items, common: d.common, extra: { filled: r.filled, empty: r.empty.filter((x) => !mismatched.includes(x)), mismatched, docNo: got.head.head.docNo } };
      });
    },
  },
  {
    name: "quote_reply_fields", role: "cro", scope: "rfq", level: "confirm", area: "quote", label: "회신 칸 고치기",
    description: "회신 초안의 금액 아닌 칸만 고쳐 임시 저장한다: 줄별 가능 여부(가능·조건부 가능·불가)·사유·기간(주), 공통 조건(착수 가능일·유효기한·결제 조건·시험물질 필요량·보고서 언어). 금액은 받지 않는다.",
    input: obj({ items: { type: "array", items: { type: "object" } }, common: { type: "object" } }),
    run: async (c) => editDraft(c, (d) => {
      const r = applyReplyFields(d, c.body);
      return typeof r === "string" ? editErr(r) : r;
    }),
  },
  {
    name: "quote_submit", role: "cro", scope: "rfq", level: "confirm", area: "quote", label: "견적 제출",
    description: "견적을 의뢰자에게 제출한다. 금액은 이 요청의 견적서(시험 목록 표준가·추가/차감 단가·효력 단가표 계산과 사람이 넣은 금액)에서 단추가 채운다. 본문 금액은 쓰지 않는다. 견적서가 없으면 doc_missing, 금액 없는 줄은 amount_missing, 시험 이름이 달라진 줄은 mismatched. docUpdatedAt(제출 미리보기의 판)을 넘기면 판이 바뀌었거나 본문 금액이 견적서와 다를 때 changed.",
    input: passthrough("단추 회신 본문"),
    run: async (c) => {
      const got = await docFor(c);
      if ("status" in got) return got.body.error === "doc_missing" ? { status: 409, body: { error: "doc_missing" } } : got;
      const items = Array.isArray(c.body.items) ? (c.body.items as import("./cro-data").ReplyItem[]) : null;
      if (!items || items.some((it) => !it || typeof it.seq !== "number")) return bad();
      const q = await loadQuote(got.inv.token, { markOpened: false });
      if (!q) return notFound();
      const stale = docVersionErr(c, got.head.head);
      if (stale) return stale;
      const r = submitFromDoc(got.head.data, items, new Map(q.rfq.rows.map((x) => [x.seq, x.name])));
      if (!r.ok) return { status: 409, body: { error: r.error, seqs: r.seqs, docNo: got.head.head.docNo } };
      const moved = docVersionErr(c, got.head.head, { before: items, after: r.items });
      if (moved) return moved;
      const out = await viaInvite(submitQuote, { mark: true })({ ...c, body: { ...withoutDocVersion(c.body), items: r.items } });
      return out.status === 200 ? { ...out, body: { ...out.body, docNo: got.head.head.docNo, overridden: r.overridden } } : out;
    },
  },
  {
    name: "detail_view", role: "cro", scope: "rfq", level: "read", area: "quote", label: "2차 상세 요청 보기", tool: true,
    description: "우리 기관이 받은 2차 상세 요청: 바뀐 조건·새 조건, 1차 견적 줄, 회신 기한·상태, 보낸 회신. 받지 않았으면 not_target.",
    input: obj({}),
    run: async (c) => {
      const inv = await inviteForOrg(c.no!, c.s.org!.id);
      const rfq = inv ? await getRfqByNo(c.no!) : null;
      if (!inv || !rfq) return notFound();
      const d = await loadDetailForInvite(inv.id, rfq.id, testOptions((rfq.payload ?? {}) as Values));
      if (!d) return { status: 409, body: { error: "not_target" } };
      return { status: 200, body: { detail: { ...d, canReply: d.status === "sent" && !d.expired && !d.closed } } };
    },
  },
  {
    name: "detail_reply", role: "cro", scope: "rfq", level: "confirm", area: "quote", label: "2차 회신",
    description: "2차 상세 요청에 회신한다(mode keep·revise·decline). revise 의 줄 금액은 이 요청의 견적서(2차 조건으로 고친 설계)에서 단추가 채운다. 본문 금액은 쓰지 않는다. docUpdatedAt 은 quote_submit 과 같다.",
    input: passthrough("단추 2차 회신 본문"),
    run: async (c) => {
      if (c.body.mode !== "revise") return viaInvite(detailReply)(c);
      const got = await docFor(c);
      if ("status" in got) return got.body.error === "doc_missing" ? { status: 409, body: { error: "doc_missing" } } : got;
      const items = Array.isArray(c.body.items) ? (c.body.items as import("./cro-data").ReplyItem[]) : null;
      if (!items || items.some((it) => !it || typeof it.seq !== "number")) return bad();
      const q = await loadQuote(got.inv.token, { markOpened: false });
      if (!q) return notFound();
      const stale = docVersionErr(c, got.head.head);
      if (stale) return stale;
      const r = submitFromDoc(got.head.data, items, new Map(q.rfq.rows.map((x) => [x.seq, x.name])));
      if (!r.ok) return { status: 409, body: { error: r.error, seqs: r.seqs, docNo: got.head.head.docNo } };
      const moved = docVersionErr(c, got.head.head, { before: items, after: r.items });
      if (moved) return moved;
      return viaInvite(detailReply)({ ...c, body: { ...withoutDocVersion(c.body), items: r.items } });
    },
  },
  {
    name: "contract_status", role: "cro", scope: "rfq", level: "read", area: "contract", label: "계약 진행 보기", tool: true,
    description: "선정된 요청의 계약 체결 보고 상태, 선정 견적 금액과 차이 사유 규칙, 의뢰자 확인 여부, 지금 할 수 있는 동작(보고·정정). 선정 전이면 not_awarded.",
    input: obj({}),
    run: async (c) => {
      const lite = await awardForOrgByRfq(c.s.org!.id, c.no!);
      if (!lite) return { status: 409, body: { error: "not_awarded" } };
      const got = await contractRow({ awardId: lite.id });
      const rfq = got ? await getRfqByNo(c.no!) : null;
      if (!got || !rfq) return notFound();
      return { status: 200, body: { contract: contractView("cro", got.award, rfq.status, got.quoteAmount) } };
    },
  },
  {
    name: "contract_report", role: "cro", scope: "rfq", level: "confirm", area: "contract", label: "계약 체결 보고", description: "선정 뒤 계약 체결을 단추에 보고한다.", input: passthrough("단추 계약 보고 본문"),
    run: async (c) => {
      const inv = await inviteForOrg(c.no!, c.s.org!.id);
      const awardId = inv ? await awardForInvite(inv.id) : null;
      if (!awardId) return notFound();
      return callAs(c.s, c.req, contractReport, { id: awardId }, c.body);
    },
  },

  // ─ 기관: 계약서(안) (2026-11-20, 서명 전까지) ─
  {
    name: "contract_draft", role: "cro", scope: "rfq", level: "read", area: "contract", label: "계약서(안) 보기",
    description: "선정된 견적으로 만든 계약서(안)의 금액·조항 수와 단추 화면 주소, 의뢰자에게 보냈는지. 선정 전이면 404.",
    input: obj({}),
    run: async (c) => {
      const award = await awardForOrgByRfq(c.s.org!.id, c.no!);
      if (!award) return notFound();
      const [draft, sentAt] = await Promise.all([draftForAward(award), draftSentAt(award.rfq_id)]);
      if (!draft) return notFound();
      return { status: 200, body: { draft: { awardId: award.id, path: `/cro/awards/${award.id}/contract`, tests: draft.tests.length, supply: draft.supply, vat: draft.vat, total: draft.total, articles: draft.articles.length, sentAt, contractStatus: award.contract_status } } };
    },
  },
  {
    name: "contract_draft_send", role: "cro", scope: "rfq", level: "confirm", area: "contract", label: "계약서(안) 보내기",
    description: "계약서(안)을 의뢰자에게 보낸다(요청 기록과 의뢰자 알림). 서명은 단추 밖에서 한다.",
    input: obj({}),
    run: async (c) => {
      const award = await awardForOrgByRfq(c.s.org!.id, c.no!);
      if (!award) return notFound();
      const r = await sendDraft(award, c.s.userId);
      return r.ok ? { status: 200, body: { ok: true, sentAt: r.sentAt } } : { status: r.status, body: { error: r.error } };
    },
  },

  // ─ 기관: 브리핑·보고 (읽기) ─
  {
    name: "brief", role: "cro", scope: "org", level: "read", area: "brief", label: "오늘 브리핑", feature: "crm",
    description: "오늘 할 일, 손이 필요한 안건(회신 기한·계약 결과 보고·견적 유효기간·다음 할 일 없음), 진행 중 안건·할 일·일정·고객사·담당자 목록. 금액 없음.",
    input: obj({}),
    run: async (c) => {
      const b = await loadCrmSynced(c.s.org!.id, { userId: c.s.userId });
      if (!b.data.ready) return { status: 503, body: { error: "unavailable" } };
      return { status: 200, body: { brief: buildBrief({ data: b.data, danchu: b.danchu, me: c.s.userId }) } };
    },
  },
  {
    name: "report", role: "cro", scope: "org", level: "read", area: "report", label: "기간 보고", feature: "crm",
    description: "기간 안의 새 안건·수주·실패·수주율·실패 사유·담당자별 활동. 코드가 계산한다. 기간이 없으면 이번 주.",
    input: obj({ from: ymd("시작일"), to: ymd("끝일") }),
    run: async (c) => {
      const b = await loadCrmSynced(c.s.org!.id, { userId: c.s.userId });
      if (!b.data.ready) return { status: 503, body: { error: "unavailable" } };
      return { status: 200, body: { report: buildAgentReport(b.data, reportRange(c.body.from, c.body.to)) } };
    },
  },

  // ─ 기관: 고객관리·일정 (바로 실행, 되돌리기) ─
  {
    name: "crm_activity", role: "cro", scope: "org", level: "auto", area: "crm", label: "기록 남기기", tool: true, feature: "crm", target: { kind: "activities", op: "create" },
    description: "이미 있었던 미팅·통화·메일·메모를 안건이나 고객사에 기록한다. 앞으로의 약속은 일정(event_create)으로.",
    input: obj({ deal_id: ref("deal", "안건"), company_id: ref("company", "고객사(안건이 없을 때)"), contact_id: ref("contact", "상대 담당자"), kind: oneOf(ACT_KINDS, "meeting 미팅, call 통화, email 메일, memo 메모"), title: str("제목"), body: str("내용", 4000), date: ymd("있었던 날(없으면 오늘)"), time: hm("시각") }, ["kind"]),
    run: viaCrm("activities"),
  },
  {
    name: "task_create", role: "cro", scope: "org", level: "auto", area: "crm", label: "할 일 만들기", tool: true, feature: "tests", target: { kind: "tasks", op: "create" },
    description: "할 일을 만든다. 담당자를 정하면 그 사람에게, 아니면 시킨 사람에게.",
    input: obj({ title: str("할 일"), due_on: ymd("기한"), category: oneOf(TASK_CATS, "contact 연락, reply 회신, material 자료 준비, meeting 미팅 준비, internal 내부, other 기타"), assignee: ref("member", "맡을 기관 담당자"), deal_id: ref("deal", "안건"), memo: str("메모", 1000) }, ["title"]),
    run: async (c) => viaCrm("tasks")({ ...c, body: { ...c.body, assignee: c.body.assignee ?? c.s.userId } }),
  },
  {
    name: "task_update", role: "cro", scope: "org", level: "auto", area: "crm", label: "할 일 고치기", tool: true, feature: "tests", target: { kind: "tasks", op: "update" },
    description: "할 일의 제목·기한·담당자·메모를 고치거나 끝냄 표시를 한다.",
    input: obj({ id: ref("task", "할 일"), title: str("할 일"), due_on: ymd("기한"), assignee: ref("member", "맡을 기관 담당자"), memo: str("메모", 1000), done: { type: "boolean", description: "끝냄(true)·다시 열기(false)" } }, ["id"]),
    run: viaCrm("tasks", "PATCH"),
  },
  {
    name: "event_create", role: "cro", scope: "org", level: "auto", area: "calendar", label: "일정 잡기", tool: true, feature: "tests", target: { kind: "events", op: "create" },
    description: "우리 기관 캘린더에 일정을 잡는다(상대에게 초대를 보내지 않는다).",
    input: obj({ title: str("일정 제목"), kind: oneOf(EVENT_KINDS, "meeting 미팅, call 통화, deadline 기한, other 기타"), date: ymd("날짜"), start: hm("시작"), end: hm("끝"), all_day: { type: "boolean", description: "하루 종일" }, mode: oneOf(EVENT_MODES, "in_person 대면, video 화상, phone 전화"), location: str("장소", 300), deal_id: ref("deal", "안건"), requests: str("준비할 것", 1000) }, ["title", "date"]),
    run: viaCrm("events"),
  },
  {
    name: "event_update", role: "cro", scope: "org", level: "auto", area: "calendar", label: "일정 고치기", tool: true, feature: "tests", target: { kind: "events", op: "update" },
    description: "일정의 날짜·시간·제목·장소를 바꾸거나 끝냄 표시를 한다. 날짜를 바꿀 때는 시작 시간도 함께.",
    input: obj({ id: ref("event", "일정"), title: str("일정 제목"), date: ymd("날짜"), start: hm("시작"), end: hm("끝"), all_day: { type: "boolean" }, location: str("장소", 300), done: { type: "boolean", description: "끝냄" } }, ["id"]),
    run: viaCrm("events", "PATCH"),
  },
  {
    name: "deal_move", role: "cro", scope: "org", level: "auto", area: "crm", label: "안건 단계 옮기기", tool: true, feature: "crm", target: { kind: "deals", op: "move" },
    description: "안건 단계(문의·견적·협의·접수·계약)를 옮기거나 수주·실패로 닫는다. 실패면 사유를 고른다. 금액은 받지 않는다.",
    input: obj({ id: ref("deal", "안건"), stage: oneOf(STAGES, "inquiry 문의, quote 견적, negotiation 협의, intake 접수, contract 계약"), status: oneOf(STATUSES, "open 진행, won 수주, lost 실패"), reason: oneOf(LOST_REASONS, "실패 사유"), note: str("메모", 1000) }, ["id"]),
    run: async (c) => {
      // 금액(won_amount)은 비서가 넣지 않는다. 수주 금액은 안건 금액을 따르고, 고칠 때는 사람이 단추 화면에서
      const { won_amount: _w, follow_up_on: _f, ...body } = c.body;
      return viaCrm("move")({ ...c, body });
    },
  },
  {
    name: "deal_assign", role: "cro", scope: "org", level: "auto", area: "crm", label: "안건 넘기기", tool: true, feature: "crm", target: { kind: "deals", op: "update" },
    description: "안건 담당 영업을 같은 기관의 다른 담당자로 바꾼다(팀 넘기기). 넘기며 맡길 일이 있으면 task_create 를 함께.",
    input: obj({ id: ref("deal", "안건"), owner: ref("member", "새 담당자") }, ["id", "owner"]),
    run: async (c) => viaCrm("deals", "PATCH")({ ...c, body: { id: c.body.id, owner: c.body.owner } }),
  },
  {
    name: "approval_request", role: "cro", scope: "org", level: "auto", area: "crm", label: "결재 요청", tool: true, feature: "tests", target: { kind: "tasks", op: "create" },
    description: "같은 기관 결재자에게 결재 요청을 할 일로 맡긴다(제목 앞에 [결재]). 결재자가 단추 할 일에서 끝냄을 누르면 결재된 것. 기관 밖으로 나가지 않는다.",
    input: obj({ title: str("결재할 내용", 180), approver: ref("member", "결재자"), due_on: ymd("기한"), deal_id: ref("deal", "안건"), memo: str("메모", 1000) }, ["title", "approver"]),
    run: async (c) => {
      const { approver, title, assignee: _a, category: _c, ...rest } = c.body;
      return viaCrm("tasks")({ ...c, body: { ...rest, title: `[결재] ${String(title ?? "").slice(0, 180)}`, category: "internal", assignee: approver } });
    },
  },
  {
    name: "contact_create", role: "cro", scope: "org", level: "auto", area: "crm", label: "담당자 추가", tool: true, feature: "crm", target: { kind: "contacts", op: "create" },
    description: "고객사에 담당자를 추가한다. 안건을 고르면 그 안건에도 붙인다. 이메일·전화는 단추 화면에서 넣는다.",
    input: obj({ company_id: ref("company", "고객사"), name: str("이름", 100), title: str("직함", 60), dept: str("부서", 100), role: oneOf(CONTACT_ROLES, "decision 결정권자, user 실무, contract 계약, finance 정산, other 기타"), deal_id: ref("deal", "붙일 안건") }, ["company_id", "name"]),
    run: async (c) => {
      const { email: _e, phone: _p, mobile: _m, ...body } = c.body;
      return viaCrm("contacts")({ ...c, body });
    },
  },
  {
    name: "contact_update", role: "cro", scope: "org", level: "auto", area: "crm", label: "담당자 고치기", tool: true, feature: "crm", target: { kind: "contacts", op: "update" },
    description: "담당자의 이름·직함·부서·역할을 고친다.",
    input: obj({ id: ref("contact", "담당자"), name: str("이름", 100), title: str("직함", 60), dept: str("부서", 100), role: oneOf(CONTACT_ROLES, "역할") }, ["id"]),
    run: async (c) => {
      const { email: _e, phone: _p, mobile: _m, company_id: _co, ...body } = c.body;
      return viaCrm("contacts", "PATCH")({ ...c, body });
    },
  },
  {
    name: "crm_delete", role: "cro", scope: "org", level: "human", area: "crm", label: "기록 지우기",
    description: "고객사·담당자·안건·기록·일정·할 일 지우기는 사람이 단추 화면에서 한다.", input: obj({}),
  },

  // ─ 기관: 단가표 ─
  { name: "support_send", role: "cro", scope: "org", level: "confirm", area: "brief", label: "단추에 문의", description: "단추 운영자에게 문의를 보낸다. 답변은 계정 이메일로 온다.", input: SUPPORT_INPUT, run: supportRun },
  {
    name: "substance_send", role: "cro", scope: "rfq", level: "confirm", area: "contract", label: "시험물질 필요량 알리기",
    description: "선정된 요청에 시험물질 필요량과 보낼 시점을 적어 의뢰자에게 알린다. 다시 보내면 고친 값으로 바꾼다.",
    input: obj({ qty: str("필요량(예: 50 g)", 200), when: str("보낼 시점", 200), note: str("메모", 500) }, ["qty"]),
    run: async (c) => {
      const award = await awardForOrgByRfq(c.s.org!.id, c.no!);
      if (!award) return { status: 409, body: { error: "not_awarded" } };
      return callAs(c.s, c.req, substancePost, { id: award.id }, c.body);
    },
  },
  {
    name: "catalog_view", role: "cro", scope: "org", level: "read", area: "price", label: "시험 목록 보기", feature: "tests", tool: true,
    description: "우리 기관 시험 목록(시험별 조합: 가능 여부·동물종·경로·군 구성·기간·포함 항목·표준가·옵션)을 읽는다. category 로 좁힐 수 있다.",
    input: obj({ category: str("대분류", 60) }),
    run: async (c) => {
      const cat = typeof c.body.category === "string" ? c.body.category : "";
      const rows = (await loadCatalog(c.s.org!.id)).filter((r) => !cat || r.category === cat);
      return { status: 200, body: { rows: rows.map((r) => ({ id: r.id, category: r.category, item: r.item, available: r.available, glp: r.glp, species: r.species, routes: r.routes, method: r.method, groups_ctrl: r.groups_ctrl, groups_test: r.groups_test, per_sex: r.per_sex, recovery_weeks: r.recovery_weeks, recovery_per_sex: r.recovery_per_sex, dosing: r.dosing, weeks: r.weeks, includes: r.includes, std_price: r.std_price ?? null, options: r.options })) } };
    },
  },
  {
    name: "catalog_preview", role: "cro", scope: "org", level: "read", area: "price", label: "시험 목록 고칠 내용 보기", feature: "tests",
    description: "시험 목록에서 고칠 행·칸을 지금 값과 견준다(저장하지 않는다). 새 조합 만들기·지우기는 웹에서 한다.",
    input: obj({ rows: { type: "array", maxItems: 100, items: { type: "object" } } }, ["rows"]),
    run: async (c) => {
      const r = catalogPatch(await loadCatalog(c.s.org!.id), c.body.rows);
      return { status: 200, body: { diffs: r.diffs, errors: r.errors } };
    },
  },
  {
    name: "catalog_apply", role: "cro", scope: "org", level: "confirm", area: "price", label: "시험 목록 반영", feature: "tests",
    description: "사람이 미리보기를 확인한 시험 목록 수정을 반영한다. 틀린 칸이 하나라도 있으면 반영하지 않는다.",
    input: obj({ rows: { type: "array", maxItems: 100, items: { type: "object" } } }, ["rows"]),
    run: async (c) => {
      const cur = await loadCatalog(c.s.org!.id);
      const r = catalogPatch(cur, c.body.rows);
      if (r.errors.length) return { status: 400, body: { error: "invalid_rows", errors: r.errors } };
      if (!r.rows.length) return { status: 200, body: { ok: true, saved: 0, diffs: [] } };
      const out = await callAs(c.s, c.req, catalogSave, {}, { rows: r.rows, removed: [] });
      if (out.status !== 200) return out;
      const ids = new Set(r.rows.map((x) => x.id));
      return { status: 200, body: { ok: true, saved: out.body.saved ?? r.rows.length, diffs: r.diffs }, before: { rows: cur.filter((x) => ids.has(x.id)) as unknown as Record<string, unknown>[] } };
    },
  },
  {
    name: "crm_find", role: "cro", scope: "org", level: "read", area: "crm", label: "고객관리 찾기", feature: "crm", tool: true,
    description: "고객사·담당자·안건·할 일·일정을 이름으로 찾는다. 금액·이메일·전화·메모는 돌려주지 않는다.",
    input: obj({ q: str("찾을 말", 80), kinds: { type: "array", items: oneOf(["company", "contact", "deal", "task", "event"], "종류") } }),
    run: async (c) => {
      const d = await loadCrm(c.s.org!.id);
      const kinds = Array.isArray(c.body.kinds) ? (c.body.kinds as ("company" | "contact" | "deal" | "task" | "event")[]) : undefined;
      return { status: 200, body: { hits: crmFind(d, typeof c.body.q === "string" ? c.body.q : "", kinds) } };
    },
  },
  {
    name: "billing_view", role: "cro", scope: "org", level: "read", area: "report", label: "청구서 보기", tool: true,
    description: "우리 기관 월 청구서 목록(월·금액·납부 기한·상태)을 읽는다.",
    input: obj({}),
    run: async (c) => {
      const sb = getSupabaseAdmin();
      if (!sb) return { status: 503, body: { error: "unavailable" } };
      const { data } = await sb.from("billing_invoices").select("id, invoice_no, month, total, due_date, status, paid_on").eq("org_id", c.s.org!.id).neq("status", "void").order("month", { ascending: false }).limit(24);
      const today = todaySeoul();
      return { status: 200, body: { invoices: (data ?? []).map((x) => ({ invoiceNo: x.invoice_no, month: x.month, total: x.total, dueDate: x.due_date, paidOn: x.paid_on, state: INVOICE_VIEW_LABEL[invoiceView(x, today)] })), path: "/cro/billing" } };
    },
  },
  {
    name: "file_text", role: "cro", scope: "rfq", level: "read", area: "intake", label: "요청 첨부 읽기", tool: true,
    description: "참여한 요청의 첨부 목록, 또는 한 파일의 글(PDF·한글·Word·Excel·PowerPoint). 선정 전에는 파일 이름이 '첨부 n'이고 본문의 의뢰자 회사명·담당자·연락처를 가린다(masked). 이미지·스캔 PDF 는 가릴 수 없어 선정 전에는 hidden_before_award, 선정 뒤에는 media(base64). 3만 자에서 자른다.",
    input: FILE_INPUT, run: fileTextRun,
  },
  { name: "notifications", role: "cro", scope: "org", level: "read", area: "brief", label: "알림 보기", tool: true, description: "내 알림 최근 30개를 읽는다.", input: NOTI_INPUT, run: myNotifications },
  { name: "notifications_read", role: "cro", scope: "org", level: "auto", area: "brief", label: "알림 읽음", tool: true, description: "알림을 읽음으로 표시한다.", input: NOTI_READ_INPUT, run: async (c) => callAs(c.s, c.req, notificationsRead, {}, c.body) },
  {
    name: "price_book", role: "cro", scope: "org", level: "read", area: "price", label: "단가표 보기", feature: "quote_tool", description: "기관 단가표를 읽는다.", input: obj({}),
    run: async (c) => callAs(c.s, c.req, async () => (await bookRead()) ?? Response.json({ error: "unavailable" }, { status: 503 }), {}, null, "GET"),
  },
  {
    name: "quote_history", role: "cro", scope: "org", level: "read", area: "quote", label: "과거 견적 찾기", tool: true, feature: "quote_tool",
    description: "우리 기관 견적서 툴 견적서를 낱말로 찾는다(시험 이름·물질·동물종·경로·견적번호). 결과는 화면 카드로만 보이고 금액은 단추가 계산한 값이다.",
    input: obj({ q: str("찾을 말(예: 28일 랫드 경구)", 100) }, ["q"]),
    run: async (c) => ({ status: 200, body: { hits: await findDocs(c.s.org!.id, typeof c.body.q === "string" ? c.body.q.slice(0, 100) : "", 10) } }),
  },
  {
    name: "price_book_preview", role: "cro", scope: "org", level: "read", area: "price", label: "단가표 비교", feature: "quote_tool", description: "단가 자료를 지금 단가표와 견준다(저장하지 않는다).", input: passthrough("{ rows }"),
    run: async (c) => callAs(c.s, c.req, (q) => bookImport(q), {}, { ...c.body, mode: "preview" }),
  },
  {
    name: "price_book_apply", role: "cro", scope: "org", level: "confirm", area: "price", label: "단가표 반영", feature: "quote_tool", description: "사람이 미리보기를 확인한 단가를 단가표에 반영한다.", input: passthrough("{ rows }"),
    run: async (c) => callAs(c.s, c.req, (q) => bookImport(q), {}, { ...c.body, mode: "apply" }),
  },
];

export function findAction(role: AgentRole, name: string): ActionDef | null {
  return AGENT_ACTIONS.find((a) => a.role === role && a.name === name && !switchedOff(a.name)) ?? null;
}

/**
 * 기능 스위치: AGENT_ACTIONS_OFF=request_check,quote_doc 처럼 적은 액션은 목록에서 빼고 실행하지 않는다(404 bad_request 와 같게).
 * 에이전트는 목록을 10분 기억하므로 끈 뒤에도 잠깐 부를 수 있다. 그때도 여기서 막힌다
 */
export function switchedOff(name: string, env = process.env.AGENT_ACTIONS_OFF): boolean {
  return !!env && env.split(",").map((x) => x.trim()).includes(name);
}

/** 에이전트에 보여 줄 목록(실행 함수 없이). 요금제에 없는 기능은 뺀다 */
export function catalogFor(s: Pick<AgentSession, "role" | "org">): { name: string; scope: ActionDef["scope"]; level: ActionLevel; area: ActionArea; label: string; description: string; input: JsonSchema; tool: boolean }[] {
  return AGENT_ACTIONS.filter((a) => a.role === s.role && !switchedOff(a.name) && (!a.feature || s.role !== "cro" || !featureError(s.org, a.feature))).map((a) => ({
    name: a.name,
    scope: a.scope,
    level: a.level,
    area: a.area,
    label: a.label,
    description: a.description,
    input: a.input,
    tool: !!a.tool && (a.level === "auto" || a.level === "read"),
  }));
}

/** 등록부 판. 액션을 더하거나 모양을 바꾸면 올린다(에이전트가 목록을 다시 읽는다) */
export const CATALOG_VERSION = "2026-11-21.4";

/* ── 실행과 기록 ── */

type Row = Record<string, unknown> & { id: string; updated_at?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABLE: Record<CrmKind, "cro_crm_companies" | "cro_crm_contacts" | "cro_crm_deals" | "cro_crm_activities" | "cro_crm_events" | "cro_crm_tasks"> = {
  companies: "cro_crm_companies",
  contacts: "cro_crm_contacts",
  deals: "cro_crm_deals",
  activities: "cro_crm_activities",
  events: "cro_crm_events",
  tasks: "cro_crm_tasks",
};
/** 되돌리기에서 다시 쓰지 않는 칸 */
const FIXED = new Set(["id", "org_id", "created_by", "created_at", "updated_at"]);
/** 되돌리기 기간 (lib/retention.ts 가 이 뒤 before 를 비운다) */
export const UNDO_DAYS = RETENTION.agentUndoDays;

async function readRow(kind: CrmKind, id: string, orgId: string): Promise<Row | null> {
  const sb = getSupabaseAdmin();
  if (!sb || !UUID.test(id)) return null;
  const { data } = await sb.from(TABLE[kind]).select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  return (data as Row | null) ?? null;
}

/** 바꾸기 전 행에서, 바뀐 칸만 (순수 함수, 테스트 대상) */
export function changedBefore(before: Row, after: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    if (FIXED.has(k)) continue;
    if (JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) out[k] = before[k] ?? null;
  }
  return out;
}

export type RunResult = ActOut & { logId: string | null; undoable: boolean };

/**
 * 액션 하나 실행. 역할·번호·수준 검사 → 웹 처리 → (쓰기면) 실행 기록.
 * read 가 아니면 부르기 전에 쓰기 횟수 제한을 거친다(라우트가 한다).
 */
export async function runAgentAction(s: AgentSession, req: Request, name: string, no: string | null, body: Record<string, unknown>): Promise<RunResult> {
  const def = findAction(s.role, name);
  const out = (r: ActOut, logId: string | null = null, undoable = false): RunResult => ({ ...r, logId, undoable });
  if (!def) return out(AGENT_ACTIONS.some((a) => a.name === name && !switchedOff(a.name)) ? { status: 403, body: { error: "forbidden" } } : bad());
  if ((def.scope === "rfq") !== !!no) return out(bad());
  if (no && !/^DC-\d{4}-\d{4,6}$/.test(no)) return out(notFound());
  if (def.level === "human" || !def.run) return out({ status: 403, body: { error: "human_only" } });
  if (def.feature && s.role === "cro" && featureError(s.org, def.feature)) return out({ status: 403, body: { error: "plan_required" } });
  if (s.role === "cro" && !s.org) return out({ status: 403, body: { error: "org_not_ready" } });

  const orgId = s.role === "cro" ? s.org!.id : null;
  const t = def.target;
  const inputId = typeof body.id === "string" ? body.id : null;
  const before = t && t.op !== "create" && orgId && inputId ? await readRow(t.kind, inputId, orgId) : null;
  if (t && t.op !== "create" && !before) return out(notFound());

  const { before: runBefore, ...r } = await def.run({ s, req, no, body });
  if (def.level === "read" || r.status < 200 || r.status >= 300) return out(r);

  // 실행 기록. 기록이 실패해도 동작은 이미 끝났다(되돌리기만 못 한다)
  let targetId: string | null = null;
  let undo: "delete" | "patch" | "move" | null = null;
  let snapshot: Record<string, unknown> | null = null;
  let afterAt: string | null = null;
  if (t && orgId) {
    targetId = t.op === "create" ? (typeof r.body.id === "string" ? r.body.id : null) : inputId;
    const after = targetId ? await readRow(t.kind, targetId, orgId) : null;
    if (after) {
      afterAt = typeof after.updated_at === "string" ? after.updated_at : null;
      if (t.op === "create") undo = "delete";
      else if (before) {
        snapshot = changedBefore(before, after);
        undo = Object.keys(snapshot).length ? (t.op === "move" ? "move" : "patch") : null;
        if (!undo) snapshot = null;
      }
    }
  }
  // 견적서처럼 CRM 표가 아닌 것은 실행 함수가 돌려준 바꾸기 전 모습을 남긴다(되돌리기 버튼은 아직 없다)
  if (!snapshot && runBefore) snapshot = runBefore;
  const logId = await writeLog({ s, orgId, def, no, kind: t?.kind ?? null, targetId, undo, before: snapshot, afterAt, status: r.status });
  return out(r, logId, !!(logId && undo));
}

async function writeLog(a: { s: AgentSession; orgId: string | null; def: ActionDef; no: string | null; kind: CrmKind | null; targetId: string | null; undo: "delete" | "patch" | "move" | null; before: Record<string, unknown> | null; afterAt: string | null; status: number }): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("agent_action_log")
    .insert({
      user_id: a.s.userId,
      org_id: a.orgId,
      role: a.s.role,
      action: a.def.name,
      level: a.def.level === "auto" ? "auto" : "confirm",
      rfq_no: a.no,
      target_kind: a.kind,
      target_id: a.targetId,
      undo: a.undo,
      before: a.before,
      after_updated_at: a.afterAt,
      status: a.status,
    } as never)
    .select("id")
    .single();
  if (error || !data) {
    console.error("agent log", error?.code);
    return null;
  }
  return (data as { id: string }).id;
}

export type UndoError = "not_found" | "already_undone" | "not_undoable" | "expired" | "changed" | "unavailable";

/** 되돌리기 판정 (순수 함수, 테스트 대상) */
export function undoBlock(log: { undo: string | null; undone_at: string | null; created_at: string; before: unknown; after_updated_at: string | null }, current: { updated_at?: string } | null, now = Date.now()): UndoError | null {
  if (log.undone_at) return "already_undone";
  if (!log.undo || (log.undo !== "delete" && !log.before)) return "not_undoable";
  if (now - new Date(log.created_at).getTime() > UNDO_DAYS * 864e5) return "expired";
  if (!current) return log.undo === "delete" ? null : "changed";
  if (log.after_updated_at && current.updated_at !== log.after_updated_at) return "changed";
  return null;
}

/**
 * 바로 실행한 기관 기록을 되돌린다. 시킨 사람만, 7일 안, 그 뒤 아무도 고치지 않았을 때만.
 * 만든 것은 지우고, 고친 것은 바꾸기 전 칸으로, 안건 단계는 이력 한 줄과 함께 되돌린다.
 */
export async function undoAgentAction(s: AgentSession, logId: string, now = Date.now()): Promise<{ ok: true } | { ok: false; error: UndoError }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "unavailable" };
  if (!UUID.test(logId) || s.role !== "cro" || !s.org) return { ok: false, error: "not_found" };
  const orgId = s.org.id;
  const { data: log } = await sb.from("agent_action_log").select("*").eq("id", logId).eq("user_id", s.userId).eq("org_id", orgId).maybeSingle();
  if (!log) return { ok: false, error: "not_found" };
  const kind = log.target_kind as CrmKind | null;
  const current = kind && log.target_id ? await readRow(kind, log.target_id, orgId) : null;
  const block = undoBlock(log, current, now);
  if (block) return { ok: false, error: block };
  // 먼저 표시해 두 번 되돌리지 않게 한다
  const { data: claimed } = await sb.from("agent_action_log").update({ undone_at: new Date(now).toISOString() } as never).eq("id", logId).is("undone_at", null).select("id");
  if (!claimed?.length) return { ok: false, error: "already_undone" };
  const table = TABLE[kind!];
  let error: unknown = null;
  if (log.undo === "delete") {
    if (current) ({ error } = await sb.from(table).delete().eq("id", log.target_id!).eq("org_id", orgId));
  } else {
    ({ error } = await sb.from(table).update(log.before as never).eq("id", log.target_id!).eq("org_id", orgId));
    if (!error && log.undo === "move" && current) {
      const b = log.before as Record<string, unknown>;
      await sb.from("cro_crm_deal_history").insert({
        org_id: orgId, deal_id: log.target_id, from_stage: current.stage, to_stage: (b.stage as string | undefined) ?? current.stage,
        from_status: current.status, to_status: (b.status as string | undefined) ?? current.status, reason: "", actor: "member", created_by: s.userId,
      } as never);
    }
  }
  if (error) {
    await sb.from("agent_action_log").update({ undone_at: null } as never).eq("id", logId);
    console.error("agent undo", (error as { code?: string }).code);
    return { ok: false, error: "unavailable" };
  }
  return { ok: true };
}

/** 응답 본문에 실행 기록 id 를 붙인다(웹 처리 본문은 그대로) */
export function actResponse(r: RunResult) {
  return agentJson(r.logId ? { ...r.body, agentLog: { id: r.logId, undoable: r.undoable } } : r.body, r.status);
}

/** 참여한 초대인가(질의응답은 참여 뒤부터) */
async function joinedInvite(inviteId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { data } = await sb.from("rfq_invites").select("joined_at").eq("id", inviteId).maybeSingle();
  return !!data?.joined_at;
}

/** 선정 한 건(계약 진행 보기용)과 선정 견적 금액(선정 때 고정한 fee_basis_amount, 없으면 견적 총액) */
async function contractRow(by: { rfqId: string } | { awardId: string }) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const q = sb.from("rfq_awards").select("*");
  const { data: award } = await ("rfqId" in by ? q.eq("rfq_id", by.rfqId) : q.eq("id", by.awardId)).maybeSingle();
  if (!award) return null;
  const quote = award.fee_basis_amount == null ? (await sb.from("cro_quotes").select("total_amount").eq("id", award.quote_id).maybeSingle()).data : null;
  return { award, quoteAmount: award.fee_basis_amount ?? (quote?.total_amount as number | null | undefined) ?? null };
}

/** 우리 기관 초대로 받은 선정. 선정 전이면 null */
async function awardForInvite(inviteId: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("rfq_awards").select("id").eq("invite_id", inviteId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
