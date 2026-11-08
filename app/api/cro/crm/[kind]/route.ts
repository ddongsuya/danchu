import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkRefs, mergeCompanies, moveDeal } from "@/lib/crm";
import { isUuid, parseActivity, parseCompany, parseContact, parseEvent, parseTask, type CrmDeal, type Parsed } from "@/lib/crm-shape";
import { LOST_REASONS, isStage, isStatus, parseDeal, parseWon } from "@/lib/crm-deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 기관 CRM 쓰기 (0038). /api/cro/crm/<kind>
 *   companies · contacts · deals · activities · events · tasks : POST(만들기) · PATCH({id, ...바꿀 칸}) · DELETE({id})
 *   move          : POST({id, stage?, status?, reason?, note?, won_amount?}) 안건 단계·수주·실패 (이력 한 줄)
 *   quotes        : PATCH({id, deal_id?, sent_on?}) 견적서를 안건에 묶고 보낸 날을 남긴다
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
  deals: "cro_crm_deals",
  activities: "cro_crm_activities",
  events: "cro_crm_events",
  tasks: "cro_crm_tasks",
} as const;
type Kind = keyof typeof TABLE;
const NAME: Record<Kind, string> = { companies: "고객사", contacts: "담당자", deals: "안건", activities: "기록", events: "일정", tasks: "할 일" };

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
    case "deals": return parseDeal(b, partial);
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
  return data as (Record<string, unknown> & { id: string; company_id: string | null; deal_id?: string | null }) | null;
}

/** 안건에 붙인 기록·일정·할 일은 그 안건의 고객사를 따른다 */
async function dealCompany(sb: Admin, orgId: string, dealId: unknown): Promise<string | null | undefined> {
  if (!isUuid(dealId)) return undefined;
  const { data } = await sb.from("cro_crm_deals").select("company_id").eq("id", dealId).eq("org_id", orgId).maybeSingle();
  return data ? data.company_id : undefined;
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

  if (kind === "move") {
    if (!isUuid(b.id)) return bad("안건을 찾지 못했어요.");
    const { data: deal } = await sb.from("cro_crm_deals").select("*").eq("id", b.id).eq("org_id", orgId).maybeSingle();
    if (!deal) return bad("안건을 찾지 못했어요.", 404);
    const stage = b.stage === undefined ? undefined : isStage(b.stage) ? b.stage : null;
    const status = b.status === undefined ? undefined : isStatus(b.status) ? b.status : null;
    if (stage === null || status === null) return bad("단계를 골라 주세요.");
    const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 40) : "";
    if (status === "lost" && !(LOST_REASONS as readonly string[]).includes(reason)) return bad("실패 사유를 하나 골라 주세요.");
    const wonAmount = b.won_amount === undefined || b.won_amount === null || b.won_amount === "" ? null : parseWon(b.won_amount);
    if (b.won_amount && wonAmount == null) return bad("계약 금액은 숫자로 적어 주세요.");
    const note = typeof b.note === "string" ? b.note.trim().slice(0, 2000) : "";
    const err = await moveDeal(sb, orgId, deal as CrmDeal, { stage, status, reason, note, won_amount: wonAmount }, s.userId);
    if (err) return bad(err, 500);
    // 실패 메모에 다시 연락할 날이 있으면 할 일로 (예: "내년 상반기에 다시 문의")
    if (status === "lost" && typeof b.follow_up_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.follow_up_on)) {
      await sb.from("cro_crm_tasks").insert({ org_id: orgId, deal_id: deal.id, company_id: deal.company_id, title: "다시 연락하기", memo: note, category: "contact", due_on: b.follow_up_on, assignee: s.userId, created_by: s.userId } as never);
    }
    return NextResponse.json({ ok: true, id: deal.id });
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
  const v = p.value as Record<string, unknown>;
  // 안건에 붙이는 기록·일정·할 일: 고객사는 안건의 고객사
  if (k !== "deals" && k !== "companies" && k !== "contacts" && v.deal_id) {
    const c = await dealCompany(sb, orgId, v.deal_id);
    if (c === undefined) return bad("안건을 찾지 못했어요.", 404);
    v.company_id = c;
  }
  const err = await checkRefs(sb, orgId, v as Parameters<typeof checkRefs>[2]);
  if (err) return bad(err, 404);

  const base = {
    ...v, org_id: orgId, created_by: s.userId,
    ...(k === "companies" || k === "contacts" || k === "deals" ? { source: "manual" } : {}),
    ...(k === "deals" && !v.owner ? { owner: s.userId } : {}),
  };
  const { data, error } = await sb.from(TABLE[k]).insert(base as never).select("id").single();
  if (error || !data) return fail(NAME[k], error);
  const id = (data as { id: string }).id;
  // 안건 화면에서 담당자를 추가하면 그 안건에도 붙인다 (같은 고객사일 때)
  if (k === "contacts" && isUuid(b.deal_id)) {
    const { data: d } = await sb.from("cro_crm_deals").select("id, company_id, contact_ids").eq("id", b.deal_id).eq("org_id", orgId).maybeSingle();
    if (d && (d.company_id === v.company_id || !d.company_id)) {
      await sb.from("cro_crm_deals").update({ company_id: d.company_id ?? v.company_id, contact_ids: [...new Set([...d.contact_ids, id])].slice(0, 10) } as never).eq("id", d.id).eq("org_id", orgId);
    }
  }
  if (k === "deals") {
    await sb.from("cro_crm_deal_history").insert({ org_id: orgId, deal_id: id, to_stage: (v.stage as string) ?? "inquiry", to_status: "open", actor: "member", created_by: s.userId } as never);
  }

  // 기록: 일정에서 남겼으면 그 일정을 끝낸 것으로, "다음 할 일"이 있으면 같이 만든다
  if (k === "activities") {
    const a = v as { company_id: string | null; deal_id: string | null; contact_id: string | null; quote_doc_id: string | null; event_id: string | null };
    if (a.event_id) await sb.from("cro_crm_events").update({ done_at: new Date().toISOString() }).eq("id", a.event_id).eq("org_id", orgId).is("done_at", null);
    const next = typeof b.next_title === "string" ? b.next_title.trim() : "";
    if (next) {
      const t = parseTask({ title: next, due_on: b.next_due ?? null, category: b.next_category ?? "contact", company_id: a.company_id, deal_id: a.deal_id, contact_id: a.contact_id, quote_doc_id: a.quote_doc_id, activity_id: id, assignee: s.userId });
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
    const { data: doc } = await sb.from("cro_quote_docs").select("id, deal_id, company_id, status, sent_at").eq("id", b.id).eq("org_id", orgId).maybeSingle();
    if (!doc) return bad("견적서를 찾지 못했어요.", 404);
    const patch: Record<string, unknown> = {};
    if (b.deal_id !== undefined) {
      if (b.deal_id === null) patch.deal_id = null;
      else {
        if (!isUuid(b.deal_id)) return bad("안건을 찾지 못했어요.");
        const { data: d } = await sb.from("cro_crm_deals").select("id, company_id, contact_ids").eq("id", b.deal_id).eq("org_id", orgId).maybeSingle();
        if (!d) return bad("안건을 찾지 못했어요.", 404);
        Object.assign(patch, { deal_id: d.id, company_id: d.company_id ?? doc.company_id, contact_id: d.contact_ids[0] ?? null });
      }
    }
    if (b.sent_on !== undefined) patch.sent_at = typeof b.sent_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.sent_on) ? new Date(`${b.sent_on}T09:00:00+09:00`).toISOString() : null;
    if (!Object.keys(patch).length) return NextResponse.json({ ok: true, id: b.id });
    const { error } = await sb.from("cro_quote_docs").update(patch as never).eq("id", b.id).eq("org_id", orgId);
    return error ? fail("견적서 연결", error) : NextResponse.json({ ok: true, id: b.id });
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
  // 단추 안건: 단계·상태는 move 로만, 단추 칸(요청 번호·출처)은 고치지 않는다 (parseDeal 이 받지 않는다)
  if (k === "deals" && v.stage !== undefined) {
    const err = await moveDeal(sb, orgId, cur as unknown as CrmDeal, { stage: v.stage as string }, s.userId);
    if (err) return bad(err, 500);
    delete v.stage;
    if (!Object.keys(v).length) return NextResponse.json({ ok: true, id: b.id });
  }
  if (k !== "deals" && k !== "companies" && k !== "contacts" && v.deal_id) {
    const c = await dealCompany(sb, orgId, v.deal_id);
    if (c === undefined) return bad("안건을 찾지 못했어요.", 404);
    v.company_id = c;
  }
  // 안건의 고객사를 바꾸면 담당자를 그 고객사 사람만 남긴다
  if (k === "deals" && v.company_id !== undefined && v.company_id !== cur.company_id && v.contact_ids === undefined) v.contact_ids = [];
  const company = k === "companies" ? null : ((v.company_id as string | null | undefined) !== undefined ? (v.company_id as string | null) : cur.company_id);
  // 고객사를 바꾸면 그 고객사 담당자만 남긴다
  if (k !== "companies" && k !== "contacts" && k !== "deals" && v.company_id !== undefined && v.company_id !== cur.company_id && v.contact_id === undefined) v.contact_id = null;
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
  if (k === "deals" && cur.source === "danchu") return bad("단추 요청에서 온 안건은 지울 수 없어요. 끝났으면 실패로 바꿔 주세요.", 409);
  if (k === "contacts" && cur.danchu_key) return bad("단추에서 선정된 담당자는 지울 수 없어요. 이름·소속은 고칠 수 있어요.", 409);
  if (k === "companies") {
    const { data: dc } = await sb.from("cro_crm_contacts").select("id").eq("org_id", orgId).eq("company_id", b.id).not("danchu_key", "is", null).limit(1);
    if (dc?.length) return bad("단추에서 선정된 담당자가 있는 고객사는 지울 수 없어요. 같은 회사가 둘이면 합치기를 써 주세요.", 409);
  }
  const { error } = await sb.from(TABLE[k]).delete().eq("id", b.id).eq("org_id", orgId);
  if (error) return fail(NAME[k], error);
  return NextResponse.json({ ok: true });
}
