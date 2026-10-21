/**
 * 보내기 직전 가입. 로그인하지 않은 의뢰자가 요청서를 끝까지 쓰고 "보내기"를 누르면:
 *
 * 1) createPending: 요청서와 첨부 목록을 rfq_pending 에 맡기고(7일), 계정이 없으면 미확인 계정을 만든 뒤
 *    인증번호 메일을 보낸다. 첨부는 브라우저가 pending/<token>/ 경로로 바로 올린다 (번호를 입력하는 동안).
 * 2) 인증: 화면에 번호를 넣으면 /api/rfq/pending/verify, 메일 버튼을 누르면 /auth/confirm → /app/claim/<token>
 *    (메일 버튼 쪽은 요약을 보여 주고 "이 요청서 보내기"를 눌러야 접수한다, POST /api/rfq/pending/claim).
 * 3) claimPending: 맡긴 요청서를 정식 요청으로 바꾸고, 올라온 첨부를 요청 경로로 옮기고, 기관 전달을 시작한다.
 *
 * 요청서는 어느 단계에서도 다시 쓰지 않는다. 브라우저에도 임시 저장이 남아 있어 창을 닫아도 이어서 보낼 수 있다.
 *
 * 보안 (2026-10-20):
 * - 요청은 이메일이 확인된 계정(인증번호나 메일 버튼)으로만 만든다. 소유는 user_id 로 정한다 (DB 트리거 rfq_requests_require_confirmed, 0025)
 * - 계정이 있는지 응답으로 알 수 없게 한다: 기관·운영자 계정 이메일도 같은 응답을 받고, 그 주소로는 번호 대신 안내 메일이 간다 (verify_type = blocked)
 * - rfq_pending 은 서비스 키로만 읽는다. 임시 첨부(pending/<token>/)는 접수 때 요청 폴더로 옮긴 뒤에만 첨부가 된다 (기관에 보이지 않는다)
 * - 인증하지 않고 끝난 임시 요청서·첨부·미확인 계정은 예약 작업이 정리한다 (app/api/cron/daily, cleanupPending)
 */
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "./supabase";
import { siteUrl } from "./notify";
import { esc, mailWrap, sendCodeMail, sendMail } from "./mail";
import { opaqueObjectName, safeName, storageHas, type UploadTicket } from "./upload";
import { createRfq, startRfq, type FileMeta } from "./rfq-create";
import type { Values } from "./rfq-schema";

export const PENDING_DIR = "pending";
export const MAX_VERIFY_ATTEMPTS = 5;
/** 의뢰자로 쓸 수 없는 이메일(기관·운영자 계정)의 임시 요청서. 번호 확인은 늘 틀린 번호로 처리한다 */
export const BLOCKED_VERIFY_TYPE = "blocked";
/** 보내기 직전 가입이 만든 계정 표시 (app_metadata). 끝내 확인하지 않은 계정만 정리할 때 쓴다 */
const CREATED_VIA = "rfq_pending";

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

/** 의뢰자로 쓸 수 없는 이메일에 보내는 안내. 화면 응답은 일반 경우와 같다 (계정이 있는지 응답으로 드러내지 않는다) */
export async function sendBlockedNotice(email: string): Promise<boolean> {
  return sendMail({
    to: email,
    subject: "[단추] 이 이메일로는 견적 요청서를 보낼 수 없습니다",
    html: mailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px">이 이메일로는 견적 요청서를 보낼 수 없습니다</h2>
      <p>방금 단추에서 이 주소로 견적 요청서를 보내려는 시도가 있었습니다. 이 주소는 기관 또는 운영자 계정으로 가입되어 있어 의뢰자 요청서를 받을 수 없습니다.</p>
      <p>직접 보내신 것이라면 의뢰자로 쓰실 다른 이메일로 다시 보내 주세요. 쓰신 요청서는 같은 브라우저에 임시 저장되어 있습니다.</p>
      <p style="font-size:13px;color:#6F6A63">요청하지 않았다면 이 메일은 무시하세요. 계정과 요청서에는 아무 변화가 없습니다. 문의: ${esc("hello@danchu.kr")}</p>`),
  });
}

export type PendingInput = { email: string; values: Values; files: FileMeta[]; ip: string };

/**
 * 요청서를 맡기고 인증번호를 보낸다. 첨부 업로드 URL 도 함께 돌려준다.
 * 이미 가입한 이메일이면 계정을 새로 만들지 않는다 (같은 이메일로 인증하면 그 계정으로 접수된다).
 * 기관·운영자 계정 이메일이면 같은 모양으로 응답하고, 번호 대신 안내 메일을 보낸다 (계정 존재를 응답으로 알 수 없게).
 */
export async function createPending(input: PendingInput): Promise<{ token: string; uploads: UploadTicket[]; mailed: boolean; codeLength: number } | { error: string; status: number }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "지금은 접수를 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.", status: 503 };
  const email = input.email.toLowerCase();

  const { data: prof } = await sb.from("profiles").select("id, role").eq("email", email).maybeSingle();
  const blocked = !!prof && prof.role !== "requester";
  if (!prof) {
    // 이름·회사·연락처는 넣지 않는다. 이메일 주인이 아닌 사람이 먼저 보낸 값이 계정 정보로 남지 않게,
    // 이메일을 확인하고 접수할 때(claimPending) 빈 칸만 요청서 값으로 채운다
    const { error } = await sb.auth.admin.createUser({
      email,
      email_confirm: false,
      app_metadata: { created_via: CREATED_VIA },
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
  if (blocked) {
    // 응답은 일반 경우와 같다. 이 임시 요청서는 접수될 수 없고(번호 확인이 늘 실패), 예약 작업이 첨부와 함께 정리한다
    await sb.from("rfq_pending").update({ verify_type: BLOCKED_VERIFY_TYPE }).eq("token", token);
    await sendBlockedNotice(email);
    return { token, uploads, mailed: true, codeLength: 6 };
  }
  const sent = await sendPendingCode(email, token);
  if (sent.vtype) await sb.from("rfq_pending").update({ verify_type: sent.vtype }).eq("token", token);
  return { token, uploads, mailed: sent.ok, codeLength: sent.codeLength ?? 6 };
}

export type Claimed = { rfqNo: string; started: boolean } | { error: string; status: number };

/** 이메일을 확인한 뒤 계정의 빈 프로필 칸만 요청서 값으로 채운다 (이미 적힌 값은 바꾸지 않는다) */
async function fillEmptyProfile(userId: string, values: Values): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { data: prof } = await sb.from("profiles").select("name, company, dept, phone, org_type").eq("id", userId).maybeSingle();
  if (!prof) return;
  const v = (k: string) => (typeof values[k] === "string" ? (values[k] as string).trim().slice(0, 120) : "");
  const patch: Partial<Record<"name" | "company" | "dept" | "phone" | "org_type", string>> = {};
  const fill = (col: "name" | "company" | "dept" | "phone" | "org_type", key: string) => {
    if (!(prof[col] ?? "").trim() && v(key)) patch[col] = v(key);
  };
  fill("name", "name");
  fill("company", "company");
  fill("dept", "dept");
  fill("phone", "phone");
  fill("org_type", "orgType");
  if (Object.keys(patch).length) await sb.from("profiles").update(patch).eq("id", userId);
}

/**
 * 메일 버튼으로 들어온 화면(/app/claim/<token>)이 보여 줄 요약. 열기만 해서는 접수하지 않는다:
 * 요청서를 쓴 사람이 아닌 다른 사람이 만든 링크일 수 있으므로, 로그인한 의뢰자가 내용을 보고 "보내기"를 눌러야 접수한다.
 */
export async function pendingPreview(token: string, email: string): Promise<{ claimedRfqNo: string | null; substance: string; company: string; categories: string[]; files: string[] } | { error: string; status: number }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "지금은 요청서를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.", status: 503 };
  const { data: row } = await sb.from("rfq_pending").select("email, payload, files, claimed_rfq_no, expires_at, verify_type").eq("token", token).maybeSingle();
  // 다른 계정의 임시 요청서는 있는지조차 알리지 않는다
  if (!row || row.email.toLowerCase() !== email.toLowerCase()) return { error: "맡겨 둔 요청서를 찾지 못했습니다. 요청서를 쓸 때 입력한 이메일로 로그인했는지 확인해 주세요.", status: 404 };
  if (row.claimed_rfq_no) return { claimedRfqNo: row.claimed_rfq_no, substance: "", company: "", categories: [], files: [] };
  if (new Date(row.expires_at).getTime() < Date.now()) return { error: "요청서를 맡긴 지 7일이 지나 보관 기간이 끝났습니다. 같은 브라우저에서 열면 임시 저장된 내용으로 다시 보낼 수 있습니다.", status: 410 };
  if (row.verify_type === BLOCKED_VERIFY_TYPE) return { error: "이 계정으로는 견적 요청서를 보낼 수 없습니다. 의뢰자로 쓰실 다른 이메일로 다시 보내 주세요.", status: 403 };
  const p = (row.payload ?? {}) as Values;
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string).trim().slice(0, 200) : "");
  const categories = Array.isArray(p.categories) ? (p.categories as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 20) : [];
  const files = ((row.files ?? []) as { name?: unknown }[]).map((f) => (typeof f.name === "string" ? f.name : "")).filter(Boolean);
  return { claimedRfqNo: null, substance: str("substance"), company: str("company"), categories, files };
}

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
  if (row.verify_type === BLOCKED_VERIFY_TYPE) return { error: "이 계정으로는 견적 요청서를 보낼 수 없습니다. 의뢰자로 쓰실 다른 이메일로 다시 보내 주세요.", status: 403 };
  // 의뢰자 계정으로만 접수한다 (기관·운영자 계정 세션으로 메일 버튼을 연 경우)
  const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (prof && prof.role !== "requester") return { error: "의뢰자 계정으로만 견적 요청서를 보낼 수 있습니다. 의뢰자로 쓰실 다른 이메일로 다시 보내 주세요.", status: 403 };

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
    await fillEmptyProfile(user.id, values);
    const metas = row.files ?? [];
    const { rfqId, rfqNo } = await createRfq({ values, files: metas.map(({ name, size, type }) => ({ name, size, type })), user, ip: row.ip ?? "unknown", ua: null, tickets: false });
    let missing = 0;
    for (const f of metas) {
      const dest = `${rfqNo}/${opaqueObjectName(f.name)}`;
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

/**
 * 예약 작업: 인증하지 않고 기간(7일)이 지난 임시 요청서와 첨부를 지우고, 그 때문에 만들어졌지만 끝내 확인하지 않은 계정을 지운다.
 * 접수로 바뀐 지 30일 지난 임시 기록과 접수 뒤 늦게 올라온 임시 첨부도 지운다.
 * 계정은 이 흐름이 만든 것(app_metadata.created_via)이고, 이메일을 확인한 적이 없고, 같은 이메일로 남은 임시 요청서가 없을 때만 지운다.
 */
export async function cleanupPending(): Promise<{ pending: number; files: number; accounts: number }> {
  const sb = getSupabaseAdmin();
  const out = { pending: 0, files: 0, accounts: 0 };
  if (!sb) return out;
  const now = new Date().toISOString();
  const dropFiles = async (token: string, files: { path: string }[] | null) => {
    const paths = new Set((files ?? []).map((f) => f.path).filter((x) => typeof x === "string" && x.startsWith(`${PENDING_DIR}/${token}/`)));
    const listed = await sb.storage.from("rfq-files").list(`${PENDING_DIR}/${token}`, { limit: 100 });
    for (const o of listed.data ?? []) paths.add(`${PENDING_DIR}/${token}/${o.name}`);
    if (paths.size) {
      const { error } = await sb.storage.from("rfq-files").remove([...paths]);
      if (error) throw new Error(`임시 첨부 삭제 실패: ${error.message}`);
      out.files += paths.size;
    }
  };

  const { data: stale, error } = await sb.from("rfq_pending").select("token, email, files").is("claimed_at", null).lt("expires_at", now).limit(200);
  if (error) throw new Error(error.message);
  const emails = new Set<string>();
  for (const p of stale ?? []) {
    await dropFiles(p.token, p.files);
    const { data: gone } = await sb.from("rfq_pending").delete().eq("token", p.token).is("claimed_at", null).select("token");
    if (gone?.length) {
      out.pending++;
      emails.add(p.email);
    }
  }

  // 접수 도중 멈춘 기록(잡은 표시만 있고 요청 번호가 없음, 1시간 경과): 그 사이 만들어진 요청이 있으면 연결하고, 없으면 잡은 표시를 푼다.
  // 풀어 두면 다시 보내거나, 7일이 지나 위 정리 대상이 된다 (그대로 두면 개인정보와 첨부가 영영 남는다)
  const { data: stuck } = await sb.from("rfq_pending").select("token, claimed_at, claimed_user").not("claimed_at", "is", null).is("claimed_rfq_no", null).lt("claimed_at", new Date(Date.now() - 3600e3).toISOString()).order("claimed_at", { ascending: true }).limit(200);
  for (const p of stuck ?? []) {
    let made: { rfq_no: string } | null = null;
    if (p.claimed_user && p.claimed_at) {
      const until = new Date(new Date(p.claimed_at).getTime() + 10 * 60e3).toISOString();
      const { data } = await sb.from("rfq_requests").select("rfq_no").eq("user_id", p.claimed_user).gte("created_at", p.claimed_at).lte("created_at", until).order("created_at", { ascending: true }).limit(1).maybeSingle();
      made = data;
    }
    if (made) await sb.from("rfq_pending").update({ claimed_rfq_no: made.rfq_no }).eq("token", p.token).is("claimed_rfq_no", null);
    else await sb.from("rfq_pending").update({ claimed_at: null, claimed_user: null }).eq("token", p.token).is("claimed_rfq_no", null);
  }

  // 접수로 바뀐 기록: 다른 탭 감지(status)에 하루면 충분하지만 문의 대응을 위해 30일 둔다. 늦게 올라온 임시 첨부는 하루 뒤에 지운다.
  // 오래된 것부터 본다 (200건씩이라 정렬이 없으면 오래된 기록이 계속 뒤로 밀려 30일을 넘겨 남을 수 있다)
  const { data: claimed } = await sb.from("rfq_pending").select("token, files, claimed_at").not("claimed_rfq_no", "is", null).lt("claimed_at", new Date(Date.now() - 864e5).toISOString()).order("claimed_at", { ascending: true }).limit(200);
  const monthAgo = Date.now() - 30 * 864e5;
  for (const p of claimed ?? []) {
    await dropFiles(p.token, null);
    if (p.claimed_at && new Date(p.claimed_at).getTime() < monthAgo) await sb.from("rfq_pending").delete().eq("token", p.token);
  }

  // 임시 요청서 저장에 실패해 남은 계정도 찾는다: 이 흐름이 만들었고(app_metadata.created_via), 확인하지 않았고, 7일 지난 계정
  const weekAgo = Date.now() - 7 * 864e5;
  for (let page = 1; page <= 5; page++) {
    const { data: lu, error: le } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (le) break;
    const users = lu?.users ?? [];
    for (const u of users) {
      if (!u.email || u.email_confirmed_at || u.last_sign_in_at) continue;
      if ((u.app_metadata as Record<string, unknown> | undefined)?.created_via !== CREATED_VIA) continue;
      if (new Date(u.created_at).getTime() > weekAgo) continue;
      emails.add(u.email.toLowerCase());
    }
    if (users.length < 200) break;
  }

  // 이 흐름이 만들었지만 끝내 확인하지 않은 계정
  for (const email of emails) {
    const { count } = await sb.from("rfq_pending").select("token", { count: "exact", head: true }).eq("email", email);
    if (count) continue;
    const { data: prof } = await sb.from("profiles").select("id, role").eq("email", email).maybeSingle();
    if (!prof || prof.role !== "requester") continue;
    const { data: u } = await sb.auth.admin.getUserById(prof.id);
    const user = u?.user;
    if (!user || user.email_confirmed_at || user.last_sign_in_at) continue;
    if ((user.app_metadata as Record<string, unknown> | undefined)?.created_via !== CREATED_VIA) continue;
    const { count: owned } = await sb.from("rfq_requests").select("id", { count: "exact", head: true }).eq("user_id", prof.id);
    if (owned) continue;
    const { error: de } = await sb.auth.admin.deleteUser(prof.id);
    if (!de) out.accounts++;
  }
  return out;
}
