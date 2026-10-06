import { NextResponse, after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendRfqMails } from "@/lib/mail";
import { validateRequired, type Values } from "@/lib/rfq-schema";
import { addBusinessDays, nowSeoul } from "@/lib/dates";
import { safeName, type UploadTicket } from "@/lib/upload";
import { sessionOrNull } from "@/lib/auth";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { autoDistribute } from "@/lib/distribute";
import { clientIp, rateLimited, TOO_MANY } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE = 20 * 1024 * 1024;
const MAX_FILES = 10;

type FileMeta = { name: string; size: number; type: string };

/**
 * POST /api/rfq  (JSON: { payload: Values, files?: FileMeta[] })  - 로그인 필수
 *
 * 1) 세션 확인 + 속도 제한(공유 카운터) + 허니팟 + 1단계 필수 검증
 * 2) Supabase: 채번(next_rfq_no) → rfq_requests insert → 첨부마다 서명 업로드 URL 발급 + rfq_files insert
 *    - 파일 본문은 브라우저가 서명 URL로 직접 올린다
 *    - 의뢰자 이메일은 항상 계정 이메일이다 (본문 값은 쓰지 않는다)
 * 3) 응답 뒤(after): 운영자 알림, 자동 배포(기관 초대·메일), 접수 확인 메일
 *    - 배포와 메일은 응답을 기다리게 하지 않는다. 기관 수가 늘어도 접수 응답은 일정하다
 */
export async function POST(req: Request) {
  const sess = await sessionOrNull();
  if (!sess) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
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
    files = (Array.isArray(body.files) ? body.files : [])
      .filter((f): f is FileMeta => !!f && typeof f === "object" && typeof (f as FileMeta).name === "string" && typeof (f as FileMeta).size === "number")
      .map((f) => ({ name: String(f.name).slice(0, 200), size: f.size, type: typeof f.type === "string" ? f.type.slice(0, 100) : "" }));
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const year = nowSeoul().getFullYear();

  // 허니팟 - 사람은 볼 수 없는 칸
  if (typeof values.website === "string" && values.website.trim()) {
    console.warn("[danchu] honeypot", ip);
    return NextResponse.json({ rfqNo: `DC-${year}-0000`, persisted: false, uploads: [] });
  }
  delete values.website;

  // 의뢰자 연락처는 계정 기준으로 고정한다
  values.email = sess.email;
  values.source = "app";

  const today = nowSeoul().toLocaleDateString("sv-SE");
  if (values.replyBy) {
    const date = String(values.replyBy);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < today) return NextResponse.json({ error: "회신 희망일은 오늘 이후의 날짜로 입력해 주세요." }, { status: 400 });
  } else values.replyBy = addBusinessDays(nowSeoul(), 7).toLocaleDateString("sv-SE");
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
  const userId = sess.userId;

  if (supabase) {
    let rfqId: string;
    try {
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
          email: sess.email,
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
          ip: ip !== "unknown" ? ip : null,
        })
        .select("id")
        .single();
      if (e2 || !row) throw e2 || new Error("저장 실패");
      rfqId = row.id as string;

      for (const f of files) {
        const path = `${rfqNo}/${Date.now()}-${safeName(f.name)}`;
        const { data: signed, error: e3 } = await supabase.storage.from("rfq-files").createSignedUploadUrl(path);
        if (e3 || !signed) {
          console.error("signed upload url", e3);
          continue;
        }
        await supabase.from("rfq_files").insert({
          rfq_id: rfqId,
          storage_path: path,
          file_name: f.name,
          size_bytes: f.size,
          mime_type: f.type || null,
        });
        uploads.push({ name: f.name, path, signedUrl: signed.signedUrl });
      }
      persisted = true;

      const cats = Array.isArray(values.categories) ? (values.categories as string[]).join(" · ") : "";
      await logEvent(rfqId, "received", "접수", `${cats}${files.length ? ` · 첨부 ${files.length}건` : ""}`, userId);
      await notifyUsers([userId], { kind: "접수", title: `${rfqNo} 접수되었습니다`, body: "시험 분야가 맞는 기관을 확인해 요청을 전달합니다. 실제 전달 현황은 앱에서 확인할 수 있습니다.", href: `/app/r/${rfqNo}` });
    } catch (e) {
      console.error("supabase", e);
      return NextResponse.json({ error: "접수 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }

    // 응답 뒤: 운영자 알림 → 자동 배포(분야가 맞는 승인 기관 전부) → 접수 확인 메일
    const no = rfqNo;
    const fileNames = files.map((f) => f.name);
    after(async () => {
      const cats = Array.isArray(values.categories) ? (values.categories as string[]).join(" · ") : "";
      try {
        await notifyUsers(await adminUserIds(), { kind: "접수", title: `새 요청 ${no} · ${str("company")}`, body: `${str("substance")} · ${cats}`, href: `/admin/r/${no}` });
        const { data: full } = await supabase.from("rfq_requests").select("*").eq("id", rfqId).single();
        if (full) {
          const r = await autoDistribute(full);
          if (!r.matched) {
            await notifyUsers(await adminUserIds(), { kind: "배포", title: `${no} 자동 배포 대상 없음`, body: "분야가 맞는 승인 기관이 없습니다. 수동 배포가 필요합니다.", href: `/admin/r/${no}` }, { to: adminEmails() });
          } else if (r.skipped.length) {
            await logEvent(rfqId, "distributed", `배포 제외 ${r.skipped.length}곳`, r.skipped.join(", "), null, { skipped: r.skipped });
          }
        }
      } catch (e) {
        console.error("auto distribute", e);
      }
      try {
        await sendRfqMails({ rfqNo: no, values, fileNames });
      } catch (e) {
        console.error("mail", e);
      }
    });
  } else {
    // 환경변수 미설정: 임시 번호 발급 (9000번대) + 로그
    rfqNo = `DC-${year}-9${String(Date.now() % 1000).padStart(3, "0")}`;
    console.warn("[danchu] SUPABASE 미설정 - 임시 접수", rfqNo, JSON.stringify(values));
  }

  return NextResponse.json({ rfqNo, persisted, uploads });
}
