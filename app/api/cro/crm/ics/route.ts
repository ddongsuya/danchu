import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { siteUrl } from "@/lib/notify";
import { icsForEvent, isUuid, personLabel } from "@/lib/crm-shape";
import { memberName } from "@/lib/crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 일정 한 건을 캘린더 파일(.ics)로 (0038). 구글·아웃룩·애플 캘린더 모두 이 파일을 열면 일정이 들어간다.
 * GET /api/cro/crm/ics?id=<일정 id>
 */
export async function GET(req: Request) {
  const s = await sessionOrNull("cro");
  const orgId = s?.profile.cro_org_id;
  const sb = getSupabaseAdmin();
  const id = new URL(req.url).searchParams.get("id");
  if (!s || !orgId || !sb) return new Response("권한이 없어요.", { status: 403 });
  if (!isUuid(id)) return new Response("일정을 찾지 못했어요.", { status: 400 });
  const { data: e } = await sb.from("cro_crm_events").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!e) return new Response("일정을 찾지 못했어요.", { status: 404 });
  const [{ data: co }, { data: cs }, { data: ms }] = await Promise.all([
    e.company_id ? sb.from("cro_crm_companies").select("name").eq("id", e.company_id).maybeSingle() : Promise.resolve({ data: null }),
    e.attendee_contacts.length ? sb.from("cro_crm_contacts").select("name, title").in("id", e.attendee_contacts).eq("org_id", orgId) : Promise.resolve({ data: [] }),
    e.attendee_members.length ? sb.from("profiles").select("name, email").in("id", e.attendee_members).eq("cro_org_id", orgId) : Promise.resolve({ data: [] }),
  ]);
  const attendees = [
    ...((cs ?? []) as { name: string; title: string }[]).map((c) => personLabel(c.name, c.title)),
    ...((ms ?? []) as { name: string | null; email: string }[]).map(memberName),
    e.attendees_extra,
  ].filter(Boolean).join(", ");
  const body = icsForEvent(e, { company: (co as { name: string } | null)?.name, attendees, url: `${siteUrl()}/cro/calendar?w=${e.starts_at.slice(0, 10)}&e=${e.id}` });
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="danchu-${e.id.slice(0, 8)}.ics"`,
      "cache-control": "private, no-store",
    },
  });
}
