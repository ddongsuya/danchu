/**
 * 2차 상세 견적 읽기 (0042). 서버 전용.
 */
import { getSupabaseAdmin } from "./supabase";
import type { Tables } from "./db-types";
import type { Values } from "./rfq-schema";
import { detailExpired, detailLines, replyItemsOf, type DetailLine, type DetailReplyItem, type DetailStatus } from "./detail-quote";
import { anonymousFileLabel } from "./request-policy";

export type DetailRow = Tables<"rfq_details">;
export type DetailTargetRow = Tables<"rfq_detail_targets">;

export type DetailTarget = {
  id: string;
  quoteId: string;
  inviteId: string;
  orgId: string | null;
  status: DetailStatus;
  total: number | null;
  weeks: number | null;
  items: DetailReplyItem[];
  note: string;
  respondedAt: string | null;
};
export type DetailBundle = { replyBy: string; createdAt: string; values: Values; note: string; targets: DetailTarget[] };

/** 이 요청의 상세 견적 요청과 받는 곳. 없으면 null */
export async function loadDetail(rfqId: string): Promise<DetailBundle | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data: d } = await sb.from("rfq_details").select("*").eq("rfq_id", rfqId).maybeSingle();
  if (!d) return null;
  const { data: ts } = await sb.from("rfq_detail_targets").select("*").eq("rfq_id", rfqId).order("created_at");
  return {
    replyBy: d.reply_by,
    createdAt: d.created_at,
    values: (d.detail && typeof d.detail === "object" && !Array.isArray(d.detail) ? d.detail : {}) as Values,
    note: d.note,
    targets: (ts ?? []).map((t) => ({
      id: t.id, quoteId: t.quote_id, inviteId: t.invite_id, orgId: t.cro_org_id, status: t.status,
      total: t.total_amount, weeks: t.total_weeks, items: replyItemsOf(t.items), note: t.note, respondedAt: t.responded_at,
    })),
  };
}

/** 이 초대가 상세 견적을 받는 곳인지 (첨부 열람·기관 화면) */
export async function detailTargetOfInvite(inviteId: string): Promise<DetailTargetRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("rfq_detail_targets").select("*").eq("invite_id", inviteId).maybeSingle();
  return data ?? null;
}

/* ── 기관이 보는 상세 견적 요청 ── */
export type DetailForCro = {
  status: DetailStatus;
  replyBy: string;
  /** 2차 회신 기한이 지났다 */
  expired: boolean;
  /** 의뢰자가 기관을 선정했거나 요청을 마무리했다 */
  closed: boolean;
  changed: DetailLine[];
  added: DetailLine[];
  files: { id: string; name: string; size: number }[];
  first: { total: number; weeks: number | null; items: { seq: number; name: string; amount: number | null; weeks: number | null; avail: string }[] };
  reply: { total: number | null; weeks: number | null; items: DetailReplyItem[]; note: string } | null;
};

/** 이 초대가 받은 상세 견적 요청. 받지 않았으면 null. 예산처럼 기관에 보내지 않는 값은 뺀다 */
export async function loadDetailForInvite(inviteId: string, rfqId: string, rows: { seq: number; name: string }[]): Promise<DetailForCro | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const t = await detailTargetOfInvite(inviteId);
  if (!t) return null;
  const [{ data: d }, { data: r }, { data: q }, { data: fl }] = await Promise.all([
    sb.from("rfq_details").select("*").eq("rfq_id", rfqId).maybeSingle(),
    sb.from("rfq_requests").select("payload, categories, status, selected_quote_id").eq("id", rfqId).maybeSingle(),
    sb.from("cro_quotes").select("total_amount, total_weeks, final_weeks, cro_quote_items(seq, amount, weeks, avail)").eq("id", t.quote_id).maybeSingle(),
    sb.from("rfq_files").select("id, file_name, size_bytes").eq("rfq_id", rfqId).eq("scope", "detail").not("uploaded_at", "is", null).order("created_at"),
  ]);
  if (!d || !r || !q) return null;
  const values = (d.detail && typeof d.detail === "object" && !Array.isArray(d.detail) ? d.detail : {}) as Values;
  const { changed, added } = detailLines(values, r.payload as Values, r.categories ?? [], { forCro: true });
  const items = (q.cro_quote_items ?? []) as { seq: number; amount: number | null; weeks: number | null; avail: string | null }[];
  return {
    status: t.status,
    replyBy: d.reply_by,
    expired: detailExpired(d.reply_by),
    closed: !!r.selected_quote_id || ["selected", "contracting", "closed", "cancelled"].includes(r.status),
    changed,
    added,
    // 선정 전에는 파일명을 가린다 (1차 첨부와 같은 규칙)
    files: (fl ?? []).map((f, i) => ({ id: f.id, name: anonymousFileLabel(i, f.file_name, f.size_bytes), size: f.size_bytes })),
    first: {
      total: q.total_amount ?? 0,
      weeks: q.final_weeks ?? q.total_weeks ?? null,
      items: rows.map((row) => {
        const it = items.find((x) => x.seq === row.seq);
        return { seq: row.seq, name: row.name, amount: it?.amount ?? null, weeks: it?.weeks ?? null, avail: it?.avail ?? "" };
      }),
    },
    reply: t.status === "sent" ? null : { total: t.total_amount, weeks: t.total_weeks, items: replyItemsOf(t.items), note: t.note },
  };
}

/** 기관 요청 화면의 2차 견적 안내 (components/cro/CroStory.tsx DetailCue). 받지 않았으면 null */
export async function detailCueOfInvite(inviteId: string, rfqId: string, base: string): Promise<{ open: boolean; status: DetailStatus; replyBy: string; href: string } | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const t = await detailTargetOfInvite(inviteId);
  if (!t) return null;
  const [{ data: d }, { data: r }] = await Promise.all([
    sb.from("rfq_details").select("reply_by").eq("rfq_id", rfqId).maybeSingle(),
    sb.from("rfq_requests").select("status, selected_quote_id").eq("id", rfqId).maybeSingle(),
  ]);
  if (!d || !r) return null;
  const closed = !!r.selected_quote_id || ["selected", "contracting", "closed", "cancelled"].includes(r.status);
  return { open: t.status === "sent" && !closed && !detailExpired(d.reply_by), status: t.status, replyBy: d.reply_by, href: `${base}/detail` };
}
