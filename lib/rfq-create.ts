/**
 * 요청 생성과 시작.
 *
 * - createRfq: 채번 → rfq_requests 저장 → (선택) 첨부 서명 업로드 URL 발급. 로그인 접수와 "보내기 직전 가입" 접수가 함께 쓴다.
 * - startRfq: 기관 전달 + 접수·전달 결과 메일 한 통. 첨부 업로드가 끝난 뒤 한 번만 실행된다(started_at 으로 막는다).
 *   첨부가 없으면 접수 직후, 있으면 업로드 완료 뒤 위자드가 /api/rfq/[no]/start 로 부른다.
 *   위자드가 끝까지 못 부르면(창을 닫는 등) 요청 화면의 "지금 보내기"나 매일 오전 9시 예약 작업이 시작한다.
 */
import { cleanNominees, joinDeadline } from "./request-policy";
import { getSupabaseAdmin } from "./supabase";
import { CONSENT_VERSION, validateRequired, type Values } from "./rfq-schema";
import { addBusinessDays, nowSeoul } from "./dates";
import { opaqueObjectName, type UploadTicket } from "./upload";
import { captureError } from "./observe";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "./notify";
import { autoDistribute } from "./distribute";
import { sendRfqMails } from "./mail";
import type { RfqRow } from "./data";

export const MAX_FILE = 20 * 1024 * 1024;
export const MAX_FILES = 10;
export type FileMeta = { name: string; size: number; type: string };

/** 본문의 files 배열을 안전한 모양으로 */
export function cleanFiles(raw: unknown): FileMeta[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((f): f is FileMeta => !!f && typeof f === "object" && typeof (f as FileMeta).name === "string" && typeof (f as FileMeta).size === "number")
    .map((f) => ({ name: String(f.name).slice(0, 200), size: f.size, type: typeof f.type === "string" ? f.type.slice(0, 100) : "" }));
}

/**
 * 접수 전 공통 검증과 정리. 오류면 문자열을 돌려준다.
 * values 는 제자리에서 정리된다 (허니팟 제거, 회신 희망일 기본값).
 */
export function prepareValues(values: Values, files: FileMeta[]): string {
  delete values.website;
  values.source = "app";
  // 동의한 문구의 판(약관·개인정보처리방침·요청 내용 제공 동의). 제공 범위가 바뀌면 판이 바뀌므로 요청마다 남긴다
  values.consentVersion = CONSENT_VERSION;
  const today = nowSeoul().toLocaleDateString("sv-SE");
  if (values.replyBy) {
    const date = String(values.replyBy);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < today) return "회신 희망일은 오늘 이후의 날짜로 입력해 주세요.";
  } else values.replyBy = addBusinessDays(nowSeoul(), 7).toLocaleDateString("sv-SE");
  const err = validateRequired(values);
  if (err) return err;
  if (files.length > MAX_FILES) return `첨부는 최대 ${MAX_FILES}개까지 가능합니다.`;
  if (files.some((f) => f.size > MAX_FILE || f.size <= 0)) return "파일당 20MB 이하만 첨부할 수 있습니다.";
  return "";
}

export type CreateInput = {
  values: Values;
  files: FileMeta[];
  user: { id: string; email: string };
  ip: string;
  ua: string | null;
  /** false 면 서명 업로드 URL을 만들지 않는다 (임시 요청서에서 옮겨 오는 경우) */
  tickets?: boolean;
};

export async function createRfq(input: CreateInput): Promise<{ rfqId: string; rfqNo: string; uploads: UploadTicket[] }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("저장소 미설정");
  const { values, files, user } = input;
  values.email = user.email;
  const str = (k: string) => (typeof values[k] === "string" ? (values[k] as string).trim() : "");
  const nul = (k: string) => str(k) || null;
  const year = nowSeoul().getFullYear();

  // 지명 기관: 승인된 기관 이름에 있는 것만 남긴다 (화면에서 고른 값이라도 서버에서 다시 거른다)
  if (values.nominees !== undefined) {
    // 운영자 관리 기관은 지명 대상이 아니다 (/api/orgs 목록에도 없다)
    const { data: approvedOrgs } = await supabase.from("cro_orgs").select("name").eq("status", "approved").eq("managed", false);
    const cleaned = cleanNominees(values.nominees, str("croCount"), (approvedOrgs ?? []).map((o) => o.name as string));
    if (cleaned.length) values.nominees = cleaned;
    else delete values.nominees;
  }
  // "지명 기관에만 안내"(기본 꺼짐)는 지명 기관이 남아 있을 때만 켠다. 지명 기관 없이 켜면 아무에게도 안내가 가지 않는다
  const nomineesOnly = values.nomineesOnly === true && Array.isArray(values.nominees) && values.nominees.length > 0;
  if (nomineesOnly) values.nomineesOnly = true;
  else delete values.nomineesOnly;
  const replyBy = /^\d{4}-\d{2}-\d{2}$/.test(str("replyBy")) ? str("replyBy") : null;
  const { data: no, error: e1 } = await supabase.rpc("next_rfq_no", { p_year: year });
  if (e1 || !no) throw e1 || new Error("채번 실패");
  const rfqNo = String(no);

  const { data: row, error: e2 } = await supabase
    .from("rfq_requests")
    .insert({
      rfq_no: rfqNo,
      submitted_step: String(values.submittedStep) === "2" ? 2 : 1,
      company: str("company"),
      contact_name: str("name"),
      email: user.email,
      phone: nul("phone"),
      org_type: nul("orgType"),
      purpose: nul("purpose"),
      substance: str("substance"),
      categories: Array.isArray(values.categories) ? values.categories : [],
      budget: nul("budget"),
      cro_count: nul("croCount"),
      confidentiality: nul("confid"),
      intent: nul("intent"),
      reply_by: replyBy,
      // 참여 결정 기한: 안내 뒤 2영업일, 회신 기한이 5영업일 안이면 1영업일 (0023, lib/request-policy.ts joinDeadline).
      // 첨부 업로드가 끝난 뒤 처음 안내할 때 그날부터 다시 잡는다 (lib/distribute.ts distributeTo)
      join_by: joinDeadline(nowSeoul().toLocaleDateString("sv-SE"), replyBy),
      nominees_only: nomineesOnly,
      payload: values,
      user_id: user.id,
      user_agent: input.ua,
      ip: input.ip !== "unknown" ? input.ip : null,
    })
    .select("id")
    .single();
  if (e2 || !row) throw e2 || new Error("저장 실패");
  const rfqId = row.id as string;

  const uploads: UploadTicket[] = [];
  if (input.tickets !== false) {
    for (const f of files) {
      const path = `${rfqNo}/${opaqueObjectName(f.name)}`;
      const { data: signed, error: e3 } = await supabase.storage.from("rfq-files").createSignedUploadUrl(path);
      if (e3 || !signed) {
        console.error("signed upload url", e3);
        continue;
      }
      await supabase.from("rfq_files").insert({ rfq_id: rfqId, storage_path: path, file_name: f.name, size_bytes: f.size, mime_type: f.type || null });
      uploads.push({ name: f.name, path, signedUrl: signed.signedUrl });
    }
  }
  const cats = Array.isArray(values.categories) ? (values.categories as string[]).join(" · ") : "";
  await logEvent(rfqId, "received", "접수", `${cats}${files.length ? ` · 첨부 ${files.length}건` : ""}`, user.id);
  return { rfqId, rfqNo, uploads };
}

/**
 * 기관 전달을 시작한다. 이미 시작했으면 아무것도 하지 않는다.
 * 1) 운영자 알림 2) 자동 전달(지명 기관 먼저) 3) 의뢰자에게 접수와 전달 결과를 한 통으로
 */
export async function startRfq(rfqId: string): Promise<{ started: boolean; sent: number }> {
  // sent 는 운영 기록·완료 판정용이다. 의뢰자에게는 안내한 기관 수를 보여 주지 않는다 (참여 선택형, 0023)
  const sb = getSupabaseAdmin();
  if (!sb) return { started: false, sent: 0 };
  // 동시에 두 번 불려도 한 번만 시작한다
  // 마무리·취소한 요청은 시작하지 않는다
  const { data: claimed } = await sb.from("rfq_requests").update({ started_at: new Date().toISOString() }).eq("id", rfqId).is("started_at", null).in("status", ["received", "distributed", "quoted"]).select("*").maybeSingle();
  if (!claimed) return { started: false, sent: 0 };
  const rfq = claimed as RfqRow;
  const p = rfq.payload;
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  const cats = rfq.categories.join(" · ");
  const { count: fileCount } = await sb.from("rfq_files").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id);

  // 운영자에게는 앱 알림만. 요청서 전체가 담긴 메일은 sendRfqMails 가 따로 보낸다
  await notifyUsers(await adminUserIds(), { kind: "접수", title: `새 요청 ${rfq.rfq_no} · ${rfq.company}`, body: `${rfq.substance} · ${cats}`, href: `/admin/r/${rfq.rfq_no}` }).catch((e) => console.error("start notify admin", e));

  let sent = 0;
  let matched = 0;
  let failed = false;
  let replyBy = rfq.reply_by || s("replyBy");
  try {
    const r = await autoDistribute(rfq, { notifyRequester: false });
    sent = r.sent;
    matched = r.matched;
    if (r.skipped.length) await logEvent(rfq.id, "distributed", `전달 제외 ${r.skipped.length}곳`, r.skipped.join(", "), null, { skipped: r.skipped });
    const { data: fresh } = await sb.from("rfq_requests").select("reply_by").eq("id", rfq.id).maybeSingle();
    replyBy = fresh?.reply_by || replyBy;
  } catch (e) {
    // DB 조회 실패·마이그레이션 미적용은 "대상 없음"이 아니다. 운영자가 알아야 직접 안내하거나 DB 를 고친다
    failed = true;
    captureError(e, "rfq:auto-distribute", { rfqNo: rfq.rfq_no });
  }

  if (failed) {
    await notifyUsers(await adminUserIds(), { kind: "배포", title: `${rfq.rfq_no} 자동 안내 실패`, body: "안내 대상을 조회하거나 초대를 만드는 중 오류가 났습니다. 오류 기록과 DB 판(npm run check:schema)을 확인한 뒤 직접 안내해 주세요.", href: `/admin/r/${rfq.rfq_no}` }, { to: adminEmails() }).catch(() => {});
  } else if (!matched || !sent) {
    await notifyUsers(await adminUserIds(), { kind: "배포", title: `${rfq.rfq_no} 안내할 기관 없음`, body: "분야가 맞는 승인 기관이 없거나 메일을 보낼 수 없었습니다. 참여 안내를 보낼 기관을 직접 골라 주세요.", href: `/admin/r/${rfq.rfq_no}` }, { to: adminEmails() }).catch(() => {});
  }
  if (rfq.user_id) {
    // 의뢰자에게는 안내한 기관 수를 알리지 않는다. 참여한 기관 수와 제출 수만 진행 현황으로 보인다 (0023, 2026-10-20 결정 1)
    await notifyUsers([rfq.user_id], sent
      ? { kind: "접수", title: `${rfq.rfq_no} 접수했고, 참여 안내를 보냈습니다`, body: `회신 기한 ${replyBy} · 분야가 맞는 기관이 참여를 결정하면 요청 화면에 참여·제출 수가 보입니다. 비교표는 회신 기한이 지나거나, 참여 결정이 끝난 뒤 참여한 기관이 모두 제출하면 열리고, 그때 메일로 알려 드립니다.`, href: `/app/r/${rfq.rfq_no}` }
      : { kind: "접수", title: `${rfq.rfq_no} 접수했습니다 · 참여 안내를 보낼 기관을 찾고 있습니다`, body: "요청 분야에 바로 맞는 참여 기관이 없어 운영자가 직접 안내할 기관을 정합니다. 보통 영업일 1~2일 안에 결과를 알려 드리고, 맞는 기관이 없으면 그 사실을 안내합니다. 기다리지 않으시려면 요청 화면에서 마무리할 수 있습니다.", href: `/app/r/${rfq.rfq_no}` },
    );
  }
  try {
    await sendRfqMails({ rfqNo: rfq.rfq_no, values: { ...p, email: rfq.email }, fileNames: [], fileCount: fileCount ?? 0, sent, replyBy });
  } catch (e) {
    console.error("mail", e);
  }
  return { started: true, sent };
}
