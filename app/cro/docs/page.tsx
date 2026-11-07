import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { listDocs } from "@/lib/quote-doc-db";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { ymd } from "@/lib/format";
import "@/components/cro/quote/quote.css";

export const dynamic = "force-dynamic";

/** 견적서 목록 (0036). 단추 요청 회신용과 단추 밖 의뢰자용을 함께 둔다 */
export default async function CroDocs() {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  const list = dbReady() ? await listDocs(org.id) : [];
  return (
    <>
      <div className="ph">
        <div>
          <h1>견적서</h1>
          <p>시험 목록의 표준가로 견적서를 채우고, 설계가 달라진 곳만 추가 비용으로 계산해요. 표지 · 견적서 · 시험 상세 설명 · 일정표 4부를 PDF와 엑셀로 내려받아요.</p>
        </div>
        <div className="ph__actions">
          <Link href="/cro/docs/style" className="b2 bsm">견적서 양식</Link>
          <Link href="/cro/catalog" className="b2 bsm">시험 목록</Link>
          <Link href="/cro/docs/new" className="b1 bsm">새 견적서</Link>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <b>아직 만든 견적서가 없어요</b>
          견적 진행의 회신 화면에서 &quot;견적서 만들기&quot;를 누르거나, 단추 밖 의뢰자에게 보낼 견적서를 새로 만들어요.
          <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/cro/docs/new" className="b1 bsm">새 견적서</Link>
            <Link href="/cro/catalog" className="b2 bsm">표준가 먼저 정하기</Link>
          </div>
        </div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl tbl--stack qlist">
            <thead><tr><th>견적번호</th><th>견적서</th><th>의뢰자</th><th className="r">공급가액</th><th>수정일</th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td data-label="견적번호" className="tnum"><Link href={`/cro/docs/${d.id}`}>{d.docNo}</Link></td>
                  <td data-label="견적서"><Link href={`/cro/docs/${d.id}`} className="qlist__title">{d.title || "견적서"}</Link><small>시험 {d.tests}건{d.rfqNo ? ` · 단추 요청 ${d.rfqNo}` : ""}</small></td>
                  <td data-label="의뢰자">{d.client || "-"}</td>
                  <td data-label="공급가액" className="r tnum">{d.supply.toLocaleString("ko-KR")}원</td>
                  <td data-label="수정일" className="tnum">{ymd(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
