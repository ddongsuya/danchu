import { NextResponse } from "next/server";
import { clientIp } from "@/lib/rate-limit";
import { sessionOrNull } from "@/lib/auth";
import { loadQuote } from "@/lib/quote-load";
import { canJoinAs, loadOptsFor, OPERATOR_JOIN_DENIED } from "@/lib/concierge";
import { joinOffer } from "@/lib/rpc";
import { CRO_TERMS_VERSION } from "@/lib/request-policy";
import { adminUserIds, logEvent, notifyUsers } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const md = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) : "");

/** join_offer 거절 코드 → 기관에 보여 줄 안내 (문제 + 다음에 할 일) */
function denied(code: string, joinBy?: string | null): { error: string; status: number } {
  switch (code) {
    case "closed": return { error: "비교표가 열렸거나 의뢰자가 기관을 선정해 이 요청에는 더 참여할 수 없습니다.", status: 409 };
    case "revoked":
    case "not_found": return { error: "유효하지 않거나 만료된 링크입니다. 받은 요청 화면이나 단추(hello@danchu.kr)에서 새 링크를 받아 주세요.", status: 404 };
    // 철회는 되돌릴 수 없다. 참여 전 불참은 참여 결정 기한 전에만 다시 참여할 수 있다 (2026-10-20 결정 3)
    case "withdrawn": return { error: "참여를 철회한 요청이라 다시 참여할 수 없습니다.", status: 403 };
    case "declined": return { error: `불참으로 처리한 요청입니다. 참여 결정 기한${joinBy ? `(${md(joinBy)})` : ""}이 지나 다시 참여할 수 없습니다.`, status: 403 };
    case "expired": return { error: "링크가 만료되어 참여할 수 없습니다. 단추(hello@danchu.kr)에 연장을 요청해 주세요.", status: 403 };
    case "operator_not_allowed": return { error: OPERATOR_JOIN_DENIED, status: 403 };
    case "not_member": return { error: "다른 기관 담당자 계정으로 로그인되어 있어 이 기관으로 참여할 수 없습니다. 이 기관의 안내라면 로그아웃한 뒤 메일의 링크로 다시 열어 주세요.", status: 403 };
    case "org_inactive": return { error: "기관 참여가 중지되어 참여할 수 없습니다. 단추(hello@danchu.kr)에 문의해 주세요.", status: 403 };
    case "cutoff": return { error: "참여 마감이 지났습니다. 회신 기한 3영업일 전까지 참여할 수 있습니다.", status: 409 };
    case "reserved": return { error: `남은 자리는 의뢰자가 지명한 기관 몫입니다.${joinBy ? ` 참여 결정 기한(${md(joinBy)})이 지나도 지명 기관이 참여하지 않으면 자리가 풀리니 그때 다시 눌러 주세요.` : ""}`, status: 409 };
    case "full": return { error: "참여 자리가 모두 찼습니다. 참여한 기관이 철회하면 자리가 생깁니다.", status: 409 };
    case "terms_required":
    case "bad_channel": return { error: "참여 정보가 올바르지 않습니다. 화면을 새로 고친 뒤 다시 눌러 주세요.", status: 400 };
    default: return { error: "참여를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", status: 500 };
  }
}

/**
 * POST { agree: true, terms } — 기관이 요약을 보고 이 요청에 참여한다 (0023, join_offer).
 * 로그인한 그 기관 담당자면 portal(계정을 남긴다), 아니면 회신 링크(token)로 기록한다. 운영자는 기관 대신 참여할 수 없다.
 * terms 는 화면에 보여 준 이용 조건 판이다. 지금 판과 다르면 다시 보게 한다. IP·브라우저와 함께 참여 기록으로 남는다.
 * 참여 전 불참(declined, joined_at 없음)도 이 길로 다시 참여한다 (2026-10-20 결정 3, 0025 join_offer rejoined):
 * 참여 결정 기한 전이고 자리가 남았을 때만. 결과에 rejoined 가 오면 "불참 취소" 기록을 함께 남긴다. 철회는 되돌릴 수 없다.
 * DELETE /api/quote/[token]/decline 도 같은 처리로 넘어온다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const s = await sessionOrNull();
  const role = s?.profile.role;
  if (!canJoinAs(role)) return NextResponse.json({ error: OPERATOR_JOIN_DENIED }, { status: 403 });
  const got = await loadQuote(token, loadOptsFor(role));
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as { agree?: unknown; terms?: unknown };
  if (b.agree !== true) return NextResponse.json({ error: "참여 문구를 확인한 뒤 참여하기를 눌러 주세요." }, { status: 400 });
  if (b.terms !== CRO_TERMS_VERSION) return NextResponse.json({ error: "이용 조건이 바뀌었습니다. 화면을 새로 고쳐 바뀐 조건을 확인한 뒤 다시 눌러 주세요." }, { status: 409 });
  if (got.joined && !got.declined) return NextResponse.json({ ok: true, already: true });

  const portal = role === "cro" && !!s?.profile.cro_org_id && s.profile.cro_org_id === got.croOrgId;
  const ip = clientIp(req);
  const r = await joinOffer(got.inviteId, got.token, {
    actorId: s?.userId ?? null,
    channel: portal ? "portal" : "token",
    termsVersion: CRO_TERMS_VERSION,
    ip: ip === "unknown" ? null : ip,
    ua: req.headers.get("user-agent"),
  });
  if (!r.ok) {
    const d = denied(r.code, got.joinBy);
    return NextResponse.json({ error: d.error, code: r.code }, { status: d.status });
  }
  if (!r.already) {
    const rejoined = !!r.rejoined;
    await logEvent(got.rfqId, "joined", `${got.croName} ${rejoined ? "불참 취소 · 다시 참여" : "참여"}`, `${portal ? "기관 포털" : "회신 링크"} · 조건 ${CRO_TERMS_VERSION}`, s?.userId ?? null, { inviteId: got.inviteId, channel: portal ? "portal" : "token", rejoined });
    // 운영자에게는 앱 알림만 (참여는 자주 일어나는 일이라 메일은 보내지 않는다)
    await notifyUsers(await adminUserIds(), { kind: "견적", title: `${got.rfq.no} ${rejoined ? "불참 취소 · 다시 참여" : "참여"} · ${got.croName}`, href: `/admin/r/${got.rfq.no}` });
  }
  // 자리 현황 원본(참여 수·지명 수)은 돌려주지 않는다. 화면은 새로 고쳐 기관용 표시(seatsLabel)로 다시 읽는다
  return NextResponse.json({ ok: true, already: !!r.already, rejoined: !!r.rejoined });
}
