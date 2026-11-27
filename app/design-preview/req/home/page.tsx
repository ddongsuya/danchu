import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReqHome } from "@/components/app/ReqHome";
import { homeChecks } from "@/lib/home-checks";
import { md, todaySeoul } from "@/lib/format";
import { previewEnabled } from "../../cro-crm/fixtures";
import { ReqFrame } from "../frame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "의뢰자 홈 검토 · 단추", robots: { index: false, follow: false } };

/** 의뢰자 홈 검토 (예시 데이터). ?empty=1 첫 요청 전 · ?clear=1 확인할 것 없음 */
export default async function HomePreview({ searchParams }: { searchParams: Promise<{ empty?: string; clear?: string }> }) {
  if (!previewEnabled()) notFound();
  const { empty, clear } = await searchParams;
  const today = todaySeoul();
  const past = new Date(Date.now() - 19 * 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const list = [
    { rfq_no: "DEMO-0003", substance: "예시 물질 · 용량결정(DRF) 2주", status: "contracting", reply_by: past, compared_at: past, joined: 2, sent: 3, submitted: 2 },
    { rfq_no: "DEMO-0007", substance: "예시 물질 · 종양 효력 CT26", status: "distributed", reply_by: past, compared_at: null, joined: 0, sent: 3, submitted: 0 },
  ];
  const awards = [{ rfq_no: "DEMO-0003", cro_name: "예시 기관 B", contract_status: "signed", contract_reported_at: new Date(Date.now() - 5 * 864e5).toISOString(), contract_confirm_due_at: new Date(Date.now() + 2 * 864e5).toISOString(), confirmed: false, disputed: false }];
  return (
    <ReqFrame path="/app" empty={empty === "1"}>
      <ReqHome checks={empty || clear ? [] : homeChecks(list, awards, today, md)} first={empty === "1"} />
    </ReqFrame>
  );
}
