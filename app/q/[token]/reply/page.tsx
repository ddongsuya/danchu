import { notFound, redirect } from "next/navigation";
import { loadQuote } from "@/lib/quote-load";
import { viewerLoadOpts } from "@/lib/auth";
import { ReplyForm } from "@/components/cro/ReplyForm";

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
      {operator && (
        <p className="note note--tint" style={{ marginBottom: 16, flexDirection: "column", gap: 2 }}>
          <b style={{ fontWeight: 600 }}>운영자 대리 입력 · {got.croName}</b>
          <span>기관이 보낸 견적서 PDF를 첨부하고 금액·기간·조건을 PDF 그대로 옮겨 적어 주세요. 제출하면 비교표에 &ldquo;단추 정리 · 기관 PDF 기준&rdquo;으로 표시되고, PDF 원본이 기준 문서로 함께 전달됩니다. 비교표가 열리면 의뢰자에게 그대로 보이므로 PDF와 대조를 마친 뒤 제출해 주세요.</span>
        </p>
      )}
      <ReplyForm token={token} backHref={`/q/${token}`} doneHref={`/q/${token}/reply/done`} />
    </>
  );
}
