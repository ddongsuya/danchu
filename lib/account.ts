import type { Admin } from "./supabase";
import type { Values } from "./rfq-schema";
import { logEvent, notifyUsers, adminEmails, adminUserIds } from "./notify";
import { notifyInvitedOrgs } from "./distribute";
import { captureError } from "./observe";

/** 선정 전 단계. 탈퇴하면 이 요청들은 취소하고 회신 중인 기관에 알린다 */
export const OPEN_STATUSES = ["received", "distributed", "quoted", "compared"] as const;
/** 기관을 선정한 뒤. 계약 당사자가 생겼으므로 탈퇴로 지울 수 없고 운영자가 마무리해야 한다 */
export const CONTRACT_STATUSES = ["selected", "contracting"] as const;

/** 요청서 payload 에서 담당자 개인정보 키만 비운다. 시험 내용·회사명은 남긴다 (기관 회신·청구 기록의 근거) */
export function anonymizePayload(p: Values): Values {
  const out: Values = { ...p };
  for (const k of ["name", "email", "phone", "dept"]) delete out[k];
  return out;
}

/** 탈퇴를 막아야 하는 이유. null 이면 진행 가능 */
export function deletionBlockedBy(role: string, statuses: string[]): "admin" | "contracting" | null {
  if (role === "admin") return "admin";
  if (statuses.some((s) => (CONTRACT_STATUSES as readonly string[]).includes(s))) return "contracting";
  return null;
}

export function anonymousEmail(rfqId: string): string {
  return `deleted-${rfqId.replace(/-/g, "").slice(0, 12)}@deleted.danchu.kr`;
}

/**
 * 요청서 목록을 익명화한다: 담당자 이름·이메일·전화·접속기록·payload 의 개인정보 키.
 * 선정(award)이 없는 요청의 첨부는 Storage 와 rfq_files 에서 지운다. 선정된 요청의 첨부는 계약 근거라 남긴다.
 * 회원 탈퇴와 보존기간 만료 정리가 같은 함수를 쓴다.
 */
export async function anonymizeRequests(sb: Admin, rfqIds: string[]): Promise<{ anonymized: number; filesDeleted: number }> {
  const res = { anonymized: 0, filesDeleted: 0 };
  if (!rfqIds.length) return res;

  const { data: awards } = await sb.from("rfq_awards").select("rfq_id").in("rfq_id", rfqIds);
  const awarded = new Set((awards ?? []).map((a) => a.rfq_id));
  const deletable = rfqIds.filter((id) => !awarded.has(id));

  if (deletable.length) {
    const { data: files } = await sb.from("rfq_files").select("id, storage_path").in("rfq_id", deletable);
    const paths = (files ?? []).map((f) => f.storage_path);
    if (paths.length) {
      const { error } = await sb.storage.from("rfq-files").remove(paths);
      if (error) captureError(error, "account:storage-remove", { count: paths.length });
      else {
        await sb.from("rfq_files").delete().in("rfq_id", deletable);
        res.filesDeleted = paths.length;
      }
    }
  }

  const { data: rows, error: rowsError } = await sb.from("rfq_requests").select("id, payload").in("id", rfqIds);
  if (rowsError) captureError(rowsError, "account:anonymize-read", { count: rfqIds.length });
  for (const r of rows ?? []) {
    const { error } = await sb
      .from("rfq_requests")
      .update({ contact_name: "탈퇴 회원", email: anonymousEmail(r.id), phone: null, user_agent: null, ip: null, payload: anonymizePayload(r.payload), anonymized_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) captureError(error, "account:anonymize", { rfq: r.id });
    else res.anonymized++;
  }
  return res;
}

export type DeleteResult =
  | { ok: true; cancelled: number; anonymized: number; filesDeleted: number }
  | { ok: false; code: "not_found" | "admin" | "contracting"; contracting?: string[] };

/**
 * 계정 삭제. 순서:
 * 1) 운영자·계약 진행 중이면 거부
 * 2) 선정 전 요청은 취소하고 회신 중인 기관에 알림
 * 3) 본인 요청서 전부 익명화 (첨부는 미선정 건만 삭제)
 * 4) auth.users 삭제 → profiles·notifications 는 cascade, cro_quotes.submitted_by·rfq_events.actor_id 는 null.
 *    기관 담당자였으면 profiles 삭제 트리거가 그 기관의 회신 링크를 모두 새로 발급한다 (0021)
 * 5) 운영자에게 알림
 */
export async function deleteAccount(sb: Admin, userId: string, opts: { actorId?: string | null; reason: "self" | "admin" }): Promise<DeleteResult> {
  const { data: profile } = await sb.from("profiles").select("id, email, role, name, company, cro_org_id").eq("id", userId).maybeSingle();
  if (!profile) return { ok: false, code: "not_found" };

  // 본인 요청은 user_id 로만 찾는다. 같은 이메일을 예전에 쓴 다른 계정의 요청을 취소·익명화·첨부 삭제하지 않는다
  const { data: rfqs, error: rfqError } = await sb
    .from("rfq_requests")
    .select("id, rfq_no, status, user_id")
    .eq("user_id", userId);
  // 조회가 실패했는데 "요청 없음"으로 보고 계정을 지우면, 익명화되지 않은 요청이 같은 이메일의 다른 계정에 넘어갈 수 있다
  if (rfqError) {
    captureError(rfqError, "account:list-requests", { user: userId });
    throw new Error("요청 목록을 확인하지 못해 계정을 삭제하지 않았습니다. 잠시 후 다시 시도해 주세요.");
  }
  const mine = rfqs ?? [];

  const blocked = deletionBlockedBy(profile.role, mine.map((r) => r.status));
  if (blocked === "admin") return { ok: false, code: "admin" };
  if (blocked === "contracting") return { ok: false, code: "contracting", contracting: mine.filter((r) => (CONTRACT_STATUSES as readonly string[]).includes(r.status)).map((r) => r.rfq_no) };

  // 2) 선정 전 요청 취소
  let cancelled = 0;
  for (const r of mine.filter((x) => (OPEN_STATUSES as readonly string[]).includes(x.status))) {
    const now = new Date().toISOString();
    await sb.from("rfq_requests").update({ status: "cancelled", closed_at: now }).eq("id", r.id);
    await sb.from("rfq_invites").update({ status: "expired" }).eq("rfq_id", r.id).in("status", ["sent", "draft"]);
    await logEvent(r.id, "cancelled", "취소", "의뢰자 회원 탈퇴", opts.actorId ?? null, { reason: "account_deleted" });
    // 기관마다 따로 보낸다. 계정이 없거나 운영자 관리 기관은 로그인이 필요한 /cro 대신 회신 링크(/q)로
    const { data: inv } = await sb.from("rfq_invites").select("id, token, cro_org_id, cro_email").eq("rfq_id", r.id);
    await notifyInvitedOrgs(inv ?? [], { kind: "시스템", title: `${r.rfq_no} 요청이 취소되었습니다`, body: "의뢰자 사정으로 요청이 취소되어 회신이 닫혔습니다.", portalHref: "/cro" });
    cancelled++;
  }

  // 3) 익명화
  const { anonymized, filesDeleted } = await anonymizeRequests(sb, mine.map((r) => r.id));
  // 하나라도 익명화하지 못했으면 계정을 지우지 않는다 (지우면 user_id 가 비워진 채 원래 이메일이 남는다). 다시 시도하면 이어서 처리된다
  if (anonymized < mine.length) {
    throw new Error("요청 정보를 모두 정리하지 못해 계정을 삭제하지 않았습니다. 잠시 후 다시 시도해 주세요.");
  }

  // 4) 계정 삭제
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) {
    captureError(error, "account:deleteUser", { user: userId });
    throw new Error("계정을 삭제하지 못했습니다.");
  }

  // 5) 운영자 알림 (이메일은 이미 지웠으므로 역할·회사만)
  const roleKo = profile.role === "cro" ? "기관 담당자" : "의뢰자";
  await notifyUsers(
    await adminUserIds(),
    { kind: "시스템", title: `회원 탈퇴 · ${roleKo} · ${profile.company ?? "-"}`, body: `${opts.reason === "admin" ? "운영자가 삭제" : "본인 탈퇴"} · 요청 ${mine.length}건 익명화 · 취소 ${cancelled}건 · 첨부 ${filesDeleted}개 삭제`, href: "/admin/users" },
    { to: adminEmails() },
  ).catch((e) => captureError(e, "account:notify"));

  return { ok: true, cancelled, anonymized, filesDeleted };
}
