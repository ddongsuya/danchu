import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { loadDoc, loadStyle } from "@/lib/quote-doc-db";
import { DocPages } from "@/components/cro/quote/DocPages";
import { PrintButton } from "@/components/cro/PrintButton";
import "@/components/cro/quote/quote.css";

export const dynamic = "force-dynamic";

/** 견적서 4부 PDF 저장 화면. 인쇄 대화상자에서 "PDF로 저장"을 고른다 (메뉴는 인쇄에서 숨는다, quote.css @media print) */
export default async function DocPrint({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession("cro");
  if (!s.org || !dbReady()) notFound();
  const { id } = await params;
  const got = await loadDoc(s.org.id, id);
  if (!got) notFound();
  const style = await loadStyle(s.org.id, s.org.name);
  return (
    <div className="qprint">
      <div className="ph noprint">
        <div>
          <Link href={`/cro/docs/${id}`} className="crumb">견적서 편집으로</Link>
          <h1>{got.head.docNo} PDF</h1>
          <p>인쇄 창에서 대상을 &quot;PDF로 저장&quot;으로 고르세요. 용지는 A4, 여백은 없음으로 두면 화면과 같아요.</p>
        </div>
        <div className="ph__actions">
          <a className="b2 bsm" href={`/api/cro/docs/${id}/xlsx`}>엑셀</a>
          <PrintButton />
        </div>
      </div>
      <DocPages head={got.head} data={got.data} style={style} />
    </div>
  );
}
