import { requireSession } from "@/lib/auth";
import { dbReady, listRequestsForUser } from "@/lib/data";
import { RequestOverview } from "@/components/app/RequestOverview";
import { todaySeoul } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await requireSession("requester", "/app");
  const list = dbReady() ? await listRequestsForUser(s.userId) : [];
  // Only the fields needed by the list cross the server/client boundary.
  const summaries = list.map(({ id, rfq_no, status, outcome, substance, categories, joined, cap, submitted, sent, opened, reply_by, created_at, compared_at, selected_quote_id, started_at }) => ({ id, rfq_no, status, outcome, substance, categories, joined, cap, submitted, sent, opened, reply_by, created_at, compared_at, selected_quote_id, started_at }));
  // 오늘 날짜는 서버에서 정해 넘긴다 (서버·브라우저 시간대가 달라도 같은 줄이 보이게)
  return <RequestOverview name={s.profile.name || "의뢰자"} list={summaries} today={todaySeoul()} />;
}
