import { createHmac, randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "./supabase";
import { captureError } from "./observe";

/**
 * 문자 알림 (0033). 발송은 솔라피(SOLAPI) REST API. 키가 없으면 보내지 않고 skipped 로 남긴다(개발·미리보기).
 * - 환경변수: SOLAPI_API_KEY, SOLAPI_API_SECRET, SMS_SENDER(사전 등록한 발신번호, 숫자만)
 * - 받는 사람: 프로필 휴대전화(profiles.phone), 문자 알림을 끄지 않은 사람(sms_notifications)
 * - 90바이트(한글 약 45자)를 넘으면 장문(LMS)으로 간다. 본문은 짧게, 자세한 내용은 링크로
 * - 같은 알림(dedupeKey)은 한 사람에게 한 번만 (sms_log 고유 색인)
 * 실패해도 던지지 않는다. 사이트 알림·이메일을 막지 않게
 */

export type SmsKind = "invite" | "selected" | "compare" | "contract" | "invoice";

/** 휴대전화 번호를 숫자 11자리(또는 10자리)로. 휴대전화가 아니면 null */
export function normalizeMobile(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "").replace(/^82(?=1)/, "0");
  return /^01[016789]\d{7,8}$/.test(d) ? d : null;
}

/** 기록용: 010-****-5678 */
export function maskPhone(d: string): string {
  return d.length >= 10 ? `${d.slice(0, 3)}-****-${d.slice(-4)}` : "****";
}

/** EUC-KR 기준 바이트 (한글 2, 그 밖 1). 통신사 단문 한도 90바이트 판정용 */
export function smsBytes(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  return n;
}

export function smsConfigured(): boolean {
  return !!(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && (process.env.SMS_SENDER || "").replace(/\D/g, ""));
}

/** 솔라피 인증 머리글: HMAC-SHA256(date + salt) */
export function solapiAuth(key: string, secret: string, date = new Date().toISOString(), salt = randomBytes(16).toString("hex")): string {
  const signature = createHmac("sha256", secret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}`;
}

/** 실제 발송 1건. 성공이면 메시지 ID */
async function sendViaSolapi(to: string, text: string): Promise<{ ok: true; id: string | null } | { ok: false; reason: string }> {
  const key = process.env.SOLAPI_API_KEY || "";
  const secret = process.env.SOLAPI_API_SECRET || "";
  const from = (process.env.SMS_SENDER || "").replace(/\D/g, "");
  if (!key || !secret || !from) return { ok: false, reason: "not_configured" };
  try {
    const r = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: { Authorization: solapiAuth(key, secret), "Content-Type": "application/json" },
      body: JSON.stringify({ message: { to, from, text, ...(smsBytes(text) > 90 ? { type: "LMS", subject: "[단추]" } : { type: "SMS" }) } }),
      signal: AbortSignal.timeout(8000),
    });
    const d = (await r.json().catch(() => ({}))) as { messageId?: string; statusCode?: string; errorCode?: string; errorMessage?: string };
    if (!r.ok || d.errorCode) return { ok: false, reason: `${d.errorCode ?? r.status} ${d.errorMessage ?? ""}`.trim().slice(0, 200) };
    return { ok: true, id: d.messageId ?? null };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message.slice(0, 200) : "network" };
  }
}

/**
 * 계정 여러 명에게 같은 문자. 휴대전화가 없거나 문자 알림을 끈 사람은 건너뛴다.
 * text 앞에 "[단추] " 를 붙인다. 돌려주는 값: 보낸 수
 */
export async function smsUsers(userIds: string[], m: { kind: SmsKind; text: string; dedupeKey?: string }): Promise<number> {
  const sb = getSupabaseAdmin();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!sb || !ids.length) return 0;
  const { data, error } = await sb.from("profiles").select("id, phone, sms_notifications").in("id", ids);
  if (error) {
    // 0033 전 DB(sms_notifications 없음)거나 일시 오류. 문자만 건너뛴다
    console.warn("[danchu] 문자 수신자 조회 실패", error.message);
    return 0;
  }
  const text = `[단추] ${m.text}`;
  let sent = 0;
  for (const p of (data ?? []) as { id: string; phone: string | null; sms_notifications?: boolean }[]) {
    if (p.sms_notifications === false) continue;
    const to = normalizeMobile(p.phone);
    if (!to) continue;
    if (m.dedupeKey) {
      const { data: dup } = await sb.from("sms_log").select("id").eq("user_id", p.id).eq("dedupe_key", m.dedupeKey).eq("status", "sent").limit(1);
      if (dup?.length) continue;
    }
    const r = await sendViaSolapi(to, text);
    const row = {
      user_id: p.id,
      phone_masked: maskPhone(to),
      kind: m.kind,
      dedupe_key: m.dedupeKey ?? null,
      status: r.ok ? ("sent" as const) : r.reason === "not_configured" ? ("skipped" as const) : ("failed" as const),
      reason: r.ok ? null : r.reason,
      provider_id: r.ok ? r.id : null,
    };
    const { error: logError } = await sb.from("sms_log").insert(row);
    if (logError && logError.code !== "23505") console.warn("[danchu] 문자 기록 실패", logError.message);
    if (r.ok) sent++;
    else if (r.reason !== "not_configured") captureError(new Error(`sms: ${r.reason}`), "sms:send", { kind: m.kind });
  }
  return sent;
}
