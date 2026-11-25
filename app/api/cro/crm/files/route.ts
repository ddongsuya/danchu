import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { featureError } from "@/lib/plan-usage";
import { isUuid } from "@/lib/crm-shape";
import { CRM_BUCKET, CRM_FILES_PER_ACTIVITY, CRM_FILE_MAX, cleanFiles, crmFileError, crmFilePath, displayName, isCrmFilePath, removeCrmFiles, storedSize } from "@/lib/crm-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 기록 첨부 (0051). /api/cro/crm/files
 *   POST {activity_id, name, size, type}                 서명 업로드 URL (본문은 브라우저가 Storage 로 바로 올린다, lib/upload.ts)
 *   POST {action: "attach", activity_id, path, name, size, type}  올린 파일을 기록에 붙인다 (Storage 에 있는지·크기를 다시 본다)
 *   GET  ?a=<activity_id>&p=<path>                         내려받기: 60초짜리 서명 URL 로 보낸다
 *   DELETE {activity_id, path}                             기록에서 빼고 파일도 지운다
 * 기관 담당자 모두 같이 쓴다 (고객 관리 요금제). 다른 기관의 기록·경로는 찾지 못한 것으로 답한다.
 */
type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
/** 기록 하나를 고쳐 쓰는 사이 다른 화면이 같이 고치면 다시 읽고 한 번 더 */
const RETRIES = 3;

async function ctx() {
  const s = await sessionOrNull("cro");
  const ok = s?.org?.status === "approved" && !featureError(s.org, "crm");
  return { orgId: ok ? s!.profile.cro_org_id : null, sb: getSupabaseAdmin() };
}

async function activity(sb: Admin, orgId: string, id: unknown) {
  if (!isUuid(id)) return null;
  const { data } = await sb.from("cro_crm_activities").select("id, files, updated_at").eq("id", id).eq("org_id", orgId).maybeSingle();
  return data ? { id: data.id as string, files: cleanFiles(data.files), updated_at: data.updated_at as string } : null;
}

/** files 를 바꿔 쓴다. 읽은 뒤 바뀌었으면(updated_at 이 다르면) 다시 읽어 같은 변경을 다시 적용한다 */
async function rewrite(sb: Admin, orgId: string, id: string, change: (files: ReturnType<typeof cleanFiles>) => ReturnType<typeof cleanFiles> | string): Promise<string | null> {
  for (let i = 0; i < RETRIES; i++) {
    const a = await activity(sb, orgId, id);
    if (!a) return "기록을 찾지 못했어요.";
    const next = change(a.files);
    if (typeof next === "string") return next;
    const { data, error } = await sb.from("cro_crm_activities").update({ files: next } as never).eq("id", id).eq("org_id", orgId).eq("updated_at", a.updated_at).select("id");
    if (error) { console.error("crm files write", error); return "첨부를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요."; }
    if (data?.length) return null;
  }
  return "다른 화면에서 같은 기록을 고치는 중이에요. 다시 시도해 주세요.";
}

export async function POST(req: Request) {
  const { orgId, sb } = await ctx();
  if (!orgId) return bad("권한이 없어요.", 403);
  if (!sb) return bad("저장소가 설정되지 않았어요.", 503);
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const a = await activity(sb, orgId, b.activity_id);
  if (!a) return bad("기록을 찾지 못했어요.", 404);
  const name = typeof b.name === "string" ? displayName(b.name) : "";
  const size = typeof b.size === "number" ? b.size : Number(b.size);
  const type = typeof b.type === "string" ? b.type.slice(0, 100) : "";
  const err = crmFileError(name, size);
  if (err) return bad(err);
  if (a.files.length >= CRM_FILES_PER_ACTIVITY) return bad(`기록 하나에 파일은 ${CRM_FILES_PER_ACTIVITY}개까지 붙일 수 있어요.`, 409);

  if (b.action !== "attach") {
    const path = crmFilePath(orgId, a.id, name);
    const { data, error } = await sb.storage.from(CRM_BUCKET).createSignedUploadUrl(path);
    if (error || !data) { console.error("crm files signed upload", error); return bad("업로드 주소를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.", 500); }
    return NextResponse.json({ name, path, signedUrl: data.signedUrl });
  }

  if (!isCrmFilePath(b.path, orgId, a.id)) return bad("파일을 찾지 못했어요.", 404);
  const path = b.path;
  const real = await storedSize(sb, path);
  if (real == null) return bad("파일이 다 올라가지 않았어요. 다시 올려 주세요.", 409);
  if (real > CRM_FILE_MAX) {
    await removeCrmFiles(sb, [path]);
    return bad("파일 하나는 50MB까지 붙일 수 있어요.");
  }
  const e = await rewrite(sb, orgId, a.id, (files) => {
    if (files.some((f) => f.path === path)) return files;
    if (files.length >= CRM_FILES_PER_ACTIVITY) return `기록 하나에 파일은 ${CRM_FILES_PER_ACTIVITY}개까지 붙일 수 있어요.`;
    return [...files, { path, name, size: real || size, type }];
  });
  if (e) {
    await removeCrmFiles(sb, [path]);
    return bad(e, 409);
  }
  return NextResponse.json({ ok: true, id: a.id });
}

export async function GET(req: Request) {
  const { orgId, sb } = await ctx();
  if (!orgId) return new Response("권한이 없어요.", { status: 403 });
  if (!sb) return new Response("저장소가 설정되지 않았어요.", { status: 503 });
  const u = new URL(req.url);
  const a = await activity(sb, orgId, u.searchParams.get("a"));
  const f = a?.files.find((x) => x.path === u.searchParams.get("p"));
  if (!a || !f || !isCrmFilePath(f.path, orgId, a.id)) return new Response("파일을 찾지 못했어요.", { status: 404 });
  const { data, error } = await sb.storage.from(CRM_BUCKET).createSignedUrl(f.path, 60, { download: f.name });
  if (error || !data) { console.error("crm files signed url", error); return new Response("파일을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.", { status: 500 }); }
  return NextResponse.redirect(data.signedUrl, { status: 303, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request) {
  const { orgId, sb } = await ctx();
  if (!orgId) return bad("권한이 없어요.", 403);
  if (!sb) return bad("저장소가 설정되지 않았어요.", 503);
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const a = await activity(sb, orgId, b.activity_id);
  if (!a || !isCrmFilePath(b.path, orgId, a.id)) return bad("파일을 찾지 못했어요.", 404);
  const path = b.path;
  const e = await rewrite(sb, orgId, a.id, (files) => files.filter((f) => f.path !== path));
  if (e) return bad(e, 409);
  await removeCrmFiles(sb, [path]);
  return NextResponse.json({ ok: true, id: a.id });
}
