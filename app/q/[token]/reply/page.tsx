import { notFound, redirect } from "next/navigation";
import { loadQuote } from "@/lib/quote-load";
import { viewerLoadOpts } from "@/lib/auth";
import { ReplyForm } from "@/components/cro/ReplyForm";
import { Crumb } from "@/components/app/ui";

export const dynamic = "force-dynamic";

export default async function TokenReply({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const opts = await viewerLoadOpts();
  const operator = opts.operator;
  const got = await loadQuote(token, opts);
  if (!got) notFound();
  // 참여 전에는 회신 화면을 열지 않는다. 기관은 요약에서 참여를 결정하고, 운영자는 기관이 참여한 뒤에만 대리 입력한다 (0023)
  if (!got.joined) redirect(`/q/${token}`);
  return (
    <>
      {/* 운영자 대리 입력 (시안 a-offer): 제목 · 요청 번호 · 기준 띠. 기관이 여는 회신 화면은 그대로 */}
      {operator && (
        <>
          <Crumb href={`/admin/r/${got.rfq.no}`} label={`${got.rfq.no} 요청으로`} />
          <div className="ph">
            <div>
              <h1>{got.croName} 견적 대신 입력</h1>
              <p className="tnum">{got.rfq.no} · 기관이 참여한 뒤에만</p>
            </div>
          </div>
          <p className="note note--tint q-note">기관이 메일로 보낸 견적서 PDF 기준 · 기관 열람으로 기록하지 않음</p>
        </>
      )}
      <ReplyForm token={token} backHref={`/q/${token}`} doneHref={`/q/${token}/reply/done`} />
    </>
  );
}
