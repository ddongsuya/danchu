import { requireSession } from "@/lib/auth";
import { dbReady, listRequestsForUser } from "@/lib/data";
import { RequestOverview } from "@/components/app/RequestOverview";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await requireSession("requester", "/app");
  const list = dbReady() ? await listRequestsForUser(s.userId, s.email) : [];
  // Only the fields needed by the list cross the server/client boundary.
  const summaries = list.map(({ id, rfq_no, status, substance, categories, invites, submitted, reply_by, created_at }) => ({ id, rfq_no, status, substance, categories, invites, submitted, reply_by, created_at }));
  return <RequestOverview name={s.profile.name || "의뢰자"} list={summaries} />;
}
