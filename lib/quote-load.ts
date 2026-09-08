import { getSupabaseAdmin } from "./supabase";
import { quoteRowsFromPayload } from "./quote-items";
import { EMPTY_COMMON, type ReplyCommon, type ReplyDraft, type ReplyItem, type RfqView } from "./cro-data";
import type { Values } from "./rfq-schema";
import type { InviteRow, RfqRow } from "./data";

export type Loaded = {
  rfq: RfqView;
  draft: ReplyDraft | null;
  inviteId: string;
  rfqId: string;
  croName: string;
  croOrgId: string | null;
  token: string;
  /** 링크 만료 (expires_at 경과) — 열람만 가능, 저장·제출 불가 */
  expired: boolean;
  /** 제출 후 회신 기한(reply_by, 서울 자정)이 지나 수정 불가 */
  locked: boolean;
  /** 회신하지 않음 처리 */
  declined: boolean;
  /** 의뢰자가 이미 CRO를 선택해 회신이 닫힘 */
  closed: boolean;
};

/** 기밀 등급이 CDA 필요이고 아직 체결 전이면 의뢰자명을 가린다 */
function maskClient(company: string, orgType: string | null, confid: string | null): { client: string; masked: boolean } {
  if (confid && confid.startsWith("CDA")) return { client: `${orgType || "의뢰기관"} (마스킹)`, masked: true };
  return { client: company, masked: false };
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
export function rfqViewOf(r: RfqRow, inv: InviteRow, files: { id: string; file_name: string; size_bytes: number }[]): RfqView {
  const p = r.payload as Values;
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  const a = (k: string) => (Array.isArray(p[k]) ? (p[k] as string[]) : []);
  const sa = (k: string) => a(k).join(" · ") || s(k);
  const { client, masked } = maskClient(r.company, r.org_type, r.confidentiality);
  const dd = ddayOf(inv.reply_by);

  const overview: [string, string][] = [
    ["의뢰 목적", s("purpose") || "—"],
    ["개발 분야", s("devField") || "—"],
    ["제출처", a("authority").join(" · ") || "—"],
    ["기밀 등급", r.confidentiality || "일반"],
    ["희망 착수", s("start") || "—"],
    ["회신 기한", `${inv.reply_by} (${dd.label.replace("회신 ", "")})`],
    ["CRO 수", r.cro_count || "—"],
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
  ).filter(([, v]) => v && v !== "—");

  return {
    no: r.rfq_no,
    substance: r.substance,
    client,
    masked,
    ddayLabel: dd.label,
    urgent: dd.urgent,
    confid: r.confidentiality || "일반",
    replyBy: inv.reply_by,
    authorities: a("authority"),
    overview,
    rows: quoteRowsFromPayload(p),
    common,
    attachments: masked ? (files.length ? `${files.length}건 · CDA 체결 후 열람` : "없음") : files.length ? `${files.length}건` : "없음",
    files: masked ? [] : files.map((f) => ({ id: f.id, name: f.file_name, size: f.size_bytes })),
  };
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
  const rfq = rfqViewOf(r as RfqRow, inv, files ?? []);

  const { data: q } = await sb.from("cro_quotes").select("*, cro_quote_items(*)").eq("invite_id", inv.id).maybeSingle();
  let draft: ReplyDraft | null = null;
  if (q) {
    const items = (q.cro_quote_items as { seq: number; avail: string | null; amount: number | null; weeks: number | null; reason: string | null }[])
      .sort((x, y) => x.seq - y.seq)
      .map((it) => ({
        seq: it.seq,
        avail: (it.avail ?? "") as ReplyItem["avail"],
        amount: it.amount != null ? String(it.amount) : "",
        weeks: it.weeks != null ? String(it.weeks) : "",
        reason: it.reason ?? "",
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
    draft = { items, note: q.note ?? "", pdfName: q.pdf_name ?? "", status: q.status, common };
  }
  const now = Date.now();
  const expired = !!inv.expires_at && new Date(inv.expires_at).getTime() < now;
  const locked = draft?.status === "submitted" && now > endOfDaySeoul(inv.reply_by);
  const closed = ["selected", "contracting", "closed", "cancelled"].includes((r as RfqRow).status);

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
  return loadByInvite(inv as InviteRow);
}
