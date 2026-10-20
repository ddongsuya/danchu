import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { isPendingToken, pendingPreview } from "@/lib/rfq-pending";
import { ClaimPendingButton } from "@/components/ClaimPendingButton";

export const dynamic = "force-dynamic";

/**
 * 인증 메일의 버튼으로 들어온 경우. /auth/confirm 이 로그인을 마치고 여기로 보낸다.
 * 여는 것만으로는 접수하지 않는다: 맡긴 요청서 요약을 보여 주고, 의뢰자가 "이 요청서 보내기"를 눌러야 접수한다 (POST /api/rfq/pending/claim).
 * 이미 접수됐으면 같은 완료 화면으로 간다.
 */
export default async function ClaimPending({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isPendingToken(token)) notFound();
  const s = await requireSession("requester", `/app/claim/${token}`);
  const r = await pendingPreview(token, s.email);
  if ("claimedRfqNo" in r && r.claimedRfqNo) redirect(`/app/new/done?no=${encodeURIComponent(r.claimedRfqNo)}`);
  if ("error" in r) {
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
  return (
    <div className="stack" style={{ maxWidth: 560, margin: "0 auto", gap: 16 }}>
      <div className="ph">
        <div>
          <h1>이메일을 확인했습니다</h1>
          <p>아래 요청서가 맞으면 보내기를 눌러 주세요. 보내면 분야가 맞는 기관에 참여 안내가 갑니다.</p>
        </div>
      </div>
      <section className="card card--rows" aria-label="맡겨 둔 요청서">
        {[
          ["시험물질", r.substance || "-"],
          ["회사", r.company || "-"],
          ["시험 분야", r.categories.join(" · ") || "-"],
          ["첨부", r.files.length ? r.files.join(", ") : "없음"],
        ].map(([k, v]) => (
          <div key={k} className="row" style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 12, padding: "10px 0" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>{k}</span>
            <span style={{ overflowWrap: "anywhere" }}>{v}</span>
          </div>
        ))}
      </section>
      <ClaimPendingButton token={token} />
      <p style={{ fontSize: 13, color: "var(--muted)" }}>직접 쓴 요청서가 아니면 보내지 마세요. 보내지 않은 요청서는 7일 뒤 지워집니다.</p>
      <Link href="/app" className="b2">내 견적 요청</Link>
    </div>
  );
}
