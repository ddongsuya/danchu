import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { featureError } from "@/lib/plan-usage";
import { currentVia } from "@/lib/agent-context";
import { parseItem, parseMargin } from "@/lib/price-book";
import { archiveItem, createItem, loadPriceBook, setApplyTox, setMargin, updateItem } from "@/lib/price-book-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 효력시험 기관 단가표 (0047). 견적서 작성 툴(Pro) 요금제.
 *   GET                         단가표·관리비·이익 %·바꾼 기록
 *   POST   {category, name, attrs, unit, price, memo}  항목 추가
 *   PATCH  {id, ...같은 칸}      항목 고치기 (단가가 바뀌면 기록)
 *   DELETE {id}                  항목 숨기기 (옛 견적서가 가리킬 수 있어 지우지 않는다)
 *   PUT    {margin_pct}          관리비·이익 %
 *   PUT    {apply_tox}           독성시험 동물 단가에도 쓰기 (0051, 켜고 끄기)
 * 기관 담당자 모두 같이 쓴다. 다른 기관 행은 찾지 못한 것으로 답한다.
 */
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function gate() {
  const s = await sessionOrNull("cro");
  if (!s?.org || s.org.status !== "approved" || !s.profile.cro_org_id) return { err: bad("기관 담당자만 쓸 수 있어요.", 403) };
  const fe = featureError(s.org, "quote_tool");
  if (fe) return { err: bad(fe, 403) };
  const sb = getSupabaseAdmin();
  if (!sb) return { err: bad("지금은 저장할 수 없어요. 잠시 뒤 다시 시도해 주세요.", 503) };
  return { sb, orgId: s.profile.cro_org_id, userId: s.userId };
}
async function body(req: Request): Promise<Record<string, unknown> | null> {
  const b = await req.json().catch(() => null);
  return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
}
const fail = (what: string, e: unknown) => {
  console.error("price-book", what, e);
  return bad("단가표를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.", 500);
};

export async function GET() {
  const g = await gate();
  if ("err" in g) return g.err;
  try {
    return NextResponse.json(await loadPriceBook(g.sb!, g.orgId));
  } catch (e) {
    console.error("price-book read", e);
    return bad("단가표를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.", 500);
  }
}

export async function POST(req: Request) {
  const g = await gate();
  if ("err" in g) return g.err;
  const b = await body(req);
  if (!b) return bad("입력 모양이 맞지 않아요.");
  const p = parseItem(b);
  if (!p.ok) return bad(p.error);
  try {
    return NextResponse.json({ item: await createItem(g.sb!, g.orgId, p.value, g.userId, currentVia()) });
  } catch (e) {
    return fail("create", e);
  }
}

export async function PATCH(req: Request) {
  const g = await gate();
  if ("err" in g) return g.err;
  const b = await body(req);
  if (!b || !isUuid(b.id)) return bad("고칠 항목을 찾지 못했어요.", 404);
  const p = parseItem(b);
  if (!p.ok) return bad(p.error);
  try {
    const it = await updateItem(g.sb!, g.orgId, b.id, p.value, g.userId, currentVia());
    return it ? NextResponse.json({ item: it }) : bad("고칠 항목을 찾지 못했어요.", 404);
  } catch (e) {
    return fail("update", e);
  }
}

export async function DELETE(req: Request) {
  const g = await gate();
  if ("err" in g) return g.err;
  const b = await body(req);
  if (!b || !isUuid(b.id)) return bad("숨길 항목을 찾지 못했어요.", 404);
  try {
    return (await archiveItem(g.sb!, g.orgId, b.id, g.userId, currentVia())) ? NextResponse.json({ ok: true }) : bad("숨길 항목을 찾지 못했어요.", 404);
  } catch (e) {
    return fail("archive", e);
  }
}

export async function PUT(req: Request) {
  const g = await gate();
  if ("err" in g) return g.err;
  const b = await body(req);
  if (b && "apply_tox" in b) {
    if (typeof b.apply_tox !== "boolean") return bad("켜기·끄기 값이 맞지 않아요.");
    try {
      await setApplyTox(g.sb!, g.orgId, b.apply_tox);
      return NextResponse.json({ apply_tox: b.apply_tox });
    } catch (e) {
      return fail("apply_tox", e);
    }
  }
  const pct = parseMargin(b?.margin_pct);
  if (pct === null) return bad("관리비·이익은 0~300 사이 숫자로 적어 주세요.");
  try {
    await setMargin(g.sb!, g.orgId, pct);
    return NextResponse.json({ margin_pct: pct });
  } catch (e) {
    return fail("margin", e);
  }
}
