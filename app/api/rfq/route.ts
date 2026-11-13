import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isProduction } from "@/lib/env";
import { captureError } from "@/lib/observe";
import { getSupabaseAdmin } from "@/lib/supabase";
import { type Values } from "@/lib/rfq-schema";
import { nowSeoul } from "@/lib/dates";
import { sessionOrNull } from "@/lib/auth";
import { clientIp, rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { cleanFiles, createRfq, prepareValues, type FileMeta } from "@/lib/rfq-create";
import { PREREG_BLOCKED } from "@/lib/prereg";
import { sessionInPrereg } from "@/lib/prereg-server";

export const runtime = "nodejs";

/** 요청서 내용의 지문. 같은 내용이 잇달아 들어왔는지 볼 때만 쓴다 */
function payloadKey(values: Values): string {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex").slice(0, 32);
}
export const dynamic = "force-dynamic";

/**
 * POST /api/rfq  (JSON: { payload: Values, files?: FileMeta[] })  - 로그인 필수
 *
 * 1) 세션 확인 + 속도 제한(공유 카운터) + 허니팟 + 필수 검증
 * 2) 채번 → rfq_requests 저장 → 첨부마다 서명 업로드 URL 발급 (lib/rfq-create.ts)
 *    - 파일 본문은 브라우저가 서명 URL로 직접 올린다
 *    - 의뢰자 이메일은 항상 계정 이메일이다 (본문 값은 쓰지 않는다)
 * 3) 여기서는 기관에 전달하지 않는다. 위자드가 첨부를 다 올린 뒤(없으면 바로) /api/rfq/[no]/start 를 부른다.
 *    기관이 첨부 없는 요청서를 먼저 받는 일을 막는다. 위자드가 끝내 못 부르면 요청 화면의 "지금 보내기"나 다음 예약 작업(매일 오전 9시)이 시작한다.
 */
export async function POST(req: Request) {
  const sess = await sessionOrNull();
  if (!sess) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  // 사전예약 기간의 새 계정은 요청을 보낼 수 없다 (lib/prereg.ts)
  if (await sessionInPrereg(sess)) return NextResponse.json({ error: PREREG_BLOCKED, early: "/early" }, { status: 403 });
  const ip = clientIp(req);
  if ((await rateLimited("rfq:user", sess.userId, 5, 10 * 60)) || (await rateLimited("rfq:ip", ip, 10, 10 * 60))) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }

  let values: Values;
  let files: FileMeta[] = [];
  try {
    const body = (await req.json()) as { payload?: unknown; files?: unknown };
    if (!body.payload || typeof body.payload !== "object") throw new Error("payload");
    values = body.payload as Values;
    files = cleanFiles(body.files);
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const year = nowSeoul().getFullYear();

  // 허니팟 - 사람은 볼 수 없는 칸
  if (typeof values.website === "string" && values.website.trim()) {
    console.warn("[danchu] honeypot", ip);
    return NextResponse.json({ rfqNo: `DC-${year}-0000`, persisted: false, uploads: [] });
  }
  const err = prepareValues(values, files);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  if (!getSupabaseAdmin()) {
    // 환경변수 미설정. 운영에서는 "접수된 것처럼" 200 을 돌려주면 안 된다
    if (isProduction()) {
      captureError(new Error("SUPABASE 미설정"), "rfq:config");
      return NextResponse.json({ error: "지금은 접수를 저장할 수 없어요. 잠시 후 다시 시도하거나 support@danchu.kr로 알려 주세요." }, { status: 503 });
    }
    // 로컬: 임시 번호 발급 (9000번대). 폼 내용은 로그에 남기지 않는다
    const rfqNo = `DC-${year}-9${String(Date.now() % 1000).padStart(3, "0")}`;
    console.warn("[danchu] SUPABASE 미설정 - 임시 접수", rfqNo);
    return NextResponse.json({ rfqNo, persisted: false, uploads: [] });
  }

  // 같은 요청서가 잇달아 두 번 들어오면(버튼 두 번, 응답을 못 받은 재시도) 한 건만 만든다
  const sb = getSupabaseAdmin()!;
  if (await rateLimited("rfq:same", `${sess.userId}:${payloadKey(values)}`, 1, 30)) {
    const { data: prev } = await sb.from("rfq_requests").select("rfq_no").eq("user_id", sess.userId).eq("substance", String(values.substance ?? "").trim()).gte("created_at", new Date(Date.now() - 60_000).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (prev?.rfq_no) return NextResponse.json({ rfqNo: prev.rfq_no, persisted: true, uploads: [], duplicate: true });
    return NextResponse.json({ error: "같은 요청서를 저장하고 있어요. 잠시 뒤 내 요청에서 확인해 주세요." }, { status: 409 });
  }

  try {
    const { rfqNo, uploads } = await createRfq({ values, files, user: { id: sess.userId, email: sess.email }, ip, ua: req.headers.get("user-agent") });
    return NextResponse.json({ rfqNo, persisted: true, uploads });
  } catch (e) {
    console.error("supabase", e);
    return NextResponse.json({ error: "접수 저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
