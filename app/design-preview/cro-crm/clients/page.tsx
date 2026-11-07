import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientsPreview, previewEnabled } from "../fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "고객 검토 · 단추", robots: { index: false, follow: false } };

/** 고객 화면 검토용 (로그인 없이, 저장 안 됨). ?c= 고객, ?tab=log|won|info */
export default async function CrmClientsPreview({ searchParams }: { searchParams: Promise<{ c?: string; tab?: string }> }) {
  if (!previewEnabled()) notFound();
  const sp = await searchParams;
  return <ClientsPreview c={sp.c} tab={sp.tab} />;
}
