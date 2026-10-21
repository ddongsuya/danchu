import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { todaySeoul } from "@/lib/format";
import { audit } from "@/lib/audit";
import { captureError } from "@/lib/observe";
import { rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { planOptInTransition, runOptInTransition } from "@/lib/opt-in-transition";
import { SchemaNotReadyError } from "@/lib/schema-version";

export const runtime = "nodejs";

/**
 * 참여 선택형 전환 (0023 적용 뒤 운영자가 한 번 실행, lib/opt-in-transition.ts).
 * GET: 미리 보기 (전환할 열린 요청과 다시 보낼 관리 기관 안내). 아무것도 바꾸지 않는다.
 * POST: 실행. 요청마다 참여 결정 기한을 채우고 관리 기관에 참여 안내를 다시 보낸다. 처리한 요청은 다시 대상이 되지 않으므로 여러 번 눌러도 같은 메일이 두 번 가지 않는다.
 */
export async function GET() {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "DB 설정이 없습니다." }, { status: 500 });
  try {
    return NextResponse.json(await planOptInTransition(sb, todaySeoul()));
  } catch (e) {
    captureError(e, "opt-in-transition:plan");
    return NextResponse.json({ error: "전환 대상을 읽지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}

export async function POST() {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  if (await rateLimited("opt-in-transition", s.userId, 5, 3600)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "DB 설정이 없습니다." }, { status: 500 });
  try {
    const r = await runOptInTransition(sb, s.userId, todaySeoul());
    await audit({ userId: s.userId, email: s.email }, "rfq.opt_in_transition", { type: "rfq_request", id: null, label: `열린 요청 ${r.requests}건` }, { after: { requests: r.requests, mailed: r.mailed, failed: r.failed.length, skipped: r.skipped } });
    const parts = [`열린 요청 ${r.requests}건을 참여 선택형으로 바꾸고, 관리 기관 ${r.mailed}곳에 참여 안내를 다시 보냈습니다.`];
    if (r.failed.length) parts.push(`보내지 못한 ${r.failed.length}곳은 요청 화면의 메일 재발송으로 다시 보내 주세요.`);
    return NextResponse.json({ ok: true, ...r, message: parts.join(" ") });
  } catch (e) {
    captureError(e, "opt-in-transition:run");
    const msg = e instanceof SchemaNotReadyError ? "DB 판이 모자랍니다. README 배포 순서대로 0023 까지 적용한 뒤 다시 눌러 주세요." : "전환을 마치지 못했습니다. 처리된 요청은 다시 대상이 되지 않으니 잠시 후 다시 눌러 주세요.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
