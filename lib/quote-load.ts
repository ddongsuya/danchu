import { anonymousFileLabel, confidentialAccess, identityVisible, maskedClientLabel } from "./request-policy";
import { getSupabaseAdmin } from "./supabase";
import { quoteRowsFromPayload } from "./quote-items";
import { EMPTY_COMMON, type ReplyCommon, type ReplyDraft, type ReplyItem, type RfqView } from "./cro-data";
import type { Values } from "./rfq-schema";
import type { InviteRow, RfqRow } from "./data";
import { catalogMap } from "./catalog-db";
import type { CatalogRow } from "./catalog";
import { pickVariant, prefillRow, rowKey } from "./catalog";

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
  /** 회신하지 않음 처리 */
  declined: boolean;
  /** 의뢰자가 이미 CRO를 선택해 회신이 닫힘 */
  closed: boolean;
};

/**
 * 의뢰자 표시명과 공개 상태.
 * - client/identityMasked: 회사명은 이 기관이 선정됐거나 CDA 체결이 확인될 때만 보인다 (모든 요청 공통)
 * - masked: CDA 요청의 첨부·상세 비공개 (체결 확인 전)
 */
function maskClient(company: string, orgType: string | null, confid: string | null, signedAt: string | null | undefined, awarded: boolean): { client: string; masked: boolean; identityMasked: boolean } {
  const identityMasked = !identityVisible({ awarded, signedAt });
  return { client: identityMasked ? maskedClientLabel(orgType) : company, masked: !confidentialAccess(confid, signedAt), identityMasked };
}

/** 'YYYY-MM-DD'의 서울 기준 그날 23:59:59 */
export function endOfDaySeoul(ymd: string): number {
  return new Date(`${ymd.slice(0, 10)}T23:59:59+09:00`).getTime();
}

function ddayOf(replyBy: string): { label: string; urgent: boolean } {
  const d = Math.ceil((endOfDaySeoul(replyBy) - Date.now()) / 864e5);
  return { label: d < 0 ? "기한 지남" : `회신 D-${d}`, urgent: d <= 2 };
}

/** 요청서(RfqRow) → CRO가 보는 요약 */
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
    ["CRO 수", r.cro_count || "-"],
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
    no: r.rfq_no,
    substance: r.substance,
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

/** 초대 행 → 회신 화면 전체 */
export async function loadByInvite(inv: InviteRow): Promise<Loaded | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data: r } = await sb.from("rfq_requests").select("*").eq("id", inv.rfq_id).maybeSingle();
  if (!r) return null;

  // 첫 열람 시각 기록 (실패해도 무시)
  if (!inv.opened_at) {
    await sb.from("rfq_invites").update({ opened_at: new Date().toISOString() }).eq("id", inv.id);
  }
  const { data: files } = await sb.from("rfq_files").select("id, file_name, size_bytes").eq("rfq_id", inv.rfq_id).order("created_at");
  const { data: q } = await sb.from("cro_quotes").select("*, cro_quote_items(*)").eq("invite_id", inv.id).maybeSingle();
  // 이 기관의 견적이 선정됐을 때만 회사명·연락처가 열린다
  const awarded = !!q && !!r.selected_quote_id && r.selected_quote_id === q.id;
  const rfq = rfqViewOf(r, inv, files ?? [], awarded);
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
  } else if (inv.cro_org_id) {
    // 저장된 회신이 없으면 기관 카탈로그로 초안을 만든다 (저장은 CRO가 손댈 때)
    draft = await prefillDraft(inv.cro_org_id, r, rfq);
  }
  const now = Date.now();
  const expired = !!inv.expires_at && new Date(inv.expires_at).getTime() < now;
  const locked = draft?.status === "submitted" && now > endOfDaySeoul(inv.reply_by);
  // 비교표가 공개되면 아직 제출하지 않은 기관도 닫힌다. 제때 낸 기관만 잠기고 안 낸 기관은 링크 만료까지
  // 지각 제출할 수 있던 역차별을 없앤다. 운영자가 기한을 늘리면 compared_at 이 없으므로 다시 열린다
  // 참여가 중지된 기관의 초대도 닫는다 (중지 때 초대를 만료시키지만 2차 방어선)
  let orgSuspended = false;
  if (inv.cro_org_id) {
    const { data: org } = await sb.from("cro_orgs").select("status").eq("id", inv.cro_org_id).maybeSingle();
    orgSuspended = !!org && org.status !== "approved";
  }
  const closed = ["selected", "contracting", "closed", "cancelled"].includes(r.status) || !!r.compared_at || orgSuspended;

  return {
    rfq, draft, inviteId: inv.id, rfqId: inv.rfq_id, croName: inv.cro_name, croOrgId: inv.cro_org_id, token: inv.token,
    expired, locked, declined: inv.status === "declined", closed,
  };
}

/** 토큰 링크로 접근 (로그인 없음) */
export async function loadQuote(token: string): Promise<Loaded | null> {
  if (!/^[\w-]{8,128}$/.test(token)) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data: inv } = await sb.from("rfq_invites").select("*").eq("token", token).maybeSingle();
  if (!inv) return null;
  return loadByInvite(inv);
}
