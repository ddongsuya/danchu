import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { defaultReplyBy } from "@/lib/distribute";
import { AttachmentRetry, AttachmentRows } from "@/components/app/AttachmentRetry";
import { StartNow } from "@/components/app/RequestActions";
import { needsCda } from "@/lib/request-policy";
import { md, nextDay, todaySeoul } from "@/lib/format";
import { eulReul } from "@/lib/josa";
import "@/components/app/story.css";
export const dynamic = "force-dynamic";

/**
 * 접수 완료 (2026-11-27 시안 검토판 r-done). 다음 일정 네 줄(오늘 참여 안내 → 참여 결정 기한 → 회신 기한 → 다음 날 오전 9시 비교표)과 공개 범위 한 문장.
 * - 참여 안내를 시작하지 못했으면(started_at 없음) 첫 줄이 오류가 되고 바로 아래에서 다시 보낸다 (/api/rfq/[no]/start).
 * - 첨부가 덜 올라갔으면 첨부가 모두 올라간 뒤 안내를 보내므로, 다시 올리거나 지금 있는 첨부로 보내게 한다.
 * - 기관별 메일 발송 실패(rfq_invites.mailed_at 없음)는 예약 작업이 다시 보내고, 의뢰자가 다시 보내는 길은 없다.
 */
export default async function Done({ searchParams }: { searchParams: Promise<{ no?: string }> }) {
  const s = await requireSession("requester");
  const { no } = await searchParams;
  if (!no) notFound();
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) notFound();
  const d = await getRfqDetail(rfq);
  const missing = d.files.filter((f) => !f.uploaded_at);
  const offered = !!rfq.distributed_at || d.invites.length > 0;
  const waitFiles = !offered && !rfq.started_at && missing.length > 0;
  const failed = !offered && !rfq.started_at && !waitFiles;
  const due = defaultReplyBy(rfq);
  const today = todaySeoul();
  const first = waitFiles
    ? "첨부가 모두 올라가면 참여 안내를 보내요"
    : failed
      ? "참여 안내를 보내지 못했어요"
      : offered
        ? "시험 분야가 맞는 기관에 참여 안내를 보냈어요."
        : "요청 분야에 맞는 참여 기관이 없어 운영자가 안내할 기관을 확인하고 있어요";

  return (
    <div className="stack rq-done">
      <div className="ph">
        <div>
          <h1>요청서를 접수했어요</h1>
          <p>{rfq.substance} · 접수 번호 <span className="tnum">{rfq.rfq_no}</span></p>
        </div>
      </div>
      {waitFiles && (
        <div className="rq-banner rq-banner--bad" role="alert">
          <p className="rq-banner__t">
            <b>요청서 {eulReul(rfq.rfq_no)} 접수했어요. 첨부 {missing.length}개를 올리지 못했어요: {missing.map((f) => f.file_name).join(", ")}. 다시 올리거나 지금 있는 첨부로 참여 안내를 보낼 수 있어요.</b>
          </p>
          <div className="rq-banner__a">
            <a href="#files" className="b2">첨부 다시 올리기</a>
            <StartNow no={rfq.rfq_no} label="지금 첨부로 보내기" />
          </div>
        </div>
      )}
      <section className="card rq-card" aria-labelledby="next-title">
        <h2 id="next-title" className="rq-card__h">다음 일정</h2>
        <ol className="rq-tl">
          <li className={`rq-tl__i ${failed ? "rq-tl__i--bad" : "rq-tl__i--now"}`}>
            <time className="rq-tl__d" dateTime={today}>오늘</time>
            <b>{first}</b>
          </li>
          {rfq.join_by && (
            <li className="rq-tl__i rq-tl__i--next">
              <time className="rq-tl__d tnum" dateTime={rfq.join_by}>{md(rfq.join_by)}</time>
              <b>참여 결정 기한</b>
            </li>
          )}
          <li className="rq-tl__i rq-tl__i--next">
            <time className="rq-tl__d tnum" dateTime={due}>{md(due)}</time>
            <b>회신 기한</b>
          </li>
          <li className="rq-tl__i rq-tl__i--next">
            <time className="rq-tl__d tnum" dateTime={nextDay(due)}>{md(nextDay(due))} 오전 9시</time>
            <b>비교표 공개. 모두 제출하면 더 빨리 열리고, 열리면 메일로 알려요.</b>
          </li>
        </ol>
        {failed && <div className="rq-card__acts"><StartNow no={rfq.rfq_no} label="다시 보내기" /></div>}
        <p className="rq-card__p">
          {needsCda(rfq.confidentiality)
            ? "참여 안내에는 시험 개요만 담았습니다. 첨부파일은 기관별 CDA 체결을 확인한 뒤 그 기관에 공개하고, 회사명과 담당자 연락처는 선정한 기관에만 공개합니다."
            : "비교표가 열리기 전에는 보낸 기관 수와 열람 · 참여 · 제출한 기관 수만 볼 수 있습니다. 기관 이름과 견적은 비교표가 열릴 때 공개합니다."}
        </p>
      </section>
      {missing.length > 0 && (
        <section id="files" className="card rq-card" aria-labelledby="files-title">
          <h2 id="files-title" className="rq-card__h">첨부</h2>
          <AttachmentRows no={no} canRetry files={d.files.map((f) => ({ id: f.id, name: f.file_name, size: f.size_bytes, uploaded: !!f.uploaded_at }))} />
          <div className="rq-card__more"><AttachmentRetry no={no} /></div>
        </section>
      )}
      <div className="rq-done__acts">
        <Link href="/app" className="b2">내 견적 요청</Link>
        <Link href={`/app/r/${no}`} className="b1">요청 진행 보기</Link>
      </div>
    </div>
  );
}
