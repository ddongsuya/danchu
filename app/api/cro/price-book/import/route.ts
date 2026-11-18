import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { featureError } from "@/lib/plan-usage";
import { currentVia } from "@/lib/agent-context";
import { rateLimited } from "@/lib/rate-limit";
import { MAX_IMPORT_ROWS } from "@/lib/price-book";
import { importItems } from "@/lib/price-book-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 단가표 가져오기 (0047). 에이전트(기관 자료 분석)와 웹 엑셀 가져오기가 같이 쓴다.
 * POST { mode: "preview" | "apply", rows: [{category, name, attrs, unit, price, memo}] }
 *   preview: 저장하지 않고 줄마다 new · changed · same · error 를 돌려준다
 *   apply:   기관 담당자가 미리보기를 보고 승인한 뒤에만 부른다. new 는 추가, changed 는 단가 고침 (기록 남김)
 * 금액은 들어온 숫자만 받는다 ("약 4만" 같은 글자는 오류 줄).
 */
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  if (!s?.org || s.org.status !== "approved" || !s.profile.cro_org_id) return bad("기관 담당자만 쓸 수 있어요.", 403);
  const fe = featureError(s.org, "quote_tool");
  if (fe) return bad(fe, 403);
  const sb = getSupabaseAdmin();
  if (!sb) return bad("지금은 저장할 수 없어요. 잠시 뒤 다시 시도해 주세요.", 503);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mode = b?.mode === "apply" ? "apply" : b?.mode === "preview" ? "preview" : null;
  if (!mode || !Array.isArray(b?.rows)) return bad("입력 모양이 맞지 않아요.");
  if (b.rows.length === 0) return bad("가져올 항목이 없어요.");
  if (b.rows.length > MAX_IMPORT_ROWS) return bad(`한 번에 ${MAX_IMPORT_ROWS}줄까지 가져올 수 있어요.`);
  if (mode === "apply" && (await rateLimited("price-import", s.userId, 20, 600))) return bad("잠시 뒤 다시 시도해 주세요.", 429);
  try {
    const r = await importItems(sb, s.profile.cro_org_id, b.rows, mode, s.userId, currentVia());
    const count = (st: string) => r.rows.filter((x) => x.status === st).length;
    return NextResponse.json({ mode, rows: r.rows, summary: { new: count("new"), changed: count("changed"), same: count("same"), error: count("error") }, added: r.added, updated: r.changed });
  } catch (e) {
    console.error("price-book import", e);
    return bad("단가표를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.", 500);
  }
}
