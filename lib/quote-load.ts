import { getSupabaseAdmin } from "./supabase";
import { quoteRowsFromPayload } from "./quote-items";
import { demoDraft, demoRfq, type ReplyDraft, type ReplyItem, type RfqView } from "./cro-data";
import type { Values } from "./rfq-schema";

export type Loaded = { rfq: RfqView; draft: ReplyDraft | null; inviteId?: string; rfqId?: string; croName?: string };

/** 기밀 등급이 CDA 필요이고 아직 체결 전이면 의뢰자명을 가린다 */
function maskClient(company: string, orgType: string | null, confid: string | null): { client: string; masked: boolean } {
  if (confid && confid.startsWith("CDA")) return { client: `${orgType || "의뢰기관"} (마스킹)`, masked: true };
  return { client: company, masked: false };
}

function ddayOf(replyBy: string): { label: string; urgent: boolean; expired: boolean } {
  const d = Math.ceil((new Date(replyBy).getTime() - Date.now()) / 864e5);
  return { label: d < 0 ? "기한 지남" : `회신 D-${d}`, urgent: d <= 2, expired: d < 0 };
}

export async function loadQuote(token: string): Promise<Loaded | null> {
  if (token.startsWith("demo")) {
    const rfq = demoRfq(token);
    return rfq ? { rfq, draft: demoDraft(token) } : null;
  }
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data: inv } = await sb.from("rfq_invites").select("*").eq("token", token).maybeSingle();
  if (!inv) return null;
  const { data: r } = await sb.from("rfq_requests").select("*").eq("id", inv.rfq_id).maybeSingle();
  if (!r) return null;

  const p = r.payload as Values;
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  const a = (k: string) => (Array.isArray(p[k]) ? (p[k] as string[]) : []);
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
  const common: [string, string][] = [
    ["시험 투여경로", s("route") || "—"],
    ["임상 예정 투여기간", s("clinicalDuration") || "—"],
    ["적용 GLP", a("glp").join(" · ") || s("glp") || "—"],
    ["보고서 언어", s("reportLang") || "—"],
    ["SEND", s("send") || "—"],
  ].filter(([, v]) => v !== "—") as [string, string][];

  const rfq: RfqView = {
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
    attachments: masked ? "CDA 체결 후 열람" : "요청서 첨부 참조",
  };

  const { data: q } = await sb.from("cro_quotes").select("*, cro_quote_items(*)").eq("invite_id", inv.id).maybeSingle();
  let draft: ReplyDraft | null = null;
  if (q) {
    const items = (q.cro_quote_items as { seq: number; avail: string | null; amount: number | null; weeks: number | null }[])
      .sort((x, y) => x.seq - y.seq)
      .map((it) => ({ seq: it.seq, avail: (it.avail ?? "") as ReplyItem["avail"], amount: it.amount != null ? String(it.amount) : "", weeks: it.weeks != null ? String(it.weeks) : "" }));
    draft = { items, note: q.note ?? "", pdfName: q.pdf_name ?? "", status: q.status };
  }
  return { rfq, draft, inviteId: inv.id, rfqId: inv.rfq_id, croName: inv.cro_name };
}

