import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { QuoteRow } from "@/lib/quote-items";
import type { ReplyItem } from "@/lib/cro-data";
import { loadQuote as load } from "@/lib/quote-load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF = 20 * 1024 * 1024;

/** GET — 회신 화면에 필요한 모든 것: 요청서 요약 + 자동 생성 행 + 저장된 초안 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const got = await load(token);
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });
  return NextResponse.json({ rfq: got.rfq, draft: got.draft });
}

/** 항목 3칸 + 전달 사항 파싱 · 검증 */
function parseBody(raw: unknown, rows: QuoteRow[]): { items: ReplyItem[]; note: string } | string {
  const b = (raw ?? {}) as { items?: unknown; note?: unknown };
  const items = Array.isArray(b.items) ? (b.items as ReplyItem[]) : [];
  if (items.length !== rows.length) return "항목 수가 요청서와 다릅니다.";
  for (const it of items) {
    if (!["", "가능", "조건부 가능", "불가"].includes(it.avail)) return "수행 가능 여부 값이 올바르지 않습니다.";
    if (it.amount && !/^\d{1,13}$/.test(it.amount)) return "금액은 숫자만 입력합니다.";
    if (it.weeks && !/^\d{1,3}$/.test(it.weeks)) return "기간은 주 단위 숫자만 입력합니다.";
  }
  return { items, note: typeof b.note === "string" ? b.note.slice(0, 2000) : "" };
}

async function upsert(token: string, items: ReplyItem[], note: string, submit: boolean, pdf?: File) {
  const got = await load(token);
  if (!got) return { error: "유효하지 않거나 만료된 링크입니다.", status: 404 };
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
    const path = `${got.rfq.no}/${got.inviteId}/${Date.now()}_${pdf.name.replace(/[^\w.\-가-힣]/g, "_")}`;
    const { error: up } = await sb.storage.from("cro-files").upload(path, Buffer.from(await pdf.arrayBuffer()), { contentType: pdf.type || "application/pdf" });
    if (up) return { error: "PDF 업로드에 실패했습니다.", status: 500 };
    header.pdf_path = path;
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
  const parsed = parseBody(await req.json().catch(() => null), got.rfq.rows);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });
  const r = await upsert(token, parsed.items, parsed.note, false);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}

/** POST — 제출 (multipart: payload=JSON, pdf=File). 전 항목 답변 + PDF 필수 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const got = await load(token);
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });

  let raw: unknown;
  let pdf: File | undefined;
  try {
    const fd = await req.formData();
    raw = JSON.parse(String(fd.get("payload") || "{}"));
    const f = fd.get("pdf");
    if (f instanceof File && f.size > 0) pdf = f;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const parsed = parseBody(raw, got.rfq.rows);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const incomplete = parsed.items.some((it) => !(it.avail === "불가" || (it.avail && it.amount && it.weeks)));
  if (incomplete) return NextResponse.json({ error: "모든 항목의 가능 여부·금액·기간을 채워 주세요." }, { status: 400 });
  if (parsed.items.every((it) => it.avail === "불가")) return NextResponse.json({ error: "전 항목 불가는 회신하지 않음으로 처리해 주세요." }, { status: 400 });
  if (!pdf && !got.draft?.pdfName) return NextResponse.json({ error: "정식 견적서 PDF를 첨부해 주세요." }, { status: 400 });
  if (pdf && pdf.size > MAX_PDF) return NextResponse.json({ error: "PDF는 20MB 이하만 첨부할 수 있습니다." }, { status: 400 });

  const r = await upsert(token, parsed.items, parsed.note, true, pdf);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, total: r.total ?? null, weeks: r.weeks ?? null });
}
