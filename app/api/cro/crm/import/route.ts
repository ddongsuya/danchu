import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { companyDomain, listMembers } from "@/lib/crm";
import { IMPORT_FIELDS, isStage, isStatus, planImport, type ImportField, type ImportMode, type StageValue } from "@/lib/crm-deals";
import { isUuid, kstToIso, normName } from "@/lib/crm-shape";
import { featureError } from "@/lib/plan-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 엑셀 가져오기 (0038). 파일은 브라우저에서 읽고, 여기에는 머리줄·줄·칸 맞춤만 온다.
 *   POST   {file_name, header, rows, map, stage_map, mode, owner, dry?} 서버가 같은 규칙(planImport)으로 다시 계산해 만든다. dry 면 셈만
 *   DELETE {id} 24시간 안에 한 번 되돌리기 (이번 가져오기로 새로 만든 고객사·담당자·안건만 지운다)
 */
const MAX_ROWS = 3000;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function ctx() {
  const s = await sessionOrNull("cro");
  // 요금제에 고객 관리가 없으면 (정식 서비스 뒤 무료·Plus) 권한 없음과 같이 막는다 (0044)
  const orgId = s?.org?.status === "approved" && !featureError(s.org, "crm") ? s.profile.cro_org_id : null;
  return { s, orgId, sb: getSupabaseAdmin() };
}

export async function POST(req: Request) {
  const { s, orgId, sb } = await ctx();
  if (!s || !orgId) return bad("권한이 없어요.", 403);
  if (s.demo) return bad("미리보기에서는 가져오지 않아요.", 403);
  if (!sb) return bad("저장소가 설정되지 않았어요.", 503);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || !Array.isArray(b.header) || !Array.isArray(b.rows) || !Array.isArray(b.map)) return bad("파일 내용을 읽지 못했어요. 다시 골라 주세요.");
  const header = (b.header as unknown[]).map((h) => String(h ?? "").slice(0, 100)).slice(0, 60);
  const rows = (b.rows as unknown[]).filter(Array.isArray).slice(0, MAX_ROWS + 1) as unknown[][];
  if (rows.length > MAX_ROWS) return bad(`한 번에 ${MAX_ROWS.toLocaleString("ko-KR")}줄까지 가져올 수 있어요. 파일을 나눠 주세요.`);
  const map = (b.map as unknown[]).slice(0, header.length).map((f) => (typeof f === "string" && f in IMPORT_FIELDS ? (f as ImportField) : "skip"));
  if (!map.includes("company")) return bad("고객사 이름 칸을 하나 골라 주세요.");
  const stageMap: Record<string, StageValue> = {};
  if (b.stage_map && typeof b.stage_map === "object") {
    for (const [k, v] of Object.entries(b.stage_map as Record<string, unknown>).slice(0, 200)) {
      const o = v as { stage?: unknown; status?: unknown; reason?: unknown };
      if (o && isStage(o.stage) && isStatus(o.status)) stageMap[k.slice(0, 100)] = { stage: o.stage, status: o.status, reason: typeof o.reason === "string" ? o.reason.slice(0, 40) : undefined };
    }
  }
  const mode: ImportMode = b.mode === "skip" || b.mode === "new" ? b.mode : "merge";
  const [{ data: companies }, members] = await Promise.all([
    sb.from("cro_crm_companies").select("id, name, aliases, biz_no").eq("org_id", orgId).limit(5000),
    listMembers(sb, orgId),
  ]);
  const owner = isUuid(b.owner) && members.some((m) => m.id === b.owner) ? b.owner : s.userId;
  const plan = planImport({ header, rows, map, stageMap, mode, companies: companies ?? [], members, defaultOwner: owner });
  if (b.dry) return NextResponse.json({ ok: true, plan: { ...plan, rows: undefined } });

  const fileName = typeof b.file_name === "string" ? b.file_name.slice(0, 200) : "";
  const { data: imp, error: ie } = await sb.from("cro_crm_imports").insert({ org_id: orgId, file_name: fileName, row_count: rows.length, created_by: s.userId } as never).select("id").single();
  if (ie || !imp) return bad("가져오기를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.", 500);

  // 1) 새 고객사
  const live = plan.rows.filter((r) => !r.skip);
  const coKey = (r: (typeof live)[number]) => (mode === "new" ? `#${r.line}` : normName(r.company.name) || r.company.name);
  const newCo = new Map<string, (typeof live)[number]>();
  for (const r of live) if (!r.company.match && !newCo.has(coKey(r))) newCo.set(coKey(r), r);
  const coId = new Map<string, string>();
  const madeCompanies: string[] = [];
  const list = [...newCo.entries()];
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200);
    const { data, error } = await sb.from("cro_crm_companies").insert(chunk.map(([, r]) => ({
      org_id: orgId, name: r.company.name.slice(0, 200), biz_no: /^[0-9-]{10,12}$/.test(r.company.biz_no) ? r.company.biz_no : "", industry: r.company.industry.slice(0, 60),
      email_domain: companyDomain(r.contact?.email ?? ""), owner, source: "import", first_deal_on: live.filter((x) => coKey(x) === coKey(r) && x.deal?.status === "won").map((x) => x.deal?.created).filter(Boolean).sort()[0] ?? null, created_by: s.userId,
    })) as never).select("id");
    if (error || !data) { console.error("crm import companies", error); return bad("고객사를 만들다 멈췄어요. 되돌리기로 지금까지 넣은 것을 지울 수 있어요.", 500); }
    data.forEach((d, j) => { coId.set(chunk[j][0], d.id); madeCompanies.push(d.id); });
  }
  const companyOf = (r: (typeof live)[number]) => r.company.match ?? coId.get(coKey(r)) ?? null;

  // 2) 담당자 (같은 고객사에서 메일 또는 이름이 같으면 한 사람)
  const touched = [...new Set(live.map(companyOf).filter(Boolean) as string[])];
  const { data: existing } = touched.length ? await sb.from("cro_crm_contacts").select("id, company_id, name, email").eq("org_id", orgId).in("company_id", touched.slice(0, 1000)) : { data: [] };
  const ctKey = (co: string, name: string, email: string) => `${co}|${email ? email.toLowerCase() : name.replace(/\s/g, "")}`;
  const ctId = new Map<string, string>();
  for (const c of existing ?? []) { ctId.set(ctKey(c.company_id, c.name, c.email), c.id); ctId.set(ctKey(c.company_id, c.name, ""), c.id); }
  const toMake = new Map<string, { company_id: string; c: NonNullable<(typeof live)[number]["contact"]> }>();
  for (const r of live) {
    const co = companyOf(r);
    if (!co || !r.contact) continue;
    const k = ctKey(co, r.contact.name, r.contact.email);
    if (!ctId.has(k) && !ctId.has(ctKey(co, r.contact.name, "")) && !toMake.has(k)) toMake.set(k, { company_id: co, c: r.contact });
  }
  const madeContacts: string[] = [];
  const cl = [...toMake.entries()];
  for (let i = 0; i < cl.length; i += 200) {
    const chunk = cl.slice(i, i + 200);
    const { data, error } = await sb.from("cro_crm_contacts").insert(chunk.map(([, x]) => ({
      org_id: orgId, company_id: x.company_id, name: x.c.name.slice(0, 100), email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.c.email) ? x.c.email.slice(0, 200) : "", phone: x.c.phone.slice(0, 40), title: x.c.title.slice(0, 60), dept: x.c.dept.slice(0, 100), source: "import", created_by: s.userId,
    })) as never).select("id");
    if (error || !data) { console.error("crm import contacts", error); break; }
    data.forEach((d, j) => { ctId.set(chunk[j][0], d.id); madeContacts.push(d.id); });
  }

  // 3) 안건 + 이력
  const madeDeals: string[] = [];
  const dl = live.filter((r) => r.deal);
  for (let i = 0; i < dl.length; i += 200) {
    const chunk = dl.slice(i, i + 200);
    const rowsIn = chunk.map((r) => {
      const d = r.deal!;
      const co = companyOf(r);
      const ct = co && r.contact ? ctId.get(ctKey(co, r.contact.name, r.contact.email)) ?? ctId.get(ctKey(co, r.contact.name, "")) : null;
      const at = d.created ? kstToIso(d.created, "09:00") : new Date().toISOString();
      return {
        org_id: orgId, company_id: co, contact_ids: ct ? [ct] : [], title: d.title.slice(0, 200), amount: d.amount, stage: d.stage, status: d.status, stage_at: at,
        lost_reason: d.status === "lost" ? d.reason || "기타" : "", won_amount: d.status === "won" ? d.amount : null, closed_at: d.status === "open" ? null : at,
        expected_on: d.expected, memo: d.memo.slice(0, 4000), owner: d.owner, source: "import", import_id: imp.id, created_by: s.userId, created_at: at,
      };
    });
    const { data, error } = await sb.from("cro_crm_deals").insert(rowsIn as never).select("id, stage, status, created_at, lost_reason");
    if (error || !data) { console.error("crm import deals", error); break; }
    madeDeals.push(...data.map((d) => d.id));
    await sb.from("cro_crm_deal_history").insert(data.flatMap((d) => [
      { org_id: orgId, deal_id: d.id, to_stage: d.stage, to_status: "open", actor: "import", created_by: s.userId, at: d.created_at },
      ...(d.status !== "open" ? [{ org_id: orgId, deal_id: d.id, from_stage: d.stage, to_stage: d.stage, from_status: "open", to_status: d.status, reason: d.lost_reason, actor: "import", created_by: s.userId, at: d.created_at }] : []),
    ]) as never);
  }
  await sb.from("cro_crm_imports").update({ company_ids: madeCompanies, contact_ids: madeContacts, deal_ids: madeDeals } as never).eq("id", imp.id).eq("org_id", orgId);
  return NextResponse.json({ ok: true, id: imp.id, companies: madeCompanies.length, merged: plan.mergedCompanies, contacts: madeContacts.length, deals: madeDeals.length, skipped: plan.skipped });
}

export async function DELETE(req: Request) {
  const { s, orgId, sb } = await ctx();
  if (!s || !orgId) return bad("권한이 없어요.", 403);
  if (!sb) return bad("저장소가 설정되지 않았어요.", 503);
  const b = (await req.json().catch(() => ({}))) as { id?: unknown };
  if (!isUuid(b.id)) return bad("되돌릴 가져오기를 찾지 못했어요.");
  const { data: imp } = await sb.from("cro_crm_imports").select("*").eq("id", b.id).eq("org_id", orgId).maybeSingle();
  if (!imp) return bad("되돌릴 가져오기를 찾지 못했어요.", 404);
  if (imp.undone_at) return bad("이미 되돌렸어요.", 409);
  if (Date.now() - new Date(imp.created_at).getTime() > 24 * 36e5) return bad("가져온 지 24시간이 지나 되돌릴 수 없어요. 필요 없는 안건은 하나씩 지워 주세요.", 409);
  for (const [t, ids] of [["cro_crm_deals", imp.deal_ids], ["cro_crm_contacts", imp.contact_ids], ["cro_crm_companies", imp.company_ids]] as const) {
    for (let i = 0; i < ids.length; i += 300) {
      const { error } = await sb.from(t).delete().eq("org_id", orgId).in("id", ids.slice(i, i + 300));
      if (error) { console.error("crm import undo", t, error); return bad("되돌리다 멈췄어요. 잠시 뒤 다시 눌러 주세요.", 500); }
    }
  }
  await sb.from("cro_crm_imports").update({ undone_at: new Date().toISOString() } as never).eq("id", imp.id).eq("org_id", orgId);
  return NextResponse.json({ ok: true });
}
