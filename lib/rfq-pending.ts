/**
 * 보내기 직전 가입. 로그인하지 않은 의뢰자가 요청서를 끝까지 쓰고 "보내기"를 누르면:
 *
 * 1) createPending: 요청서와 첨부 목록을 rfq_pending 에 맡기고(7일), 계정이 없으면 미확인 계정을 만든 뒤
 *    인증번호 메일을 보낸다. 첨부는 브라우저가 pending/<token>/ 경로로 바로 올린다 (번호를 입력하는 동안).
 * 2) 인증: 화면에 번호를 넣으면 /api/rfq/pending/verify, 메일 버튼을 누르면 /auth/confirm → /app/claim/<token>.
 * 3) claimPending: 맡긴 요청서를 정식 요청으로 바꾸고, 올라온 첨부를 요청 경로로 옮기고, 기관 전달을 시작한다.
 *
 * 요청서는 어느 단계에서도 다시 쓰지 않는다. 브라우저에도 임시 저장이 남아 있어 창을 닫아도 이어서 보낼 수 있다.
 */
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "./supabase";
import { siteUrl } from "./notify";
import { sendCodeMail } from "./mail";
import { safeName, storageHas, type UploadTicket } from "./upload";
import { createRfq, startRfq, type FileMeta } from "./rfq-create";
import type { Values } from "./rfq-schema";

export const PENDING_DIR = "pending";
export const MAX_VERIFY_ATTEMPTS = 5;

export function newPendingToken(): string {
  return randomBytes(24).toString("base64url");
}

export const isPendingToken = (t: unknown): t is string => typeof t === "string" && /^[\w-]{24,64}$/.test(t);

/** 인증번호 + 버튼 링크 메일. 새로 보내면 이전 번호는 쓸 수 없다 (Supabase 일회용 토큰이 바뀐다) */
export async function sendPendingCode(email: string, token: string): Promise<{ ok: boolean; vtype?: string; codeLength?: number }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false };
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const p = data?.properties;
  if (error || !p?.hashed_token || !p.email_otp) {
    console.error("pending generateLink", error?.message);
    return { ok: false };
  }
  const q = new URLSearchParams({ token_hash: p.hashed_token, type: "magiclink", next: `/app/claim/${token}` });
  const ok = await sendCodeMail(email, p.email_otp, `${siteUrl()}/auth/confirm?${q}`);
  return { ok, vtype: p.verification_type, codeLength: p.email_otp.length };
}

export type PendingInput = { email: string; values: Values; files: FileMeta[]; ip: string };

/**
 * 요청서를 맡기고 인증번호를 보낸다. 첨부 업로드 URL 도 함께 돌려준다.
 * 이미 가입한 이메일이면 계정을 새로 만들지 않는다 (같은 이메일로 인증하면 그 계정으로 접수된다).
 */
export async function createPending(input: PendingInput): Promise<{ token: string; uploads: UploadTicket[]; mailed: boolean; codeLength: number } | { error: string; status: number }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "지금은 접수를 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.", status: 503 };
  const email = input.email.toLowerCase();

  const { data: prof } = await sb.from("profiles").select("id, role").eq("email", email).maybeSingle();
  if (prof && prof.role !== "requester") return { error: "기관이나 운영자 계정으로 가입된 이메일입니다. 의뢰자로 쓰실 다른 이메일을 입력해 주세요.", status: 409 };
  if (!prof) {
    const s = (k: string) => (typeof input.values[k] === "string" ? (input.values[k] as string).trim().slice(0, 120) : "");
    const { error } = await sb.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { name: s("name"), company: s("company"), dept: s("dept"), phone: s("phone"), org_type: s("orgType") },
    });
    // 동시에 두 번 눌러 이미 만들어진 경우는 그대로 진행한다
    if (error && !/already|registered|exists/i.test(error.message)) {
      console.error("pending createUser", error.message);
      return { error: "계정을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.", status: 500 };
    }
  }

  const token = newPendingToken();
  const uploads: UploadTicket[] = [];
  const files: (FileMeta & { path: string })[] = [];
  for (const [i, f] of input.files.entries()) {
    const path = `${PENDING_DIR}/${token}/${i}-${safeName(f.name)}`;
    const { data: signed, error } = await sb.storage.from("rfq-files").createSignedUploadUrl(path);
    if (error || !signed) {
      console.error("pending signed url", error);
      continue;
    }
    files.push({ ...f, path });
    uploads.push({ name: f.name, path, signedUrl: signed.signedUrl });
  }
  const { error: e2 } = await sb.from("rfq_pending").insert({ token, email, payload: input.values, files, ip: input.ip !== "unknown" ? input.ip : null });
  if (e2) {
    console.error("pending insert", e2);
    return { error: "요청서를 맡기지 못했습니다. 잠시 후 다시 시도해 주세요.", status: 500 };
  }
  const sent = await sendPendingCode(email, token);
  if (sent.vtype) await sb.from("rfq_pending").update({ verify_type: sent.vtype }).eq("token", token);
  return { token, uploads, mailed: sent.ok, codeLength: sent.codeLength ?? 6 };
}

export type Claimed = { rfqNo: string; started: boolean } | { error: string; status: number };

/**
 * 맡긴 요청서를 정식 요청으로 바꾼다. 화면의 번호 입력과 메일 버튼이 동시에 와도 한 번만 바뀐다.
 * 첨부가 다 올라와 있으면 바로 기관에 전달하고, 빠진 첨부가 있으면 전달을 미룬다 (요청 화면에서 다시 올리거나 바로 보낼 수 있다).
 */
export async function claimPending(token: string, user: { id: string; email: string }): Promise<Claimed> {
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "저장소 미설정", status: 503 };
  const { data: row } = await sb.from("rfq_pending").select("*").eq("token", token).maybeSingle();
  if (!row) return { error: "맡겨 둔 요청서를 찾지 못했습니다. 다시 보내 주세요.", status: 404 };
  if (row.email.toLowerCase() !== user.email.toLowerCase()) return { error: "요청서를 쓸 때 입력한 이메일과 다른 계정으로 로그인되어 있습니다.", status: 403 };
  if (row.claimed_rfq_no) return { rfqNo: row.claimed_rfq_no, started: true };
  if (new Date(row.expires_at).getTime() < Date.now()) return { error: "요청서를 맡긴 지 7일이 지나 보관 기간이 끝났습니다. 같은 브라우저에서 열면 임시 저장된 내용으로 다시 보낼 수 있습니다.", status: 410 };

  // 먼저 잡은 쪽만 진행한다. 늦게 온 쪽은 번호가 생길 때까지 잠깐 기다린다
  const { data: won } = await sb.from("rfq_pending").update({ claimed_at: new Date().toISOString(), claimed_user: user.id }).eq("token", token).is("claimed_at", null).select("token").maybeSingle();
  if (!won) {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const { data: again } = await sb.from("rfq_pending").select("claimed_rfq_no, claimed_at").eq("token", token).maybeSingle();
      if (again?.claimed_rfq_no) return { rfqNo: again.claimed_rfq_no, started: true };
      if (!again?.claimed_at) break;
    }
    return { error: "접수를 마무리하는 중입니다. 잠시 후 요청 목록에서 확인해 주세요.", status: 409 };
  }

  try {
    const values = { ...(row.payload as Values) };
    const metas = row.files ?? [];
    const { rfqId, rfqNo } = await createRfq({ values, files: metas.map(({ name, size, type }) => ({ name, size, type })), user, ip: row.ip ?? "unknown", ua: null, tickets: false });
    let missing = 0;
    for (const f of metas) {
      const dest = `${rfqNo}/${Date.now()}-${safeName(f.name)}`;
      const there = await storageHas(sb, "rfq-files", f.path);
      const moved = there ? !(await sb.storage.from("rfq-files").move(f.path, dest)).error : false;
      if (!moved) missing++;
      await sb.from("rfq_files").insert({ rfq_id: rfqId, storage_path: dest, file_name: f.name, size_bytes: f.size, mime_type: f.type || null, uploaded_at: moved ? new Date().toISOString() : null });
    }
    await sb.from("rfq_pending").update({ claimed_rfq_no: rfqNo }).eq("token", token);
    let started = false;
    if (!missing) {
      try {
        started = (await startRfq(rfqId)).started;
      } catch (e) {
        console.error("pending start", e);
      }
    }
    return { rfqNo, started };
  } catch (e) {
    console.error("claim pending", e);
    // 다시 시도할 수 있게 잡은 표시를 푼다
    await sb.from("rfq_pending").update({ claimed_at: null, claimed_user: null }).eq("token", token).is("claimed_rfq_no", null);
    return { error: "접수하지 못했습니다. 잠시 후 다시 시도해 주세요.", status: 500 };
  }
}
