import { anonymousFileLabel, confidentialAccess, CRO_TERMS_VERSION, identityVisible, isJoined, maskedClientLabel, needsCda, seatsLabel, type SeatInfo } from "./request-policy";
import { getSupabaseAdmin } from "./supabase";
import { quoteRowsFromPayload } from "./quote-items";
import { EMPTY_COMMON, type ReplyCommon, type ReplyDraft, type ReplyItem, type RfqView } from "./cro-data";
import type { Values } from "./rfq-schema";
import type { InviteRow, RfqRow } from "./data";
import { catalogMap } from "./catalog-db";
import type { CatalogRow } from "./catalog";
import { pickVariant, prefillRow, rowKey } from "./catalog";
import { endOfDaySeoul, repliesClosed } from "./reply-window";
import { offerSeatState } from "./rpc";

export type Loaded = {
  rfq: RfqView;
  draft: ReplyDraft | null;
  inviteId: string;
  rfqId: string;
  croName: string;
  croOrgId: string | null;
  token: string;
  /** 링크 만료 (expires_at 경과) - 열람만 가능, 저장·제출 불가 */
  expired: boolean;
  /** 제출 후 회신 기한(reply_by, 서울 자정)이 지나 수정 불가 */
  locked: boolean;
  /** 불참(참여 전) 또는 철회(참여 뒤) 처리. status = declined */
  declined: boolean;
  /** 의뢰자가 CRO를 선택했거나 회신이 마감되어(compared_at) 회신이 닫힘 */
  closed: boolean;
  /** 기관이 참여했는지 (joined_at, 0023). false 면 rfq 는 참여 전 요약이고 draft 는 null 이다 */
  joined: boolean;
  /** 참여 뒤 철회했는지 (withdrawn_at). declined 와 함께 참이다 */
  withdrawn: boolean;
  /** 운영자 세션으로 연 화면 (대리 입력). 참여를 대신 누를 수 없다 */
  operator: boolean;
  /** 참여 전에만 채운다: 자리 현황 (offer_seat_state) */
  seats: SeatInfo | null;
  /** 참여 결정 기한 (rfq_requests.join_by). 없으면 null */
  joinBy: string | null;
};

/**
 * 의뢰자 표시명과 공개 상태.
 * - client/identityMasked: 회사명과 원본 첨부 파일명은 이 기관이 선정됐을 때만 보인다 (모든 요청 공통, CDA 체결과 무관)
 * - masked: CDA 요청의 첨부·상세 비공개 (체결 확인 전)
 */
function maskClient(company: string, orgType: string | null, confid: string | null, signedAt: string | null | undefined, awarded: boolean): { client: string; masked: boolean; identityMasked: boolean } {
  const identityMasked = !identityVisible({ awarded });
  return { client: identityMasked ? maskedClientLabel(orgType) : company, masked: !confidentialAccess(confid, signedAt), identityMasked };
}

function ddayOf(replyBy: string): { label: string; urgent: boolean } {
  const d = Math.ceil((endOfDaySeoul(replyBy) - Date.now()) / 864e5);
  return { label: d < 0 ? "기한 지남" : `회신 D-${d}`, urgent: d <= 2 };
}

/** "2026-10-22" · ISO 시각 → 서울 날짜 */
function seoulDate(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/**
 * 참여 전 요약 (0023, 설계 규칙표 "참여 전에 보이는 것"). 여기 적힌 것 말고는 내보내지 않는다:
 * 분야, 시험 항목(종·기간·GLP 여부), 제출처, 요청 성격, 의뢰자 기관 유형, 희망 착수, 회신 기한, 참여 결정 기한,
 * 기밀 등급, CDA 필요 여부, 첨부 개수, 자리 수와 남은 자리, 적용되는 이용 조건 판.
 * 시험물질명, 의뢰 목적, 개발 분야, 공통 조건, 의뢰자 상황·질문, 첨부 목록, 회사명은 참여 뒤(회사명은 선정 뒤)에 연다
 */
export function rfqSummaryOf(r: RfqRow, inv: InviteRow, fileCount: number, seats: SeatInfo | null): RfqView {
  const p = r.payload as Values;
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  const a = (k: string) => (Array.isArray(p[k]) ? (p[k] as string[]) : []);
  const dd = ddayOf(inv.reply_by);
  const cda = needsCda(r.confidentiality);
  const joinBy = r.join_by ?? seats?.join_by ?? null;
  const categories = r.categories ?? [];
  const overview: [string, string][] = [
    ["분야", categories.join(" · ") || "-"],
    ["제출처", a("authority").join(" · ") || "-"],
    ["요청 성격", r.intent || s("intent") || "-"],
    ["의뢰자 기관 유형", r.org_type || "-"],
    ["희망 착수", s("start") || "-"],
    ["회신 기한", `${inv.reply_by} (${dd.label.replace("회신 ", "")})`],
    ["참여 결정 기한", joinBy ? seoulDate(joinBy) : "-"],
    ["기밀 등급", r.confidentiality || "일반"],
    ["CDA", cda ? "필요 (첨부는 CDA 체결 확인 뒤)" : "필요 없음"],
    ["첨부", fileCount ? `${fileCount}건 · 참여 뒤 열람` : "없음"],
    ["참여 자리", seatsLabel(seats)],
    ["이용 조건", `${CRO_TERMS_VERSION} (시범 운영, 무료)`],
  ];
  return {
    full: false,
    no: r.rfq_no,
    substance: "",
    categories,
    client: maskedClientLabel(r.org_type),
    masked: cda,
    identityMasked: true,
    ddayLabel: dd.label,
    urgent: dd.urgent,
    confid: r.confidentiality || "일반",
    replyBy: inv.reply_by,
    authorities: a("authority"),
    overview,
    rows: quoteRowsFromPayload(p, { summary: true }),
    common: [],
    situation: [],
    ask: [],
    attachments: fileCount ? `${fileCount}건 · 참여 뒤 열람` : "없음",
    files: [],
  };
}

/** 요청서(RfqRow) → 참여한 CRO가 보는 요청서 전체 */
export function rfqViewOf(r: RfqRow, inv: InviteRow, files: { id: string; file_name: string; size_bytes: number }[], awarded = false): RfqView {
  const p = r.payload as Values;
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  const a = (k: string) => (Array.isArray(p[k]) ? (p[k] as string[]) : []);
  const sa = (k: string) => a(k).join(" · ") || s(k);
  const { client, masked, identityMasked } = maskClient(r.company, r.org_type, r.confidentiality, inv.cda_signed_at, awarded);
  const dd = ddayOf(inv.reply_by);

  const overview: [string, string][] = [
    ["의뢰 목적", s("purpose") || "-"],
    ["요청 성격", r.intent || s("intent") || "-"],
    ["개발 분야", s("devField") || "-"],
    ["제출처", a("authority").join(" · ") || "-"],
    ["기밀 등급", r.confidentiality || "일반"],
    ["희망 착수", s("start") || "-"],
    ["회신 기한", `${inv.reply_by} (${dd.label.replace("회신 ", "")})`],
    ["참여 자리 수", r.cro_count || "-"],
  ];
  const common: [string, string][] = (
    [
      ["시험 투여경로", s("route")],
      ["임상 예정 투여경로", s("clinRoute")],
      ["임상 예정 투여기간", s("clinDuration")],
      ["시험물질 보관조건", s("storage")],
      ["시험물질 보유량", s("amount")],
      ["함량분석법 보유", s("assayMethod")],
      ["생체시료 분석법 보유", s("bioMethod")],
      ["표준품 제공", s("standards")],
      ["시험법 가이드라인", sa("guideline")],
      ["적용 GLP", sa("glp")],
      ["보고서 원문 언어", sa("reportLang")],
      ["번역보고서 언어", sa("reportTrans")],
      ["보고서 초안 희망일", s("draftDue")],
      ["SEND", s("send") + (s("sendPurpose") ? ` (${s("sendPurpose")})` : "")],
      ["자료 보관기간", s("archive")],
      ["잔여 시험물질", s("residual")],
      ["다지점시험", s("multisite")],
      ["추가 내용", s("notes")],
    ] as [string, string][]
  ).filter(([, v]) => v && v !== "-");

  return {
    full: true,
    no: r.rfq_no,
    substance: r.substance,
    categories: r.categories,
    client,
    masked,
    identityMasked,
    ddayLabel: dd.label,
    urgent: dd.urgent,
    confid: r.confidentiality || "일반",
    replyBy: inv.reply_by,
    authorities: a("authority"),
    overview,
    rows: quoteRowsFromPayload(p),
    common,
    situation: a("advisorAnswers").filter((x) => typeof x === "string").slice(0, 20),
    ask: a("advisorAsk").filter((x) => typeof x === "string").slice(0, 30),
    attachments: masked ? (files.length ? `${files.length}건 · CDA 체결 후 열람` : "없음") : files.length ? `${files.length}건` : "없음",
    // 선정 전에는 파일명도 가린다 (파일명에 회사명이 들어 있는 경우가 많다). 다운로드 이름도 /api/files 에서 같은 규칙
    files: masked ? [] : files.map((f, i) => ({ id: f.id, name: identityMasked ? anonymousFileLabel(i, f.file_name, f.size_bytes) : f.file_name, size: f.size_bytes })),
  };
}

/** 카탈로그 → 회신 초안. 카탈로그에 해당 항목이 없으면 null (빈 폼) */
async function prefillDraft(orgId: string, r: RfqRow, rfq: RfqView): Promise<ReplyDraft | null> {
  const cat = await catalogMap(orgId);
  if (!cat.size) return null;
  const payload = r.payload as Values;
  let touched = false;
  const used: CatalogRow[] = [];
  const items: ReplyItem[] = rfq.rows.map((row) => {
    const picked = pickVariant(cat.get(rowKey(row)) ?? [], row, payload); // 등록하지 않은 항목은 빈 칸
    const p = prefillRow(row, picked, payload);
    if (picked) touched = true;
    if (picked?.row.available) used.push(picked.row);
    return { seq: row.seq, avail: p.avail, amount: p.amount, weeks: p.weeks, reason: p.reason, design: p.design, source: p.source, checks: p.checks, unit: p.unit, unitPrice: p.unitPrice, sampleCount: "" };
  });
  if (!touched) return null;
  // 총액 포함 항목: 초안에 쓰인 조합들이 공통으로 포함하는 것
  const includes = used.length ? used[0].includes.filter((k) => used.every((c) => c.includes.includes(k))) : [];
  const valid = new Date(Date.now() + 30 * 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return { items, note: "", pdfName: "", status: "draft", common: { ...EMPTY_COMMON, validUntil: valid, includes }, prefilled: true };
}

/**
 * markOpened: 첫 열람 시각을 남길지. 운영자가 대리 입력하려고 연 것은 기관의 열람이 아니므로 false.
 * operator: 운영자 세션. 회신 마감 전이면 회신 기한 잠금(locked)과 링크 만료(expired)를 적용하지 않는다 (lib/concierge.ts loadOptsFor)
 */
export type LoadOpts = { markOpened?: boolean; operator?: boolean };

/**
 * 초대 행 → 회신 화면. 운영자가 거둔 초대(revoked_at, 0021)는 누구에게도 열지 않는다 (열람·저장·업로드·불참 모두 여기를 거친다).
 * 기관이 참여하기 전(joined_at 없음, 0023)에는 요약(rfqSummaryOf)만 돌려주고 카탈로그 초안도 만들지 않는다. 운영자가 열어도 같다.
 * 첫 열람 시각(opened_at)은 요약만 봐도 남긴다 (참여 결정 시간 측정)
 */
export async function loadByInvite(inv: InviteRow, opts: LoadOpts = {}): Promise<Loaded | null> {
  if (inv.revoked_at) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  // 참여가 중지·반려된 기관의 초대는 운영자 외에는 열지 않는다. 포털(/cro/r)로 요청서를 계속 보거나 새로 발급된 토큰을 받아 가지 않게 한다
  // (중지 때 DB 트리거가 토큰을 바꾸고 열린 초대를 만료시킨다, 0021). 운영자는 기록 확인을 위해 닫힌 화면으로 연다
  let orgSuspended = false;
  if (inv.cro_org_id) {
    const { data: org } = await sb.from("cro_orgs").select("status").eq("id", inv.cro_org_id).maybeSingle();
    orgSuspended = !!org && org.status !== "approved";
    if (orgSuspended && !opts.operator) return null;
  }
  const { data: r } = await sb.from("rfq_requests").select("*").eq("id", inv.rfq_id).maybeSingle();
  if (!r) return null;

  // 첫 열람 시각 기록 (실패해도 무시). 운영자가 연 것은 남기지 않는다
  if (!inv.opened_at && opts.markOpened !== false) {
    await sb.from("rfq_invites").update({ opened_at: new Date().toISOString() }).eq("id", inv.id);
  }
  const { data: files } = await sb.from("rfq_files").select("id, file_name, size_bytes").eq("rfq_id", inv.rfq_id).order("created_at");
  const joined = isJoined(inv);
  // 참여 전에는 견적 행이 있을 수 없다 (0023 트리거). 읽지 않는다
  const { data: q } = joined ? await sb.from("cro_quotes").select("*, cro_quote_items(*)").eq("invite_id", inv.id).maybeSingle() : { data: null };
  // 이 기관의 견적이 선정됐을 때만 회사명·연락처가 열린다
  const awarded = !!q && !!r.selected_quote_id && r.selected_quote_id === q.id;
  const seats = joined ? null : await offerSeatState(inv.rfq_id);
  // 철회·불참한 초대는 첨부를 내려받지 못한다 (/api/files 와 같은 규칙). 목록도 비운다
  const gone = inv.status === "declined" || !!inv.withdrawn_at;
  const rfq = joined ? rfqViewOf(r, inv, gone ? [] : files ?? [], awarded) : rfqSummaryOf(r, inv, (files ?? []).length, seats);
  let draft: ReplyDraft | null = null;
  if (q) {
    type ItemRow = { seq: number; avail: string | null; amount: number | null; weeks: number | null; reason: string | null; design?: Record<string, unknown> | null; source?: string | null; unit?: string | null; unit_price?: number | null; sample_count?: number | null };
    const items: ReplyItem[] = (q.cro_quote_items as ItemRow[])
      .sort((x, y) => x.seq - y.seq)
      .map((it) => ({
        seq: it.seq,
        checks: Array.isArray(it.design?.reviewChecks) ? it.design.reviewChecks.filter((x): x is string => typeof x === "string") : [],
        avail: (it.avail ?? "") as ReplyItem["avail"],
        amount: it.amount != null ? String(it.amount) : "",
        weeks: it.weeks != null ? String(it.weeks) : "",
        reason: it.reason ?? "",
        design: it.design && typeof it.design === "object" ? it.design : {},
        source: it.source === "catalog" || it.source === "learned" ? it.source : "manual",
        unit: it.unit === "per_sample" ? "per_sample" : "total",
        unitPrice: it.unit_price != null ? String(it.unit_price) : "",
        sampleCount: it.sample_count != null ? String(it.sample_count) : "",
      }));
    const common: ReplyCommon = {
      ...EMPTY_COMMON,
      validUntil: q.valid_until ?? "",
      startDate: q.start_date ?? "",
      payTerms: q.pay_terms ?? "",
      substanceQty: q.substance_qty ?? "",
      reportLang: q.report_lang ?? "",
      includes: Array.isArray(q.includes) ? q.includes : [],
    };
    draft = { items, note: q.note ?? "", pdfName: q.pdf_name ?? "", status: q.status === "submitted" ? "submitted" : "draft", common };
  } else if (inv.cro_org_id && joined && !gone) {
    // 저장된 회신이 없으면 기관 카탈로그로 초안을 만든다 (저장은 CRO가 손댈 때). 참여 전에는 만들지 않는다 (요청서 전체가 열리는 때와 같다)
    draft = await prefillDraft(inv.cro_org_id, r, rfq);
  }
  const now = Date.now();
  // 운영자는 기한 뒤에도 대리 입력한 견적을 고칠 수 있다. 회신 마감·선정 뒤에는 아래 closed 가 막는다
  const expired = !opts.operator && !!inv.expires_at && new Date(inv.expires_at).getTime() < now;
  const locked = !opts.operator && draft?.status === "submitted" && now > endOfDaySeoul(inv.reply_by);
  // 회신이 마감되면(compared_at, 기한 다음 날 cron 또는 운영자 회신 마감) 아직 제출하지 않은 기관도 닫힌다. 제때 낸 기관만 잠기고
  // 안 낸 기관은 링크 만료까지 지각 제출할 수 있던 역차별을 없앤다. 운영자가 기한을 늘리면 compared_at 을 비우므로 다시 열린다 (lib/reply-window.ts)
  // 참여가 중지된 기관의 초대는 위에서 막았다. 운영자가 열면 닫힌 화면으로 보인다
  const closed = repliesClosed(r) || orgSuspended;

  return {
    rfq, draft, inviteId: inv.id, rfqId: inv.rfq_id, croName: inv.cro_name, croOrgId: inv.cro_org_id, token: inv.token,
    expired, locked, declined: inv.status === "declined", closed,
    joined, withdrawn: !!inv.withdrawn_at, operator: !!opts.operator, seats, joinBy: r.join_by ?? null,
  };
}

/** 토큰 링크로 접근 (로그인 없음) */
export async function loadQuote(token: string, opts: LoadOpts = {}): Promise<Loaded | null> {
  if (!/^[\w-]{8,128}$/.test(token)) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data: inv } = await sb.from("rfq_invites").select("*").eq("token", token).maybeSingle();
  if (!inv) return null;
  return loadByInvite(inv, opts);
}
