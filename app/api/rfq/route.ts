import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendRfqMails } from "@/lib/mail";
import { validateRequired, type Values } from "@/lib/rfq-schema";
import { nowSeoul } from "@/lib/dates";
import { safeName, type UploadTicket } from "@/lib/upload";
import { sessionOrNull } from "@/lib/auth";
import { adminUserIds, logEvent, notifyUsers } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE = 20 * 1024 * 1024;
const MAX_FILES = 10;

/* ── 남용 방어 ──
   - 허니팟: 화면에 보이지 않는 `website` 칸이 채워져 있으면 봇으로 보고 저장·발송 없이 성공처럼 응답
   - 속도 제한: IP당 10분에 5건 (서버리스 인스턴스 단위라 완전하지는 않지만 메일 폭탄은 막는다) */
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > LIMIT;
}

type FileMeta = { name: string; size: number; type: string };

/**
 * POST /api/rfq  (JSON: { payload: Values, files?: FileMeta[] })
 *
 * 1) 1단계 필수 검증 + 허니팟·속도 제한
 * 2) Supabase: 채번(next_rfq_no) → rfq_requests insert → 첨부마다 서명 업로드 URL 발급 + rfq_files insert
 *    - 파일 본문은 브라우저가 서명 URL로 직접 올린다
 *    - 환경변수 미설정 시: 임시 번호(DC-YYYY-9xxx)로 응답하고 서버 로그에 기록 (데모/로컬용)
 * 3) Resend: 의뢰자 확인 메일 + 운영자 알림 (키 없으면 건너뜀)
 */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (rateLimited(ip || "unknown")) {
    return NextResponse.json({ error: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  let values: Values;
  let files: FileMeta[] = [];
  try {
    const body = (await req.json()) as { payload?: unknown; files?: unknown };
    if (!body.payload || typeof body.payload !== "object") throw new Error("payload");
    values = body.payload as Values;
    files = (Array.isArray(body.files) ? body.files : [])
      .filter((f): f is FileMeta => !!f && typeof f === "object" && typeof (f as FileMeta).name === "string" && typeof (f as FileMeta).size === "number")
      .map((f) => ({ name: String(f.name).slice(0, 200), size: f.size, type: typeof f.type === "string" ? f.type.slice(0, 100) : "" }));
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const year = nowSeoul().getFullYear();

  // 허니팟 — 사람은 볼 수 없는 칸
  if (typeof values.website === "string" && values.website.trim()) {
    console.warn("[danchu] honeypot", ip);
    return NextResponse.json({ rfqNo: `DC-${year}-0000`, persisted: false, mail: { requester: false, admin: false }, uploads: [] });
  }
  delete values.website;

  const err = validateRequired(values);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `첨부는 최대 ${MAX_FILES}개까지 가능합니다.` }, { status: 400 });
  if (files.some((f) => f.size > MAX_FILE || f.size <= 0)) return NextResponse.json({ error: "파일당 20MB 이하만 첨부할 수 있습니다." }, { status: 400 });

  // 조회 컬럼은 문자열만 허용 (배열·불리언이 들어오면 insert가 터진다)
  const str = (k: string) => (typeof values[k] === "string" ? (values[k] as string).trim() : "");
  const nul = (k: string) => str(k) || null;

  const supabase = getSupabaseAdmin();
  let rfqNo: string;
  let persisted = false;
  const uploads: UploadTicket[] = [];

  // 로그인 사용자면 계정에 연결. 앱에서 온 요청은 이메일을 계정 이메일로 고정한다.
  const sess = await sessionOrNull();
  if (sess && values.source === "app") values.email = sess.email;
  let userId: string | null = sess?.userId ?? null;

  if (supabase) {
    try {
      if (!userId) {
        // 로그인 없이 접수했지만 같은 이메일의 계정이 있으면 연결
        const { data: prof } = await supabase.from("profiles").select("id").ilike("email", str("email")).maybeSingle();
        userId = (prof?.id as string) ?? null;
      }
      const { data: no, error: e1 } = await supabase.rpc("next_rfq_no", { p_year: year });
      if (e1 || !no) throw e1 || new Error("채번 실패");
      rfqNo = String(no);

      const { data: row, error: e2 } = await supabase
        .from("rfq_requests")
        .insert({
          rfq_no: rfqNo,
          submitted_step: String(values.submittedStep) === "2" ? 2 : 1,
          company: str("company"),
          contact_name: str("name"),
          email: str("email"),
          phone: nul("phone"),
          org_type: nul("orgType"),
          purpose: nul("purpose"),
          substance: str("substance"),
          categories: Array.isArray(values.categories) ? values.categories : [],
          budget: nul("budget"),
          cro_count: nul("croCount"),
          confidentiality: nul("confid"),
          reply_by: /^\d{4}-\d{2}-\d{2}$/.test(str("replyBy")) ? str("replyBy") : null,
          payload: values,
          user_id: userId,
          user_agent: req.headers.get("user-agent"),
          ip: /^[0-9a-fA-F.:]+$/.test(ip) ? ip : null,
        })
        .select("id")
        .single();
      if (e2 || !row) throw e2 || new Error("저장 실패");

      for (const f of files) {
        const path = `${rfqNo}/${Date.now()}-${safeName(f.name)}`;
        const { data: signed, error: e3 } = await supabase.storage.from("rfq-files").createSignedUploadUrl(path);
        if (e3 || !signed) {
          console.error("signed upload url", e3);
          continue;
        }
        await supabase.from("rfq_files").insert({
          rfq_id: row.id,
          storage_path: path,
          file_name: f.name,
          size_bytes: f.size,
          mime_type: f.type || null,
        });
        uploads.push({ name: f.name, path, signedUrl: signed.signedUrl });
      }
      persisted = true;

      const cats = Array.isArray(values.categories) ? (values.categories as string[]).join(" · ") : "";
      await logEvent(row.id, "received", "접수", `${cats}${files.length ? ` · 첨부 ${files.length}건` : ""}`, userId);
      await notifyUsers(await adminUserIds(), { kind: "접수", title: `새 요청 ${rfqNo} · ${str("company")}`, body: `${str("substance")} · ${cats}`, href: `/admin/r/${rfqNo}` });
      if (userId) await notifyUsers([userId], { kind: "접수", title: `${rfqNo} 접수되었습니다`, body: "요청서를 정리해 영업일 1일 내 참여 CRO에 배포합니다.", href: `/app/r/${rfqNo}` });
    } catch (e) {
      console.error("supabase", e);
      return NextResponse.json({ error: "접수 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
  } else {
    // 환경변수 미설정: 임시 번호 발급 (9000번대) + 로그
    rfqNo = `DC-${year}-9${String(Date.now() % 1000).padStart(3, "0")}`;
    console.warn("[danchu] SUPABASE 미설정 — 임시 접수", rfqNo, JSON.stringify(values));
  }

  let mail = { requester: false, admin: false };
  try {
    mail = await sendRfqMails({ rfqNo, values, fileNames: files.map((f) => f.name) });
  } catch (e) {
    console.error("mail", e);
  }

  return NextResponse.json({ rfqNo, persisted, mail, uploads });
}
