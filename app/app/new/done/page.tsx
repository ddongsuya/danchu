import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { defaultReplyBy } from "@/lib/distribute";
import { AttachmentRetry } from "@/components/app/AttachmentRetry";
import { needsCda } from "@/lib/request-policy";
export const dynamic = "force-dynamic";
export default async function Done({
  searchParams,
}: {
  searchParams: Promise<{ no?: string }>;
}) {
  const s = await requireSession("requester");
  const { no } = await searchParams;
  if (!no) notFound();
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin"))
    notFound();
  const d = await getRfqDetail(rfq);
  const missing = d.files.filter((f) => !f.uploaded_at);
  return (
    <div className="stack" style={{ maxWidth: 640, margin: "0 auto", gap: 24 }}>
      <div className="ph">
        <div>
          <h1>견적 요청을 접수했습니다</h1>
          <p>
            {rfq.substance} · 요청 번호 {rfq.rfq_no}
          </p>
        </div>
      </div>
      <section className="card card--pad stack">
        <h2 style={{ fontSize: 18 }}>다음 진행 안내</h2>
        <p>
          {d.invites.length
            ? `${d.invites.length}곳에 요청을 전달했습니다.`
            : "시험 분야가 맞는 기관을 확인하고 있습니다. 전달 현황은 요청 상세에서 확인할 수 있습니다."}
        </p>
        <p>
          견적 회신 기한: <b>{defaultReplyBy(rfq)}</b>
        </p>
        <p>
          기한 이후 회신이 있으면 비교표가 공개됩니다. 회신이 없으면 추가 진행을
          확인합니다.
        </p>
        {needsCda(rfq.confidentiality) && (
          <p className="fld__help">
            회사명과 첨부는 기관별 CDA 체결 확인 후 공개합니다.
          </p>
        )}
      </section>
      {missing.length > 0 && (
        <section className="note note--warn" style={{ display: "block" }}>
          <b>업로드 확인이 필요한 첨부</b>
          <ul>
            {missing.map((f) => (
              <li key={f.id}>{f.file_name}</li>
            ))}
          </ul>
          <AttachmentRetry no={no} />
        </section>
      )}
      <Link href={`/app/r/${no}`} className="b1 blg">
        요청 진행 상황 보기
      </Link>
      <Link href="/app" className="b2">
        내 견적 요청
      </Link>
    </div>
  );
}
