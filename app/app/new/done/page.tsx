import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { defaultReplyBy } from "@/lib/distribute";
import { AttachmentRetry } from "@/components/app/AttachmentRetry";
import { StartNow } from "@/components/app/RequestActions";
import { needsCda } from "@/lib/request-policy";
export const dynamic = "force-dynamic";

/** 'YYYY-MM-DD' → '10월 27일' */
const md = (ymd: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(ymd)
    ? `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`
    : ymd;
/** 회신 마감 다음 날. 예약 작업이 이날 오전 9시에 비교표를 연다 */
const nextDay = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
};

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
  const sent = d.invites.length;
  const due = defaultReplyBy(rfq);
  return (
    <div className="stack" style={{ maxWidth: 640, margin: "0 auto", gap: 24 }}>
      <div className="ph">
        <div>
          <h1>요청서를 접수했습니다</h1>
          <p>
            {rfq.substance} · 접수 번호 {rfq.rfq_no}
          </p>
        </div>
      </div>
      <section className="card card--pad stack">
        <h2 style={{ fontSize: 18 }}>다음 일정</h2>
        {sent > 0 ? (
          <ol style={{ paddingLeft: 20, margin: 0 }} className="stack">
            <li>오늘 · 기관 {sent}곳에 요청서를 전달했습니다.</li>
            <li>{md(due)} · 회신 마감</li>
            <li>
              {md(nextDay(due))} 오전 9시 · 비교표 공개. 모든 기관이 회신하면 더
              빨리 열립니다.
            </li>
          </ol>
        ) : !rfq.started_at ? (
          <div>
            <p>
              {missing.length
                ? "첨부 일부가 올라가지 않아 아직 기관에 보내지 않았습니다. 아래에서 다시 올리거나, 지금 있는 첨부로 바로 보낼 수 있습니다."
                : "기관에 보내는 중 문제가 생겼습니다. 다시 보내 주세요."}
            </p>
            <StartNow no={rfq.rfq_no} />
          </div>
        ) : (
          <p>
            요청 분야에 바로 맞는 참여 기관이 없어 운영자가 직접 전달 기관을
            정하고 있습니다. 보통 영업일 1~2일 안에 결과를 알려 드립니다.
          </p>
        )}
        <p className="fld__help">
          그 사이에 하실 일은 없습니다. 첫 견적이 도착할 때와 비교표가 열릴 때
          메일로 알려 드립니다.
        </p>
        {needsCda(rfq.confidentiality) && (
          <p className="fld__help">
            기관에는 시험 개요만 먼저 전달했습니다. 첨부는 CDA 체결을 확인한
            기관에만 공개됩니다.
          </p>
        )}
      </section>
      {missing.length > 0 && (
        <section className="note note--warn" style={{ display: "block" }}>
          <b>올라가지 않은 첨부</b>
          <ul>
            {missing.map((f) => (
              <li key={f.id}>{f.file_name}</li>
            ))}
          </ul>
          <p className="fld__help">
            다시 올리면 요청을 받은 기관에 함께 알려 드립니다.
          </p>
          <AttachmentRetry no={no} />
        </section>
      )}
      <Link href={`/app/r/${no}`} className="b1 blg">
        요청 진행 보기
      </Link>
      <Link href="/app" className="b2">
        내 견적 요청
      </Link>
    </div>
  );
}
