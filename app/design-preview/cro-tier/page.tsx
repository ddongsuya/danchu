import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { RequestsBoard } from "@/components/cro/RequestsBoard";
import { todaySeoul } from "@/lib/format";
import { TodayView } from "@/components/cro/crm/TodayView";
import { buildPipeline } from "@/lib/pipeline";
import { croNav, CRO_PATHS, type CroTier } from "@/lib/cro-nav";
import { PLANS } from "@/lib/plans";
import { PATHS, SESSION, previewCtx, previewEnabled, sample } from "../cro-crm/fixtures";
import "@/components/cro/crm/crm.css";

export const dynamic = "force-dynamic";

/** 위 바 종 팝오버 예시 (시안 c-bell). 실제 알림이 아니다 */
const RECENT = [
  { id: "n1", kind: "배포", title: "새 요청", body: "DEMO-0021 · 예시 물질", href: null, read_at: null, created_at: "2026-11-26T01:00:00Z" },
  { id: "n2", kind: "견적", title: "회신 기한 D-2", body: "DEMO-0019 · 예시 물질", href: null, read_at: null, created_at: "2026-11-25T01:00:00Z" },
  { id: "n3", kind: "선정", title: "선정", body: "DEMO-0012 · 예시 물질", href: null, read_at: "2026-11-24T01:00:00Z", created_at: "2026-11-24T01:00:00Z" },
  { id: "n4", kind: "기관", title: "구성원 연결 요청", body: "preview@example.invalid", href: null, read_at: "2026-11-20T01:00:00Z", created_at: "2026-11-20T01:00:00Z" },
];
export const metadata: Metadata = { title: "등급별 화면 검토 · 단추", robots: { index: false, follow: false } };

/** 등급별 기관 화면 검토용 (?plan=free|plus|pro&used=3). 미리보기 배포에서만 열린다 */
export default async function CroTierPreview({ searchParams }: { searchParams: Promise<{ plan?: string; used?: string; bell?: string }> }) {
  if (!previewEnabled()) notFound();
  const q = await searchParams;
  const tier: CroTier = q.plan === "free" || q.plan === "plus" ? q.plan : "pro";
  const used = Math.min(5, Math.max(0, Number(q.used ?? 3) || 0));
  const { nav, tabs } = croNav(tier, 2, { ...CRO_PATHS, requests: PATHS.pipe });
  const usage = tier === "free" ? <span className={used >= 5 ? "pt__usage--full" : undefined}>견적 <b>{used} / 5건</b></span> : undefined;
  const { invites, awards } = sample();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = buildPipeline(invites as any, awards as any);
  const c = tier === "pro" ? previewCtx() : null;
  return (
    <AppState>
      <Shell session={SESSION} nav={nav} tabs={tabs} plan={PLANS[tier].name} usage={usage} recent={q.bell === "none" ? [] : RECENT}>
        {/* 시안 검토판 c-req-free: 시범 운영 중에는 모든 기관이 Pro 메뉴라 무료·Plus 메뉴는 2028년 이후 화면이다 */}
        {!c && <p className="cx-preview" role="note">2028년 이후 {PLANS[tier].name} 요금제 메뉴 예시 · 시범 운영 중에는 모든 기관이 Pro 메뉴를 봐요</p>}
        {c ? <TodayView c={c} undecided={[...c.danchu.values()]} /> : <RequestsBoard items={items} awards={[]} query={{ tab: "all", q: "", cat: "", due: "", glp: "", sp: "", sel: null }} paths={PATHS} companyOf={{}} today={todaySeoul()} base="/design-preview/cro-tier" />}
      </Shell>
    </AppState>
  );
}
