import { clientIp } from "@/lib/rate-limit";
import { NextResponse, after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { QuoteLineDef } from "@/lib/quote-items";
import { INCL_KEYS, MAX_STEPS, REPORT_LANGS, STEP_SEQ_BASE, type ReplyCommon, type ReplyItem, type ScheduleStep } from "@/lib/cro-data";
import { planQuote } from "@/lib/schedule";
import { closedMessage, loadQuote as load, type Loaded } from "@/lib/quote-load";
import { sessionOrNull } from "@/lib/auth";
import { adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { announceCompareOpened } from "@/lib/compare";
import { captureError } from "@/lib/observe";
import { todaySeoul, won } from "@/lib/format";
import { learnFromSubmission } from "@/lib/catalog-db";
import { saveQuote, type QuoteHeader, type QuoteItemInput } from "@/lib/rpc";
import { entrySourceFor, loadOptsFor, PROXY_BEFORE_JOIN, proxyEntryAllowed } from "@/lib/concierge";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF = 20 * 1024 * 1024;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

type PdfRef = { path: string; name: string; size: number };

/** 요청을 보낸 사람. 로그인 CRO·운영자면 계정, 토큰 접근이면 null */
type Actor = { userId: string; email: string; role: string } | null;
async function actorOf(): Promise<Actor> {
  const s = await sessionOrNull();
  return s ? { userId: s.userId, email: s.email, role: s.profile.role } : null;
}

/** GET — 회신 화면에 필요한 모든 것 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const a = await actorOf();
  const got = await load(token, loadOptsFor(a?.role));
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });
  // 참여 전(joined false)에는 rfq 가 요약이고 draft 는 null 이다 (lib/quote-load.ts rfqSummaryOf)
  // canRejoin: 참여 전 불참을 참여 결정 기한 전에 되돌릴 수 있는지 (2026-10-20 결정 3). 철회(withdrawn)는 되돌릴 수 없다
  return NextResponse.json({
    rfq: got.rfq,
    draft: got.draft,
    expired: got.expired,
    locked: got.locked,
    declined: got.declined,
    closed: got.closed,
    closedMessage: got.closed ? closedMessage(got.closedReason) : "",
    joined: got.joined,
    withdrawn: got.withdrawn,
    canRejoin: got.canRejoin,
    joinBy: got.joinBy,
  });
}

const LINK_GONE = "유효하지 않거나 만료된 링크입니다.";

/** save_quote 가 잠금 뒤 재검사에서 거절한 이유 (0021, 0023, 0025). closed 는 지금 닫힌 이유로 따로 안내한다 */
const SAVE_DENIED: Record<string, { error: string; status: number }> = {
  revoked: { error: `${LINK_GONE} 받은 요청 화면이나 단추(hello@danchu.kr)에서 새 링크를 받아 주세요.`, status: 403 },
  expired: { error: "링크가 만료되었습니다. 단추(hello@danchu.kr)에 연장을 요청해 주세요.", status: 403 },
  declined: { error: "불참으로 처리한 요청이라 저장할 수 없습니다. 참여 결정 기한 전이고 자리가 남아 있으면 요청 화면에서 다시 참여할 수 있습니다.", status: 403 },
  org_inactive: { error: "기관 참여가 중지되어 저장할 수 없습니다. 단추(hello@danchu.kr)에 문의해 주세요.", status: 403 },
  not_member: { error: "다른 기관 담당자 계정으로 로그인되어 있어 이 기관 견적을 저장할 수 없습니다. 이 기관의 견적이라면 로그아웃한 뒤 메일의 링크로 다시 열어 회신해 주세요.", status: 403 },
  // 0023: 기관 본인이 참여하기를 누르기 전에는 기관도 운영자(대리 입력)도 저장할 수 없다
  not_joined: { error: "기관이 이 요청에 참여한 뒤에 견적을 저장할 수 있습니다. 요청 화면에서 참여하기를 먼저 눌러 주세요.", status: 409 },
  // 철회는 되돌릴 수 없다 (2026-10-20 결정 3)
  withdrawn: { error: "참여를 철회한 요청입니다. 철회한 요청에는 다시 참여하거나 견적을 낼 수 없습니다.", status: 403 },
};

/**
 * 저장·제출이 막힌 상태면 그 이유와 상태 코드. 참여 전에는 기관도 운영자(대리 입력)도 저장할 수 없다 (0023).
 * 비교표가 열리면(compared_at) 제출한 견적도 더 고칠 수 없다 (2026-10-20 결정 1).
 * DB(save_quote)도 같은 규칙으로 다시 거절한다. 여기서는 화면 검사와 문구를 맡는다
 */
function blocked(got: Loaded): { error: string; status: number } | null {
  if (got.expired) return { error: "링크가 만료되었습니다. 단추(hello@danchu.kr)에 연장을 요청해 주세요.", status: 403 };
  if (got.locked) return { error: "회신 기한이 지나 제출한 견적을 수정할 수 없습니다.", status: 403 };
  if (got.closed) return { error: closedMessage(got.closedReason), status: 403 };
  if (got.withdrawn) return SAVE_DENIED.withdrawn;
  if (got.declined) {
    return got.canRejoin
      ? { error: "불참으로 처리한 요청입니다. 다시 참여하면 견적을 쓸 수 있습니다. 요청 화면에서 참여하기를 눌러 주세요.", status: 409 }
      : { error: "불참으로 처리한 요청입니다. 참여 결정 기한이 지나 다시 참여할 수 없습니다.", status: 403 };
  }
  if (!proxyEntryAllowed(got)) return got.operator ? { error: PROXY_BEFORE_JOIN, status: 409 } : SAVE_DENIED.not_joined;
  return null;
}

type Parsed = { items: ReplyItem[]; note: string; common: ReplyCommon; pdf?: PdfRef; steps: ScheduleStep[] };

const DESIGN_NUM = ["groups_ctrl", "groups_test", "per_sex", "recovery_weeks", "recovery_per_sex"] as const;
const DESIGN_STR = ["route", "dosing", "method"] as const;

/** 설계 요약: 정해진 키만, 정해진 형으로 */
function cleanDesign(d: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (Array.isArray(d.species)) out.species = (d.species as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 10);
  for (const k of DESIGN_NUM) {
    const v = d[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 9999) out[k] = Math.round(v);
    else if (typeof v === "string" && /^\d{1,4}$/.test(v)) out[k] = Number(v);
    else out[k] = null;
  }
  for (const k of DESIGN_STR) out[k] = typeof d[k] === "string" ? (d[k] as string).slice(0, 120) : null;
  // 기관의 설계 설명 (회복 동물 지정 방식, 분석법 검증 횟수 등 기관마다 다른 부분)
  out.note = typeof d.note === "string" && d.note.trim() ? d.note.slice(0, 1000) : null;
  if (d.extra && typeof d.extra === "object" && !Array.isArray(d.extra)) {
    const ex: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(d.extra as Record<string, unknown>).slice(0, 30)) {
      if (typeof v === "string") ex[k] = v.slice(0, 300);
      else if (Array.isArray(v)) ex[k] = v.filter((x): x is string => typeof x === "string").slice(0, 20);
    }
    out.extra = ex;
  }
  return out;
}

/** 항목 3칸 + 공통 조건 + 전달 사항 파싱 · 검증 */
function parseBody(raw: unknown, rows: QuoteLineDef[]): Parsed | string {
  const b = (raw ?? {}) as { items?: unknown; note?: unknown; common?: unknown; pdf?: unknown; steps?: unknown };
  const items = Array.isArray(b.items) ? (b.items as ReplyItem[]) : [];
  if (items.length !== rows.length) return "항목 수가 요청서와 다릅니다.";
  const seqs = new Set(rows.map((r) => r.seq));
  // 일정 단계 (0029): 101부터, 이름·주수·앞 단계만
  const rawSteps = Array.isArray(b.steps) ? (b.steps as unknown[]) : [];
  if (rawSteps.length > MAX_STEPS) return `일정 단계는 ${MAX_STEPS}개까지 넣을 수 있습니다.`;
  const steps: ScheduleStep[] = [];
  for (const x of rawSteps) {
    const st = (x ?? {}) as Partial<ScheduleStep>;
    if (typeof st.seq !== "number" || !Number.isInteger(st.seq) || st.seq < STEP_SEQ_BASE || st.seq >= STEP_SEQ_BASE + 100 || steps.some((y) => y.seq === st.seq)) return "일정 단계 번호가 올바르지 않습니다.";
    const name = typeof st.name === "string" ? st.name.trim().slice(0, 60) : "";
    const weeks = typeof st.weeks === "string" ? st.weeks.trim() : "";
    if (weeks && !/^\d{1,3}$/.test(weeks)) return "일정 단계 기간은 주 단위 숫자만 입력합니다.";
    steps.push({ seq: st.seq, name, weeks, after: Array.isArray(st.after) ? st.after.filter((n): n is number => typeof n === "number") : [] });
  }
  const known = new Set([...seqs, ...steps.map((st) => st.seq)]);
  const cleanAfter = (self: number, v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((n): n is number => typeof n === "number" && known.has(n) && n !== self))].slice(0, 20) : []);
  for (const st of steps) st.after = cleanAfter(st.seq, st.after);
  for (const it of items) {
    if (!it || typeof it !== "object" || !seqs.has(it.seq)) return "항목 번호가 요청서와 다릅니다.";
    if (!["", "가능", "조건부 가능", "불가"].includes(it.avail)) return "수행 가능 여부 값이 올바르지 않습니다.";
    if (it.amount && !/^\d{1,13}$/.test(it.amount)) return "금액은 숫자만 입력합니다.";
    if (it.weeks && !/^\d{1,3}$/.test(it.weeks)) return "기간은 주 단위 숫자만 입력합니다.";
    if (it.reason != null && typeof it.reason !== "string") return "사유 형식이 올바르지 않습니다.";
    if (typeof it.reason === "string") it.reason = it.reason.slice(0, 500);
    // 설계·출처·단가 (카탈로그 초안에서 오거나 CRO가 수정)
    it.design = it.design && typeof it.design === "object" && !Array.isArray(it.design) ? cleanDesign(it.design) : {};
    it.source = it.source === "catalog" || it.source === "learned" ? it.source : "manual";
    it.unit = it.unit === "per_sample" ? "per_sample" : "total";
    it.unitPrice = typeof it.unitPrice === "string" && /^\d{1,13}$/.test(it.unitPrice) ? it.unitPrice : "";
    it.sampleCount = typeof it.sampleCount === "string" && /^\d{1,6}$/.test(it.sampleCount) ? it.sampleCount : "";
    if (it.unit === "per_sample" && it.unitPrice && it.sampleCount) it.amount = String(Number(it.unitPrice) * Number(it.sampleCount));
    it.checks = Array.isArray(it.checks) ? it.checks.filter((x): x is string => typeof x === "string").slice(0, 30).map((x) => x.slice(0, 200)) : [];
    it.design.reviewChecks = it.checks;
    if (it.reportWeeks && !/^\d{1,3}$/.test(it.reportWeeks)) return "최종보고서까지 기간은 주 단위 숫자만 입력합니다.";
    if (it.translationWeeks && !/^\d{1,3}$/.test(it.translationWeeks)) return "번역 기간은 주 단위 숫자만 입력합니다.";
    it.reportWeeks = typeof it.reportWeeks === "string" ? it.reportWeeks : "";
    it.translationWeeks = typeof it.translationWeeks === "string" ? it.translationWeeks : "";
    it.afterSeqs = cleanAfter(it.seq, it.afterSeqs);
  }
  const c = (b.common && typeof b.common === "object" ? b.common : {}) as Partial<ReplyCommon>;
  const s = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const common: ReplyCommon = {
    validUntil: YMD.test(s(c.validUntil)) ? s(c.validUntil) : "",
    startDate: YMD.test(s(c.startDate)) ? s(c.startDate) : "",
    payTerms: s(c.payTerms, 60),
    substanceQty: s(c.substanceQty, 120),
    reportLang: REPORT_LANGS.includes(s(c.reportLang)) ? s(c.reportLang) : "",
    includes: Array.isArray(c.includes) ? (c.includes as unknown[]).filter((x): x is string => typeof x === "string" && INCL_KEYS.includes(x)) : [],
  };
  let pdf: PdfRef | undefined;
  if (b.pdf && typeof b.pdf === "object") {
    const p = b.pdf as Partial<PdfRef>;
    if (typeof p.path !== "string" || typeof p.name !== "string" || typeof p.size !== "number") return "PDF 정보가 올바르지 않습니다.";
    if (p.size > MAX_PDF) return "PDF는 20MB 이하만 첨부할 수 있습니다.";
    pdf = { path: p.path, name: p.name.slice(0, 200), size: p.size };
  }
  return { items, note: typeof b.note === "string" ? b.note.slice(0, 2000) : "", common, pdf, steps: steps.filter((st) => st.name) };
}

async function upsert(got: Loaded, p: Parsed, submit: boolean, actor: Actor, who?: { ip: string; ua: string }) {
  const sb = getSupabaseAdmin()!;
  const actorId = actor?.userId ?? null;
  // 운영자가 회신 링크로 제출하면 기관 PDF 를 보고 옮겨 적은 대리 입력이다 (비교표 표기·카탈로그 학습 제외)
  const source = entrySourceFor(actor?.role);
  const { items, note, common, pdf, steps } = p;
  const total = items.reduce((a, it) => a + (it.avail !== "불가" && it.amount ? Number(it.amount) : 0), 0);
  const weeks = Math.max(0, ...items.map((it) => (it.avail !== "불가" && it.weeks ? Number(it.weeks) : 0)));
  // 기관이 적은 앞 단계·최종보고서·번역 주수로 계산한 최종보고서 주 (0029). 비교표 "최종보고서 빠른 순"의 기준
  const plan = planQuote({ rows: got.rfq.rows, items, steps });

  const header: QuoteHeader = {
    total_amount: total || null,
    total_weeks: weeks || null,
    vat: "별도",
    valid_until: common.validUntil || (submit ? new Date(Date.now() + 30 * 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) : null),
    auto: false,
    start_date: common.startDate || null,
    pay_terms: common.payTerms || null,
    substance_qty: common.substanceQty || null,
    report_lang: common.reportLang || null,
    includes: common.includes,
    note,
    // 입력 주체는 제출과 같은 트랜잭션에서 남긴다 (save_quote, 0019). 따로 갱신하다 실패하면 대리 입력이 기관 제출로 보인다
    entry_source: source,
    schedule_steps: steps.map((st) => ({ seq: st.seq, name: st.name, weeks: st.weeks ? Number(st.weeks) : null, after: st.after })),
    final_report_weeks: plan.finalReportWeek,
    final_weeks: plan.finalWeek,
  };

  if (pdf) {
    const dir = `${got.rfq.no}/${got.inviteId}`;
    if (!pdf.path.startsWith(`${dir}/`)) return { error: "PDF 경로가 올바르지 않습니다.", status: 400 };
    const file = pdf.path.slice(dir.length + 1);
    const { data: objs, error: le } = await sb.storage.from("cro-files").list(dir, { search: file, limit: 10 });
    if (le || !objs?.some((o) => o.name === file)) return { error: "PDF 업로드가 완료되지 않았습니다. 다시 첨부해 주세요.", status: 400 };
    header.pdf_path = pdf.path;
    header.pdf_name = pdf.name;
    header.pdf_size = pdf.size;
  }

  const rowsBySeq = new Map(got.rfq.rows.map((r) => [r.seq, r]));
  const itemRows: QuoteItemInput[] = items.map((it) => {
    const r = rowsBySeq.get(it.seq)!;
    return {
      seq: it.seq, category: r.category, name: r.name, cond: r.cond,
      avail: it.avail || null,
      amount: it.avail !== "불가" && it.amount ? Number(it.amount) : null,
      weeks: it.avail !== "불가" && it.weeks ? Number(it.weeks) : null,
      reason: it.reason || null,
      design: it.design ?? {},
      source: it.source ?? "manual",
      unit: it.unit ?? "total",
      unit_price: it.unit === "per_sample" && it.unitPrice ? Number(it.unitPrice) : null,
      sample_count: it.unit === "per_sample" && it.sampleCount ? Number(it.sampleCount) : null,
      report_weeks: it.avail !== "불가" && it.reportWeeks ? Number(it.reportWeeks) : null,
      translation_weeks: it.avail !== "불가" && it.translationWeeks ? Number(it.translationWeeks) : null,
      after_seqs: it.avail !== "불가" ? it.afterSeqs ?? [] : [],
    };
  });

  // 헤더 + 항목 + 초대 상태 + 요청 상태를 한 트랜잭션으로. 초안 저장은 제출본을 절대 덮지 않는다.
  // 토큰을 함께 넘긴다: 화면 검사 뒤 취소·담당자 제외(토큰 재발급)·기관 중지가 끼어들면 save_quote 가 잠금 뒤에 거절한다 (0021)
  const r = await saveQuote(got.inviteId, header, itemRows, submit, actorId, got.token);
  // 토큰 제출은 행위자가 없다. 금전 구속력이 있는 제출이라 누가 보냈는지 IP·브라우저라도 남긴다
  if (submit && r.ok && !r.skipped && who) await sb.from("cro_quotes").update({ submitted_ip: who.ip === "unknown" ? null : who.ip, submitted_ua: who.ua.slice(0, 300) || null }).eq("id", r.quote_id);
  if (!r.ok) {
    if (r.code === "closed") {
      // 화면을 연 뒤에 비교표가 열렸거나, 의뢰자가 선정·마무리했거나, 운영자가 초대를 취소했다. 지금 닫힌 이유로 안내한다
      const now = await load(got.token).catch(() => null);
      return { error: closedMessage(now?.closedReason ?? null), status: 409 };
    }
    return SAVE_DENIED[r.code] ?? { error: "저장에 실패했습니다.", status: 500 };
  }
  if (r.skipped) return { ok: true, skipped: true };

  if (submit && got.croOrgId && source === "cro") {
    // 운영자가 옮겨 적은 금액은 기관이 정한 값이 아니므로 기관 카탈로그로 되돌리지 않는다
    // 제출값을 카탈로그의 "최근 회신"으로 되돌린다 (응답 뒤에 실행, 실패해도 제출은 성공)
    const orgId = got.croOrgId;
    const learned = itemRows.map((x) => ({ seq: x.seq, category: x.category, name: x.name, avail: x.avail, amount: x.amount, weeks: x.weeks, unit: x.unit, unitPrice: x.unit_price, design: x.design, reportWeeks: x.report_weeks, translationWeeks: x.translation_weeks, afterSeqs: x.after_seqs }));
    const learnedSteps = steps.map((st) => ({ seq: st.seq, name: st.name, weeks: st.weeks ? Number(st.weeks) : null, after: st.after }));
    after(() => learnFromSubmission(orgId, learned, learnedSteps).catch((e) => console.error("learn", e)));
  }

  if (submit) {
    const first = r.first ?? true;
    const done = r.submitted_invites ?? 0;
    const count = r.total_invites ?? 0;
    // 의뢰자에게는 참여한 기관 수만 분모로 보인다 (안내 수·불참 수를 알리지 않는다, 0023)
    const joinedCount = Math.max(r.joined_invites ?? count, done);
    await logEvent(got.rfqId, "quote_submitted", `${got.croName} 견적 ${first ? "도착" : "수정"}${source === "operator" ? " (운영자 대리 입력)" : ""}`, `총 ${won(total)} · ${weeks}주${source === "operator" ? " · 기관 PDF 기준" : ""}`, actorId, { quoteId: r.quote_id, ip: who?.ip ?? null, entrySource: source });
    if (source === "operator" && actor) {
      await audit({ userId: actor.userId, email: actor.email }, "quote.proxy", { type: "cro_quote", id: r.quote_id, label: `${got.rfq.no} · ${got.croName}` }, { after: { entry_source: source, total_amount: total, total_weeks: weeks, pdf_name: pdf?.name ?? got.draft?.pdfName ?? null }, note: first ? "대리 입력" : "대리 입력 수정" });
    }
    if (r.compare_opened) {
      // 참여한 기관이 모두 제출해 save_quote 가 같은 트랜잭션에서 비교표를 열었다 (0025, 2026-10-20 결정 1).
      // 견적마다 보내던 의뢰자 알림 대신 "비교표가 열렸습니다"를 한 번 보낸다 (의뢰자·기관)
      const rfqId = got.rfqId;
      await logEvent(rfqId, "compared", `비교표 공개 · 견적 ${done}건 (참여 기관 모두 제출)`, undefined, null, { auto: "all" });
      after(() => announceCompareOpened(rfqId, "all").catch((e) => captureError(e, "quote:compare-opened", { rfq: got.rfq.no })));
    } else if (first) {
      const { data: rq } = await sb.from("rfq_requests").select("user_id, email").eq("id", got.rfqId).maybeSingle();
      if (rq?.user_id) {
        // 비교표가 열리기 전에는 진행 현황(참여 n곳, 제출 m곳)만 알린다. 기관 이름·금액·견적은 열린 뒤에 보인다 (2026-10-20 결정 1).
        // 수정은 진행 현황을 바꾸지 않으므로 알리지 않는다. 메일은 이 요청의 첫 견적일 때만 (save_quote 가 요청 행을 잠그고 세므로 done === 1 은 한 번)
        const mailWorthy = done === 1;
        await notifyUsers(
          [rq.user_id],
          { kind: "견적", title: `견적이 도착했습니다 · ${got.rfq.no}`, body: `참여 ${joinedCount}곳 중 ${done}곳 제출. 기관 이름과 금액은 비교표가 열리면 함께 보입니다. 비교표는 회신 기한이 지나거나, 참여 결정이 끝난 뒤 참여한 기관이 모두 제출하면 열립니다.`, href: `/app/r/${got.rfq.no}` },
          mailWorthy && rq.email ? { to: [rq.email], subject: `[단추] ${got.rfq.no} 첫 견적이 도착했습니다` } : undefined,
        );
      }
    }
    // 운영자는 앱 알림만. 메일은 예약 작업이 하루 한 번 모아서 보낸다
    await notifyUsers(await adminUserIds(), { kind: "견적", title: `${got.rfq.no} 회신 ${done}/${count} · ${got.croName}`, body: `총 ${won(total)} · ${weeks}주${first ? "" : " (수정)"}`, href: `/admin/r/${got.rfq.no}` });
  }
  return { ok: true, total, weeks };
}

/** PUT — 초안 자동 저장 (JSON) */
export async function PUT(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const a = await actorOf();
  const got = await load(token, loadOptsFor(a?.role));
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });
  const why = blocked(got);
  if (why) return NextResponse.json({ error: why.error }, { status: why.status });
  const parsed = parseBody(await req.json().catch(() => null), got.rfq.rows);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });
  if (got.draft?.status === "submitted") return NextResponse.json({ ok: true, skipped: true }); // 제출본은 자동 저장으로 덮지 않는다
  const r = await upsert(got, parsed, false, a);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, skipped: !!r.skipped });
}

/** POST — 제출 (JSON: { items, note, common, pdf? }). 전 항목 답변 + 공통 필수 + PDF 필수. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const a = await actorOf();
  const got = await load(token, loadOptsFor(a?.role));
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });
  const why = blocked(got);
  if (why) return NextResponse.json({ error: why.error }, { status: why.status });

  const parsed = parseBody(await req.json().catch(() => null), got.rfq.rows);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  if (parsed.items.some((it) => it.checks?.length)) return NextResponse.json({ error: "요청 조건이 다른 항목을 확인한 뒤 제출해 주세요." }, { status: 400 });
  const incomplete = parsed.items.some((it) => !(it.avail === "불가" || (it.avail && it.amount && it.weeks)));
  if (incomplete) return NextResponse.json({ error: "모든 항목의 가능 여부·금액·기간을 채워 주세요." }, { status: 400 });
  if (parsed.items.some((it) => it.avail !== "가능" && it.avail !== "" && !it.reason)) return NextResponse.json({ error: "조건부 가능·불가 항목에는 사유를 적어 주세요." }, { status: 400 });
  if (parsed.items.every((it) => it.avail === "불가")) return NextResponse.json({ error: "전 항목 불가는 견적 대신 요청 화면에서 '참여 철회'로 처리해 주세요." }, { status: 400 });
  if (parsed.items.some((it) => it.avail !== "불가" && Number(it.amount) < 1)) return NextResponse.json({ error: "가능·조건부 가능 항목의 금액은 1원 이상이어야 합니다." }, { status: 400 });
  if (!parsed.common.startDate) return NextResponse.json({ error: "착수 가능일을 입력해 주세요." }, { status: 400 });
  const today = todaySeoul();
  if (parsed.common.startDate < today) return NextResponse.json({ error: "착수 가능일은 오늘 이후 날짜여야 합니다." }, { status: 400 });
  if (parsed.common.validUntil && parsed.common.validUntil < today) return NextResponse.json({ error: "견적 유효기한이 이미 지났습니다. 날짜를 확인해 주세요." }, { status: 400 });
  if (!parsed.pdf && !got.draft?.pdfName) return NextResponse.json({ error: "정식 견적서 PDF를 첨부해 주세요." }, { status: 400 });

  const r = await upsert(got, parsed, true, a, { ip: clientIp(req), ua: req.headers.get("user-agent") || "" });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, total: r.total ?? null, weeks: r.weeks ?? null });
}
