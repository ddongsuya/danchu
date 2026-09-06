import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendRfqMails } from "@/lib/mail";
import { validateRequired, type Values } from "@/lib/rfq-schema";
import { nowSeoul } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE = 20 * 1024 * 1024;
const MAX_FILES = 10;

/**
 * POST /api/rfq  (multipart/form-data: payload=JSON, files[]=File)
 *
 * 1) 1단계 필수 검증
 * 2) Supabase: 채번(next_rfq_no) → rfq_requests insert → Storage 업로드 → rfq_files insert
 *    - 환경변수 미설정 시: 임시 번호(DC-YYYY-9xxx)로 응답하고 서버 로그에 기록 (데모/로컬용)
 * 3) Resend: 의뢰자 확인 메일 + 운영자 알림 (키 없으면 건너뜀)
 */
export async function POST(req: Request) {
  let values: Values;
  let files: File[] = [];
  try {
    const fd = await req.formData();
    values = JSON.parse(String(fd.get("payload") || "{}")) as Values;
    files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const err = validateRequired(values);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `첨부는 최대 ${MAX_FILES}개까지 가능합니다.` }, { status: 400 });
  if (files.some((f) => f.size > MAX_FILE)) return NextResponse.json({ error: "파일당 20MB 이하만 첨부할 수 있습니다." }, { status: 400 });

  const year = nowSeoul().getFullYear();
  const supabase = getSupabaseAdmin();
  let rfqNo: string;
  let persisted = false;

  if (supabase) {
    try {
      const { data: no, error: e1 } = await supabase.rpc("next_rfq_no", { p_year: year });
      if (e1 || !no) throw e1 || new Error("채번 실패");
      rfqNo = String(no);

      const { data: row, error: e2 } = await supabase
        .from("rfq_requests")
        .insert({
          rfq_no: rfqNo,
          submitted_step: Number(values.submittedStep || 1),
          company: values.company,
          contact_name: values.name,
          email: values.email,
          phone: values.phone || null,
          org_type: values.orgType || null,
          purpose: values.purpose || null,
          substance: values.substance,
          categories: Array.isArray(values.categories) ? values.categories : [],
          budget: values.budget || null,
          cro_count: values.croCount || null,
          confidentiality: values.confid || null,
          reply_by: values.replyBy || null,
          payload: values,
          user_agent: req.headers.get("user-agent"),
          ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
        })
        .select("id")
        .single();
      if (e2 || !row) throw e2 || new Error("저장 실패");

      for (const f of files) {
        const safe = f.name.replace(/[^\w.\-가-힣]/g, "_");
        const path = `${rfqNo}/${Date.now()}-${safe}`;
        const { error: e3 } = await supabase.storage.from("rfq-files").upload(path, f, { contentType: f.type || undefined });
        if (e3) {
          console.error("storage upload", e3);
          continue;
        }
        await supabase.from("rfq_files").insert({
          rfq_id: row.id,
          storage_path: path,
          file_name: f.name,
          size_bytes: f.size,
          mime_type: f.type || null,
        });
      }
      persisted = true;
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

  return NextResponse.json({ rfqNo, persisted, mail });
}
