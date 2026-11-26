import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { defaultReplyBy } from "@/lib/distribute";
import { AttachmentRetry, AttachmentRows } from "@/components/app/AttachmentRetry";
import { StartNow } from "@/components/app/RequestActions";
import { needsCda } from "@/lib/request-policy";
import { mmdd, nextDay, todaySeoul } from "@/lib/format";
export const dynamic = "force-dynamic";

/**
 * 접수 완료 (시안 v7 r-done). 다음 일정 네 줄과 공개 시점 한 줄.
 * 참여 안내를 시작하지 못했으면(started_at 없음) 첫 줄이 오류가 되고 그 줄에서 다시 보낸다 (/api/rfq/[no]/start).
 * 기관별 메일 발송 실패(rfq_invites.mailed_at 없음)는 예약 작업이 다시 보내고, 의뢰자가 다시 보내는 길은 없다.
 */
export default async function Done({
  searchParams,
}: {
  searchParams: Promise<{ no?: string }>;
}) {
  const s = await requireSession("requester");
  const { no } = await searchParams;
  if (!no) notFound();
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin"))
    notFound();
  const d = await getRfqDetail(rfq);
  const missing = d.files.filter((f) => !f.uploaded_at);
  // 참여 안내 여부만 본다. 안내한 기관 수는 이 화면에 보이지 않는다 (0023 참여 방식)
  const offered = !!rfq.distributed_at || d.invites.length > 0;
  const failed = !offered && !rfq.started_at;
  const due = defaultReplyBy(rfq);
  const today = todaySeoul();
  return (
    <div className="stack rq-done">
      <div className="ph">
        <div>
          <h1>요청서를 접수했어요</h1>
          <p>
            접수 번호 <span className="tnum">{rfq.rfq_no}</span> · {rfq.substance}
          </p>
        </div>
      </div>
      <section className="card rq-card" aria-labelledby="next-title">
        <h2 id="next-title" className="rq-card__h">다음 일정</h2>
        <ol className="rq-tl">
          {failed ? (
            <li className="rq-tl__i rq-tl__i--bad">
              <time className="rq-tl__d" dateTime={today}>오늘</time>
              <b>참여 안내를 보내지 못했어요.</b>
              <span><StartNow no={rfq.rfq_no} label="다시 보내기" /></span>
            </li>
          ) : (
            <li className="rq-tl__i">
              <time className="rq-tl__d" dateTime={today}>오늘</time>
              <b>{offered ? "시험 분야가 맞는 기관에 참여 안내를 보냈어요." : "분야가 맞는 기관이 없어 운영자가 안내할 기관을 찾고 있어요."}</b>
            </li>
          )}
          {rfq.join_by && (
            <li className="rq-tl__i rq-tl__i--next">
              <time className="rq-tl__d tnum" dateTime={rfq.join_by}>{mmdd(rfq.join_by)}</time>
              <b>참여 결정 기한</b>
            </li>
          )}
          <li className="rq-tl__i rq-tl__i--next">
            <time className="rq-tl__d tnum" dateTime={due}>{mmdd(due)}</time>
            <b>회신 기한</b>
          </li>
          <li className="rq-tl__i rq-tl__i--next">
            <time className="rq-tl__d tnum" dateTime={nextDay(due)}>{mmdd(nextDay(due))}</time>
            <b>오전 9시 · 비교표 공개. 모두 제출하면 더 빨리 열리고, 열리면 메일로 알려요.</b>
          </li>
        </ol>
        <p className="rq-card__p">기관 이름과 견적은 비교표가 열릴 때 함께 공개돼요.</p>
        {needsCda(rfq.confidentiality) && (
          <p className="rq-card__p">
            기관에는 시험 개요만 먼저 안내했어요. 첨부는 기관별 CDA 체결을
            확인한 뒤 공개하고, 회사명과 담당자 연락처는 선정한 기관에만
            공개해요.
          </p>
        )}
      </section>
      {missing.length > 0 && (
        <section className="card rq-card" aria-labelledby="files-title">
          <h2 id="files-title" className="rq-card__h">첨부</h2>
          <AttachmentRows no={no} canRetry files={d.files.map((f) => ({ id: f.id, name: f.file_name, size: f.size_bytes, uploaded: !!f.uploaded_at }))} />
          <div className="rq-card__more"><AttachmentRetry no={no} /></div>
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
