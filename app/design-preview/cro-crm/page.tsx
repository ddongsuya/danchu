import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { Pipeline } from "@/components/cro/Pipeline";
import { buildPipeline } from "@/lib/pipeline";
import { NAV, PATHS, SESSION, previewEnabled, sample } from "./fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "견적 진행 검토 · 단추", robots: { index: false, follow: false } };

/** 견적 진행 검토용 (로그인 없이, 저장 안 됨). Vercel 미리보기 배포에서만 열린다. ?sel= 로 요청 선택 */
export default async function CrmPipelinePreview({ searchParams }: { searchParams: Promise<{ sel?: string }> }) {
  if (!previewEnabled()) notFound();
  const { sel } = await searchParams;
  const { invites, awards } = sample();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = buildPipeline(invites as any, awards as any);
  return (
    <AppState>
      <Shell session={SESSION} nav={NAV}>
        <Pipeline items={items} sel={sel ?? null} paths={PATHS} companyOf={{ u5: "00000000-0000-4000-8000-000000000001" }} />
      </Shell>
    </AppState>
  );
}

