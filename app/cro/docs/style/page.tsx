import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { listDesignRequests, listDocs, loadDoc, loadStyle } from "@/lib/quote-doc-db";
import { addDays, blankTest, DEFAULT_VISIBLE, nextDocNo, type DocData, type DocHead } from "@/lib/quote-doc";
import { todaySeoul } from "@/lib/format";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { featureError } from "@/lib/plan-usage";
import { StyleEditor } from "@/components/cro/quote/StyleEditor";
import "@/components/cro/quote/quote.css";

export const dynamic = "force-dynamic";

/** 견적서 양식 (0036): 로고·브랜드 색·공급자 정보·거래 조건 기본 문구 + 양식 제작 요청 */
export default async function QuoteStylePage() {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  const ready = dbReady();
  const [style, docs, reqs] = ready ? await Promise.all([loadStyle(org.id, org.name), listDocs(org.id), listDesignRequests(org.id)]) : [await loadStyle(org.id, org.name), [], []];
  const latest = docs[0] ? await loadDoc(org.id, docs[0].id) : null;
  const today = todaySeoul();
  const placeholder: { head: DocHead; data: DocData } = {
    head: { id: "preview", docNo: nextDocNo(today, []), title: "시험 이름", client: "의뢰자", substance: "", issuedOn: today, validUntil: addDays(today, 30), inviteId: null, rfqNo: null, memo: "", updatedAt: today },
    data: { tests: [blankTest("시험 이름")], visible: { ...DEFAULT_VISIBLE }, discount: 0, terms: { ...style.terms }, glp: "" },
  };
  return (
    <>
      <div className="ph">
        <div>
          <Link href="/cro/docs" className="crumb">견적서</Link>
          <h1>견적서 양식</h1>
          <p>로고·브랜드 색·공급자 정보를 저장하면 모든 견적서의 PDF와 엑셀에 들어가요.</p>
        </div>
      </div>
      <StyleEditor
        initial={style}
        sample={latest ?? placeholder}
        sampleIsReal={!!latest}
        requests={reqs.map((r) => ({ id: r.id, status: r.status, note: r.note, files: r.files.map((f) => ({ name: f.name, size: f.size })), reply: r.reply, createdAt: r.createdAt }))}
        readOnly={!!s.demo}
        canLayout={!featureError(org, "branding")}
      />
    </>
  );
}
