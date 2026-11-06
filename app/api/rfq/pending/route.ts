import { NextResponse } from "next/server";
import { type Values } from "@/lib/rfq-schema";
import { EMAIL_RE } from "@/lib/auth-links";
import { clientIp, rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { cleanFiles, prepareValues, type FileMeta } from "@/lib/rfq-create";
import { createPending } from "@/lib/rfq-pending";
import { inPrereg, preregActive, PREREG_BLOCKED } from "@/lib/prereg";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { payload: Values, files?: FileMeta[] } — 로그인 전 의뢰자의 "보내기".
 * payload 에는 이메일·회사명·담당자 성명이 들어 있다 (보내기 직전 확인 창에서 받는다).
 * 요청서를 맡기고 인증번호 메일을 보낸다. 응답의 uploads 로 브라우저가 첨부를 바로 올린다.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
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
  // 허니팟: 사람은 볼 수 없는 칸. 받은 척하고 아무것도 하지 않는다
  if (typeof values.website === "string" && values.website.trim()) {
    console.warn("[danchu] honeypot pending", ip);
    return NextResponse.json({ token: "x".repeat(32), uploads: [], mailed: true, codeLength: 6 });
  }
  const email = typeof values.email === "string" ? values.email.trim().toLowerCase().slice(0, 200) : "";
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "이메일 형식을 확인해 주세요." }, { status: 400 });
  values.email = email;
  // 로그인 없이 계정·메일·업로드 주소를 만드는 경로라 IP 는 하루 한도도 둔다
  if ((await rateLimited("pending:ip", ip, 8, 60 * 60)) || (await rateLimited("pending:ip-day", ip, 20, 24 * 60 * 60)) || (await rateLimited("pending:email", email, 5, 60 * 60))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  // 사전예약 기간: 이 이메일로 미리 만든 계정(사전예약 모드가 아닌 계정)만 보낼 수 있다. 새 이메일은 사전예약으로 안내한다
  if (preregActive() && !(await canSendDuringPrereg(email))) {
    return NextResponse.json({ error: PREREG_BLOCKED, early: "/early" }, { status: 403 });
  }

  const err = prepareValues(values, files);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const r = await createPending({ email, values, files, ip });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}

async function canSendDuringPrereg(email: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return true; // DB 가 없으면 어차피 접수되지 않는다
  const { data } = await sb.from("profiles").select("role, email, created_at").eq("email", email).maybeSingle();
  return !!data && !inPrereg(data);
}
