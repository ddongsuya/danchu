import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkRefs, mergeCompanies } from "@/lib/crm";
import { isUuid, parseActivity, parseCompany, parseContact, parseEvent, parseQuoteLink, parseTask, type Parsed } from "@/lib/crm-shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 기관 CRM 쓰기 (0038). /api/cro/crm/<kind>
 *   companies · contacts · activities · events · tasks : POST(만들기) · PATCH({id, ...바꿀 칸}) · DELETE({id})
 *   quotes        : PATCH({id, stage?, lost_reason?, contract_amount?, sent_on?, company_id?, contact_id?, note?}) 견적서를 고객사·담당자에 묶고 진행 상태를 남긴다
 *   task-actions  : POST({task_id, body}) 할 일에 한 일 한 줄
 *   merge         : POST({keep, drop}) 고객사 둘을 하나로
 * 기관 담당자 모두 같이 쓴다. 다른 기관 행은 찾지 못한 것으로 답한다.
 */
type Ctx = { params: Promise<{ kind: string }> };
type Body = Record<string, unknown>;
type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const TABLE = {
  companies: "cro_crm_companies",
  contacts: "cro_crm_contacts",
  activities: "cro_crm_activities",
  events: "cro_crm_events",
  tasks: "cro_crm_tasks",
} as const;
type Kind = keyof typeof TABLE;
const NAME: Record<Kind, string> = { companies: "고객사", contacts: "담당자", activities: "기록", events: "일정", tasks: "할 일" };

/** 받침이 있으면 을, 없으면 를 */
const eul = (w: string) => {
  const c = w.charCodeAt(w.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? `${w}을` : `${w}를`;
};
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const fail = (what: string, e: unknown) => {
  console.error("crm write", what, e);
  return bad(`${eul(what)} 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.`, 500);
};

async function ctx() {
  const s = await sessionOrNull("cro");
  const orgId = s?.org?.status === "approved" ? s.profile.cro_org_id : null;
  return { s, orgId, sb: getSupabaseAdmin() };
}

function parse(kind: Kind, b: Body, partial: boolean): Parsed<Record<string, unknown>> {
  switch (kind) {
    case "companies": return parseCompany(b, partial);
    case "contacts": return parseContact(b, partial);
    case "activities": return parseActivity(b, partial);
    case "events": return parseEvent(b, partial);
    case "tasks": return parseTask(b, partial);
  }
}

async function readBody(req: Request): Promise<Body> {
  const b = await req.json().catch(() => null);
  return b && typeof b === "object" && !Array.isArray(b) ? (b as Body) : {};
}

async function row(sb: Admin, t: (typeof TABLE)[Kind], id: string, orgId: string) {
  const { data } = await sb.from(t).select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  return data as (Record<string, unknown> & { id: string; company_id: string | null }) | null;
}

export async function POST(req: Request, { params }: Ctx) {
  const { s, orgId, sb } = await ctx();
  if (!s || !orgId) return bad("권한이 없어요.", 403);
  if (!sb) return bad("저장소가 설정되지 않았어요.", 503);
  const kind = (await params).kind;
  const b = await readBody(req);

  if (kind === "merge") {
    if (!isUuid(b.keep) || !isUuid(b.drop)) return bad("합칠 고객사 두 곳을 골라 주세요.");
    const r = await mergeCompanies(sb, orgId, b.keep, b.drop);
    return r.ok ? NextResponse.json({ ok: true, id: b.keep }) : bad(r.error, 409);
  }

  if (kind === "task-actions") {
    if (!isUuid(b.task_id)) return bad("할 일을 찾지 못했어요.");
    const body = typeof b.body === "string" ? b.body.trim().slice(0, 1000) : "";
    if (!body) return bad("한 일을 적어 주세요.");
    const err = await checkRefs(sb, orgId, { task_id: b.task_id });
    if (err) return bad(err, 404);
    const { data, error } = await sb.from("cro_crm_task_actions").insert({ org_id: orgId, task_id: b.task_id, body, created_by: s.userId }).select("id").single();
    return error || !data ? fail("한 일", error) : NextResponse.json({ ok: true, id: data.id });
  }

  if (!(kind in TABLE)) return bad("없는 항목이에요.", 404);
  const k = kind as Kind;
  const p = parse(k, b, false);
  if (!p.ok) return bad(p.error);
  const v = p.value;
  const err = await checkRefs(sb, orgId, v as Parameters<typeof checkRefs>[2]);
  if (err) return bad(err, 404);

  const base = { ...v, org_id: orgId, created_by: s.userId, ...(k === "companies" || k === "contacts" ? { source: "manual" } : {}) };
  const { data, error } = await sb.from(TABLE[k]).insert(base as never).select("id").single();
  if (error || !data) return fail(NAME[k], error);
  const id = (data as { id: string }).id;

  // 기록: 일정에서 남겼으면 그 일정을 끝낸 것으로, "다음 할 일"이 있으면 같이 만든다
  if (k === "activities") {
    const a = v as { company_id: string; contact_id: string | null; quote_doc_id: string | null; event_id: string | null };
    if (a.event_id) await sb.from("cro_crm_events").update({ done_at: new Date().toISOString() }).eq("id", a.event_id).eq("org_id", orgId).is("done_at", null);
    const next = typeof b.next_title === "string" ? b.next_title.trim() : "";
    if (next) {
      const t = parseTask({ title: next, due_on: b.next_due ?? null, category: b.next_category ?? "contact", company_id: a.company_id, contact_id: a.contact_id, quote_doc_id: a.quote_doc_id, activity_id: id, assignee: s.userId });
      if (t.ok) await sb.from("cro_crm_tasks").insert({ ...t.value, org_id: orgId, created_by: s.userId } as never);
    }
  }
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { s, orgId, sb } = await ctx();
  if (!s || !orgId) return bad("권한이 없어요.", 403);
  if (!sb) return bad("저장소가 설정되지 않았어요.", 503);
  const kind = (await params).kind;
  const b = await readBody(req);
  if (!isUuid(b.id)) return bad("고칠 항목을 찾지 못했어요.");

  if (kind === "quotes") {
    const { data: doc } = await sb.from("cro_quote_docs").select("id, company_id, status, deal_stage").eq("id", b.id).eq("org_id", orgId).maybeSingle();
    if (!doc) return bad("견적서를 찾지 못했어요.", 404);
    const p = parseQuoteLink(b);
    if (!p.ok) return bad(p.error);
    const { stage, note, ...patch } = p.value;
    const company = patch.company_id !== undefined ? patch.company_id : doc.company_id;
    // 고객사를 바꾸면서 담당자를 안 보냈으면 담당자를 비운다 (다른 회사 담당자가 남지 않게)
    if (patch.company_id !== undefined && patch.company_id !== doc.company_id && patch.contact_id === undefined) patch.contact_id = null;
    const err = await checkRefs(sb, orgId, { company_id: company, contact_id: patch.contact_id ?? null });
    if (err) return bad(err, 404);
    if (stage === "sent" && doc.status !== "sent" && !patch.sent_at) patch.sent_at = new Date().toISOString();
    if (Object.keys(patch).length) {
      const { error } = await sb.from("cro_quote_docs").update(patch).eq("id", b.id).eq("org_id", orgId);
      if (error) return fail("견적 진행", error);
    }
    const changedStage = stage !== undefined && stage !== (doc.deal_stage ?? (doc.status === "sent" ? "sent" : "draft"));
    if (changedStage || note) {
      await sb.from("cro_quote_tracking").insert({ org_id: orgId, doc_id: b.id, stage: changedStage ? stage ?? null : null, note: note ?? "", created_by: s.userId });
    }
    return NextResponse.json({ ok: true, id: b.id });
  }

  if (!(kind in TABLE)) return bad("없는 항목이에요.", 404);
  const k = kind as Kind;
  const cur = await row(sb, TABLE[k], b.id, orgId);
  if (!cur) return bad(`${eul(NAME[k])} 찾지 못했어요.`, 404);

  let v: Record<string, unknown>;
  if (k === "tasks" && typeof b.done === "boolean" && Object.keys(b).length === 2) {
    v = b.done ? { done_at: new Date().toISOString(), done_by: s.userId } : { done_at: null, done_by: null };
  } else {
    const p = parse(k, b, true);
    if (!p.ok) return bad(p.error);
    v = p.value;
    if (k === "tasks" && typeof b.done === "boolean") Object.assign(v, b.done ? { done_at: new Date().toISOString(), done_by: s.userId } : { done_at: null, done_by: null });
  }
  if (!Object.keys(v).length) return NextResponse.json({ ok: true, id: b.id });
  const company = k === "companies" ? null : ((v.company_id as string | null | undefined) !== undefined ? (v.company_id as string | null) : cur.company_id);
  // 고객사를 바꾸면 그 고객사 담당자만 남긴다
  if (k !== "companies" && k !== "contacts" && v.company_id !== undefined && v.company_id !== cur.company_id && v.contact_id === undefined) v.contact_id = null;
  const err = await checkRefs(sb, orgId, { ...(v as Parameters<typeof checkRefs>[2]), company_id: company });
  if (err) return bad(err, 404);
  // 일정 시간을 옮기면 알림을 다시 보낸다
  if (k === "events" && v.starts_at !== undefined && v.starts_at !== cur.starts_at) v.reminded_at = null;
  const { error } = await sb.from(TABLE[k]).update(v as never).eq("id", b.id).eq("org_id", orgId);
  if (error) return fail(NAME[k], error);
  return NextResponse.json({ ok: true, id: b.id });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { s, orgId, sb } = await ctx();
  if (!s || !orgId) return bad("권한이 없어요.", 403);
  if (!sb) return bad("저장소가 설정되지 않았어요.", 503);
  const kind = (await params).kind;
  const b = await readBody(req);
  if (!isUuid(b.id)) return bad("지울 항목을 찾지 못했어요.");
  if (kind === "task-actions") {
    const { data: a } = await sb.from("cro_crm_task_actions").select("id, task_id").eq("id", b.id).maybeSingle();
    if (!a || (await checkRefs(sb, orgId, { task_id: a.task_id }))) return bad("찾지 못했어요.", 404);
    await sb.from("cro_crm_task_actions").delete().eq("id", b.id);
    return NextResponse.json({ ok: true });
  }
  if (!(kind in TABLE)) return bad("없는 항목이에요.", 404);
  const k = kind as Kind;
  const cur = await row(sb, TABLE[k], b.id, orgId);
  if (!cur) return bad(`${eul(NAME[k])} 찾지 못했어요.`, 404);
  // 단추에서 선정된 고객은 지우면 다음에 화면을 열 때 다시 생긴다. 지우지 않고 합치기만 한다
  if (k === "contacts" && cur.danchu_key) return bad("단추에서 선정된 담당자는 지울 수 없어요. 이름·소속은 고칠 수 있어요.", 409);
  if (k === "companies") {
    const { data: dc } = await sb.from("cro_crm_contacts").select("id").eq("org_id", orgId).eq("company_id", b.id).not("danchu_key", "is", null).limit(1);
    if (dc?.length) return bad("단추에서 선정된 담당자가 있는 고객사는 지울 수 없어요. 같은 회사가 둘이면 합치기를 써 주세요.", 409);
  }
  const { error } = await sb.from(TABLE[k]).delete().eq("id", b.id).eq("org_id", orgId);
  if (error) return fail(NAME[k], error);
  return NextResponse.json({ ok: true });
}
