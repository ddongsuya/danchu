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
import { getRfqByNo } from "./data";
import { getSupabaseAdmin } from "./supabase";
import { featureError } from "./plan-usage";
import { awardForOrgByRfq, draftForAward, draftSentAt, sendDraft } from "./contract-draft-db";
import { createDocFromRequest, docForInvite, findDocs, priceRequest, requestInputFor, type RequestInput } from "./quote-doc-db";
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
export type ActOut = { status: number; body: Record<string, unknown> };
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

const QNA_INPUT = obj({ body: str("질의·답변 본문", 2000), questionId: str("답변할 질의 id(답변일 때)", 64) });

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
  { name: "ask", role: "requester", scope: "rfq", level: "confirm", area: "qna", label: "기관에 질의", description: "견적을 낸 기관에 질의를 보낸다.", input: QNA_INPUT, run: viaRfq(sponsorQna, { withAction: "ask" }) },
  { name: "answer", role: "requester", scope: "rfq", level: "confirm", area: "qna", label: "기관 질의에 답변", description: "기관이 보낸 질의에 답한다.", input: QNA_INPUT, run: viaRfq(sponsorQna, { withAction: "answer" }) },
  { name: "select", role: "requester", scope: "rfq", level: "confirm", area: "quote", label: "기관 선정", description: "비교표가 열린 뒤 견적 하나를 선정한다. 선정 사유를 함께 남긴다.", input: passthrough("단추 선정 본문"), run: viaRfq(select, { mark: "rfq_awards" }) },
  { name: "detail", role: "requester", scope: "rfq", level: "confirm", area: "quote", label: "2차 상세 요청", description: "기관에 2차 상세 견적을 요청한다.", input: passthrough("단추 2차 요청 본문"), run: viaRfq(detail, { mark: "rfq_details" }) },
  { name: "contract_confirm", role: "requester", scope: "rfq", level: "confirm", area: "contract", label: "계약 보고 확인", description: "기관의 계약 체결 보고를 확인하거나 이의를 남긴다.", input: passthrough("단추 계약 확인 본문"), run: viaRfq(contractConfirm) },
  { name: "contract_result", role: "requester", scope: "rfq", level: "confirm", area: "contract", label: "계약 결과 알림", description: "계약 결과를 단추에 알린다.", input: passthrough("단추 계약 결과 본문"), run: viaRfq(contractResult) },

  // ─ 기관: 받은 요청 ─
  { name: "join", role: "cro", scope: "rfq", level: "confirm", area: "intake", label: "참여", description: "받은 요청에 참여한다. 이용 조건 판(terms)을 그대로 넘긴다.", input: passthrough("단추 참여 본문"), run: viaInvite(join) },
  { name: "decline", role: "cro", scope: "rfq", level: "confirm", area: "intake", label: "불참", description: "받은 요청에 참여하지 않는다.", input: passthrough("단추 불참 본문"), run: viaInvite(decline) },
  { name: "ask", role: "cro", scope: "rfq", level: "confirm", area: "qna", label: "의뢰자에게 질의", description: "의뢰자에게 질의를 보낸다(투여 경로·물질 보유량 등).", input: QNA_INPUT, run: viaInvite(croQna, { withAction: "ask" }) },
  { name: "answer", role: "cro", scope: "rfq", level: "confirm", area: "qna", label: "의뢰자 질의에 답변", description: "의뢰자 질의에 답한다.", input: QNA_INPUT, run: viaInvite(croQna, { withAction: "answer" }) },
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
  { name: "quote_submit", role: "cro", scope: "rfq", level: "confirm", area: "quote", label: "견적 제출", description: "견적을 의뢰자에게 제출한다.", input: passthrough("단추 회신 본문"), run: viaInvite(submitQuote, { mark: true }) },
  { name: "detail_reply", role: "cro", scope: "rfq", level: "confirm", area: "quote", label: "2차 회신", description: "2차 상세 요청에 회신한다.", input: passthrough("단추 2차 회신 본문"), run: viaInvite(detailReply) },
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
export const CATALOG_VERSION = "2026-11-20.2";

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

  const r = await def.run({ s, req, no, body });
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

/** 우리 기관 초대로 받은 선정. 선정 전이면 null */
async function awardForInvite(inviteId: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("rfq_awards").select("id").eq("invite_id", inviteId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
