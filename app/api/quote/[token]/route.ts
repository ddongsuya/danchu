import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { QuoteRow } from "@/lib/quote-items";
import type { ReplyItem } from "@/lib/cro-data";
import { loadQuote as load, type Loaded } from "@/lib/quote-load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF = 20 * 1024 * 1024;

type PdfRef = { path: string; name: string; size: number };

/** GET — 회신 화면에 필요한 모든 것: 요청서 요약 + 자동 생성 행 + 저장된 초안 + 만료·잠금 상태 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const got = await load(token);
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });
  return NextResponse.json({ rfq: got.rfq, draft: got.draft, expired: got.expired, locked: got.locked });
}

/** 저장·제출이 막힌 상태면 그 이유를 돌려준다 */
function blocked(got: Loaded): string {
  if (got.expired) return "링크가 만료되었습니다. 단추(hello@danchu.kr)에 연장을 요청해 주세요.";
  if (got.locked) return "회신 기한이 지나 제출한 견적을 수정할 수 없습니다.";
  return "";
}

/** 항목 3칸 + 전달 사항 파싱 · 검증 */
function parseBody(raw: unknown, rows: QuoteRow[]): { items: ReplyItem[]; note: string; pdf?: PdfRef } | string {
  const b = (raw ?? {}) as { items?: unknown; note?: unknown; pdf?: unknown };
  const items = Array.isArray(b.items) ? (b.items as ReplyItem[]) : [];
  if (items.length !== rows.length) return "항목 수가 요청서와 다릅니다.";
  const seqs = new Set(rows.map((r) => r.seq));
  for (const it of items) {
    if (!it || typeof it !== "object" || !seqs.has(it.seq)) return "항목 번호가 요청서와 다릅니다.";
    if (!["", "가능", "조건부 가능", "불가"].includes(it.avail)) return "수행 가능 여부 값이 올바르지 않습니다.";
    if (it.amount && !/^\d{1,13}$/.test(it.amount)) return "금액은 숫자만 입력합니다.";
    if (it.weeks && !/^\d{1,3}$/.test(it.weeks)) return "기간은 주 단위 숫자만 입력합니다.";
  }
  let pdf: PdfRef | undefined;
  if (b.pdf && typeof b.pdf === "object") {
    const p = b.pdf as Partial<PdfRef>;
    if (typeof p.path !== "string" || typeof p.name !== "string" || typeof p.size !== "number") return "PDF 정보가 올바르지 않습니다.";
    if (p.size > MAX_PDF) return "PDF는 20MB 이하만 첨부할 수 있습니다.";
    pdf = { path: p.path, name: p.name.slice(0, 200), size: p.size };
  }
  return { items, note: typeof b.note === "string" ? b.note.slice(0, 2000) : "", pdf };
}

async function upsert(got: Loaded, token: string, items: ReplyItem[], note: string, submit: boolean, pdf?: PdfRef) {
  if (token.startsWith("demo")) return { ok: true }; // 데모 토큰은 저장하지 않는다
  const sb = getSupabaseAdmin()!;

  const total = items.reduce((a, it) => a + (it.avail !== "불가" && it.amount ? Number(it.amount) : 0), 0);
  const weeks = Math.max(0, ...items.map((it) => (it.avail !== "불가" && it.weeks ? Number(it.weeks) : 0)));

  const header: Record<string, unknown> = {
    invite_id: got.inviteId,
    rfq_id: got.rfqId,
    rfq_no: got.rfq.no,
    cro_name: got.croName,
    total_amount: total || null,
    total_weeks: weeks || null,
    vat: "별도",
    note,
    status: submit ? "submitted" : "draft",
    submitted_at: submit ? new Date().toISOString() : null,
  };

  if (pdf) {
    // 서명 URL로 올린 객체가 이 초대의 경로 아래 실제로 존재하는지 확인
    const dir = `${got.rfq.no}/${got.inviteId}`;
    if (!pdf.path.startsWith(`${dir}/`)) return { error: "PDF 경로가 올바르지 않습니다.", status: 400 };
    const file = pdf.path.slice(dir.length + 1);
    const { data: objs, error: le } = await sb.storage.from("cro-files").list(dir, { search: file, limit: 10 });
    if (le || !objs?.some((o) => o.name === file)) return { error: "PDF 업로드가 완료되지 않았습니다. 다시 첨부해 주세요.", status: 400 };
    header.pdf_path = pdf.path;
    header.pdf_name = pdf.name;
    header.pdf_size = pdf.size;
  }

  const { data: q, error: e1 } = await sb.from("cro_quotes").upsert(header, { onConflict: "invite_id" }).select("id").single();
  if (e1 || !q) return { error: "저장에 실패했습니다.", status: 500 };

  const rowsBySeq = new Map(got.rfq.rows.map((r) => [r.seq, r]));
  const itemRows = items.map((it) => {
    const r = rowsBySeq.get(it.seq)!;
    return {
      quote_id: q.id, seq: it.seq, category: r.category, name: r.name, cond: r.cond,
      avail: it.avail || null,
      amount: it.avail !== "불가" && it.amount ? Number(it.amount) : null,
      weeks: it.avail !== "불가" && it.weeks ? Number(it.weeks) : null,
    };
  });
  const { error: e2 } = await sb.from("cro_quote_items").upsert(itemRows, { onConflict: "quote_id,seq" });
  if (e2) return { error: "항목 저장에 실패했습니다.", status: 500 };

  await sb.from("rfq_invites").update({ status: submit ? "submitted" : "draft" }).eq("id", got.inviteId);
  if (submit) await sb.from("rfq_requests").update({ status: "quoted" }).eq("id", got.rfqId);
  return { ok: true, total, weeks };
}

/** PUT — 초안 자동 저장 (JSON) */
export async function PUT(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const got = await load(token);
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });
  const why = blocked(got);
  if (why) return NextResponse.json({ error: why }, { status: 403 });
  const parsed = parseBody(await req.json().catch(() => null), got.rfq.rows);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });
  const r = await upsert(got, token, parsed.items, parsed.note, false);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}

/** POST — 제출 (JSON: { items, note, pdf?: {path,name,size} }). 전 항목 답변 + PDF 필수.
 *  PDF 본문은 /api/quote/[token]/upload-url 로 받은 서명 URL에 브라우저가 직접 올린다. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const got = await load(token);
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });
  const why = blocked(got);
  if (why) return NextResponse.json({ error: why }, { status: 403 });

  const parsed = parseBody(await req.json().catch(() => null), got.rfq.rows);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const incomplete = parsed.items.some((it) => !(it.avail === "불가" || (it.avail && it.amount && it.weeks)));
  if (incomplete) return NextResponse.json({ error: "모든 항목의 가능 여부·금액·기간을 채워 주세요." }, { status: 400 });
  if (parsed.items.every((it) => it.avail === "불가")) return NextResponse.json({ error: "전 항목 불가는 회신하지 않음으로 처리해 주세요." }, { status: 400 });
  if (!parsed.pdf && !got.draft?.pdfName) return NextResponse.json({ error: "정식 견적서 PDF를 첨부해 주세요." }, { status: 400 });

  const r = await upsert(got, token, parsed.items, parsed.note, true, parsed.pdf);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, total: r.total ?? null, weeks: r.weeks ?? null });
}
