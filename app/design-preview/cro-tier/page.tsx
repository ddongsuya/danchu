import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { Pipeline } from "@/components/cro/Pipeline";
import { TodayView } from "@/components/cro/crm/TodayView";
import { buildPipeline } from "@/lib/pipeline";
import { croNav, CRO_PATHS, type CroTier } from "@/lib/cro-nav";
import { PLANS } from "@/lib/plans";
import { PATHS, SESSION, previewCtx, previewEnabled, sample } from "../cro-crm/fixtures";
import "@/components/cro/crm/crm.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "등급별 화면 검토 · 단추", robots: { index: false, follow: false } };

/** 등급별 기관 화면 검토용 (?plan=free|plus|pro&used=3). 미리보기 배포에서만 열린다 */
export default async function CroTierPreview({ searchParams }: { searchParams: Promise<{ plan?: string; used?: string }> }) {
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
      <Shell session={SESSION} nav={nav} tabs={tabs} plan={PLANS[tier].name} usage={usage}>
        {c ? <TodayView c={c} undecided={[...c.danchu.values()]} /> : <Pipeline items={items} sel={null} paths={PATHS} companyOf={{}} />}
      </Shell>
    </AppState>
  );
}
