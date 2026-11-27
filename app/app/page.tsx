import { requireSession } from "@/lib/auth";
import { dbReady, listRequestsForUser } from "@/lib/data";
import { RequestOverview } from "@/components/app/RequestOverview";
import { md, todaySeoul } from "@/lib/format";
import { ReqHome } from "@/components/app/ReqHome";
import { homeChecks } from "@/lib/home-checks";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const s = await requireSession("requester", "/app");
  // 사이드바 "요청 검색" (/app?q=): 검색 칸을 열고 커서를 둔다
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 100) : undefined;
  const list = dbReady() ? await listRequestsForUser(s.userId) : [];
  // Only the fields needed by the list cross the server/client boundary.
  const summaries = list.map(({ id, rfq_no, status, outcome, substance, categories, joined, cap, submitted, sent, opened, reply_by, created_at, compared_at, selected_quote_id, started_at }) => ({ id, rfq_no, status, outcome, substance, categories, joined, cap, submitted, sent, opened, reply_by, created_at, compared_at, selected_quote_id, started_at }));
  // 오늘 날짜는 서버에서 정해 넘긴다 (서버·브라우저 시간대가 달라도 같은 줄이 보이게)
  // 요청 검색(?q=)은 목록과 검색칸으로 연다
  if (query !== undefined) return <RequestOverview name={s.profile.name || "의뢰자"} list={summaries} today={todaySeoul()} query={query} />;
  // 홈 (시안 r-home): 입력창 + 확인 필요. 계약 확인을 기다리는 요청은 수주 기록에서 고른다
  const live = list.filter((r) => ["selected", "contracting"].includes(r.status)).map((r) => r.id);
  const { data: aws } = live.length && dbReady() ? await getSupabaseAdmin()!.from("rfq_awards").select("rfq_id, cro_name, contract_status, contract_reported_at, contract_confirm_due_at, contract_confirmed_at, requester_confirmed_at, requester_disputed_at, dispute_resolved_at").in("rfq_id", live) : { data: [] };
  const noOf = new Map(list.map((r) => [r.id, r.rfq_no]));
  const awards = (aws ?? []).map((a) => ({
    rfq_no: noOf.get(a.rfq_id) ?? "", cro_name: a.cro_name, contract_status: a.contract_status, contract_reported_at: a.contract_reported_at, contract_confirm_due_at: a.contract_confirm_due_at,
    confirmed: !!(a.contract_confirmed_at || a.requester_confirmed_at), disputed: !!(a.requester_disputed_at && !a.dispute_resolved_at),
  }));
  return <ReqHome checks={homeChecks(list, awards, todaySeoul(), md)} first={list.length === 0} />;
}
