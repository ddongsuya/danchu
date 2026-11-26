import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { countBy, dbReady, listAllRequests, listStuckRequests } from "@/lib/data";
import { missingProdEnv } from "@/lib/env";
import { readSchemaStatus } from "@/lib/schema-version";
import { sentryEnabled } from "@/lib/observe";
import { OptInTransition, type TransitionRow } from "@/components/admin/OptInTransition";
import { IntakeBoard, LIVE_STATUSES, WON_STATUSES, type IntakeQuery, type IntakeTab } from "@/components/admin/IntakeBoard";
import { planOptInTransition } from "@/lib/opt-in-transition";
import { getSupabaseAdmin } from "@/lib/supabase";
import { todaySeoul } from "@/lib/format";
import { captureError } from "@/lib/observe";

export const dynamic = "force-dynamic";

// 단계 이름은 진행 단계 이름(lib/status.ts STAGES)과 같게. "overdue"는 예전 링크(기한 지남)를 살린다
const STATUS_KEYS = ["received", "distributed", "quoted", "compared", "selected", "contracting", "closed", "cancelled", "overdue"];

/**
 * 운영자 접수 (2026-11-26 시안 v7 a-intake). 멈춤 · 진행 · 선정 · 전체 탭 + 흐름 숫자 + 표와 오른쪽 칸.
 * 참여 숫자는 목록과 같은 participation 계산(participationLabel)을 쓴다 (tests/participation-count).
 */
export default async function AdminHome({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string; q?: string; page?: string; sel?: string }> }) {
  await requireSession("admin");
  const sp = await searchParams;
  if (!dbReady()) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const status = STATUS_KEYS.includes(sp.status ?? "") ? (sp.status as string) : "";
  const [counts, schema, stuck] = await Promise.all([countBy(), readSchemaStatus(), listStuckRequests()]);
  const tabParam = (["stuck", "live", "won", "all"] as IntakeTab[]).find((t) => t === sp.tab);
  // 예전 주소(?status=…)는 전체 탭에서 그 단계만. 탭을 고르지 않았으면 멈춘 요청이 있을 때 멈춤, 없으면 진행
  const tab: IntakeTab = status ? "all" : tabParam ?? (stuck.length ? "stuck" : "live");
  const query: IntakeQuery = { tab, q: (sp.q ?? "").slice(0, 60), status, sel: (sp.sel ?? "").slice(0, 40), page: Math.max(1, parseInt(sp.page ?? "1", 10) || 1) };
  const opts = tab === "stuck" ? { nos: stuck.map((r) => r.rfq_no) } : tab === "live" ? { statuses: LIVE_STATUSES } : tab === "won" ? { statuses: WON_STATUSES } : {};
  const got = await listAllRequests(status || undefined, query.q || undefined, query.page, opts);
  // 멈춤 탭은 오래 멈춘 순 (시안 a-intake "경과")
  const age = new Map(stuck.map((r) => [r.rfq_no, Math.max(...r.reasons.map((x) => x.days))]));
  const list = tab === "stuck" ? [...got.list].sort((a, b) => (age.get(b.rfq_no) ?? 0) - (age.get(a.rfq_no) ?? 0)) : got.list;
  const hasMore = got.hasMore;
  const transition = schema.ok ? await transitionRows() : [];
  const missingEnv = missingProdEnv();
  const noSentry = process.env.NODE_ENV === "production" && !sentryEnabled();
  const n = (ks: string[]) => ks.reduce((a, k) => a + (counts.rfq[k] ?? 0), 0);
  const tabCounts = { stuck: stuck.length, live: n(LIVE_STATUSES), won: n(WON_STATUSES), all: Object.values(counts.rfq).reduce((a, b) => a + b, 0), byStatus: counts.rfq };
  const pendingOrg = counts.org.pending ?? 0;

  return (
    <>
      {(missingEnv.length > 0 || noSentry || !schema.ok) && (
        <div className="note note--warn" role="alert" style={{ margin: "16px 24px 0" }}>
          <b>운영 설정 확인</b>
          {!schema.ok && <div>{schema.message} 배포(기관에 요청 보내기)가 멈춰 있습니다. README의 배포 순서대로 마이그레이션을 적용한 뒤 npm run check:schema 로 확인해 주세요.</div>}
          {missingEnv.length > 0 && <div>환경변수 누락: {missingEnv.join(", ")}. 접수·메일·예약 작업이 제대로 동작하지 않습니다. Vercel → Settings → Environment Variables 에 넣고 다시 배포해 주세요.</div>}
          {noSentry && <div>오류 모니터링(SENTRY_DSN)이 꺼져 있습니다. 서버 오류가 어디에도 기록되지 않습니다.</div>}
        </div>
      )}
      {transition.length > 0 && <div style={{ margin: "16px 24px 0" }}><OptInTransition rows={transition} /></div>}
      {pendingOrg > 0 && (
        <p className="note note--tint" style={{ margin: "16px 24px 0" }}>
          기관 승인 대기 <b className="tnum">{pendingOrg}</b>곳 <Link href="/admin/cros?status=pending">기관에서 보기</Link>
        </p>
      )}
      <IntakeBoard list={list} hasMore={hasMore} query={query} counts={tabCounts} stuck={new Map(stuck.map((r) => [r.rfq_no, r.reasons]))} />
    </>
  );
}

/** 참여 선택형 전환이 남은 열린 요청 (0023 적용 뒤 한 번 실행, lib/opt-in-transition.ts). 읽지 못하면 카드를 숨기고 오류만 남긴다 */
async function transitionRows(): Promise<TransitionRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const plan = await planOptInTransition(sb, todaySeoul());
    return plan.requests.map((r) => ({ rfqNo: r.rfqNo, replyBy: r.replyBy, joinBy: new Date(r.joinBy).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }), offers: r.offers.map((o) => o.croName) }));
  } catch (e) {
    captureError(e, "admin:opt-in-transition");
    return [];
  }
}
