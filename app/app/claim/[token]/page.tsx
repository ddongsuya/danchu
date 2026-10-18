import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { claimPending, isPendingToken } from "@/lib/rfq-pending";

export const dynamic = "force-dynamic";

/**
 * 인증 메일의 버튼으로 들어온 경우. /auth/confirm 이 로그인을 마치고 여기로 보낸다.
 * 맡겨 둔 요청서를 접수하고 완료 화면으로 넘긴다. 이미 접수됐으면 같은 완료 화면으로 간다.
 */
export default async function ClaimPending({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isPendingToken(token)) notFound();
  const s = await requireSession("requester", `/app/claim/${token}`);
  const r = await claimPending(token, { id: s.userId, email: s.email });
  if ("rfqNo" in r) redirect(`/app/new/done?no=${encodeURIComponent(r.rfqNo)}`);
  return (
    <div className="stack" style={{ maxWidth: 560, margin: "0 auto", gap: 16 }}>
      <div className="ph">
        <div>
          <h1>요청서를 접수하지 못했습니다</h1>
          <p>{r.error}</p>
        </div>
      </div>
      <Link href="/app/new" className="b1">요청서 화면으로</Link>
      <Link href="/app" className="b2">내 견적 요청</Link>
    </div>
  );
}
