import { requireSession } from "@/lib/auth";
import { dbReady, listAwardsForOrg } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { ClientsView, type ClientTab } from "@/components/cro/ClientsView";
import { buildFeed, groupClients, loadClientExtras } from "@/lib/clients";

export const dynamic = "force-dynamic";


/**
 * 고객 (2026-11-07, 0038). 이 기관을 선정한 의뢰자만 나온다.
 * 넓은 화면: 고객 목록 · 기록과 아래 고정 메모 칸 · 수주와 공개된 정보 세 칸.
 * 휴대폰: 목록 화면 → 고객 화면(?c=). 고객 화면은 기록 · 수주 · 정보 탭(?tab=)으로 나눠 길게 내려가지 않는다.
 */
export default async function CroClients({ searchParams }: { searchParams: Promise<{ c?: string; tab?: string }> }) {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  const { c, tab: rawTab } = await searchParams;
  const tab: ClientTab = rawTab === "won" || rawTab === "info" ? rawTab : "log";
  const awards = dbReady() ? await listAwardsForOrg(org.id) : [];
  const clients = groupClients(awards);
  const cur = clients.find((x) => x.key === c) ?? null;
  const active = cur ?? clients[0] ?? null;

  const extras = active ? await loadClientExtras(org.id, active) : { notes: [], docs: [], notesReady: false };
  const feed = active ? buildFeed(active, awards, extras.notes, extras.docs) : [];
  return <ClientsView clients={clients} cur={cur} active={active} tab={tab} feed={feed} docs={extras.docs} notesReady={extras.notesReady} />;
}
