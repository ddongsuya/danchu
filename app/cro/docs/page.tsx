import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { listDocs } from "@/lib/quote-doc-db";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { mmdd } from "@/lib/format";
import "@/components/cro/quote/quote.css";
import "@/components/cro/layout-quote.css";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

/** 견적서 목록 (0036). 단추 요청 회신용과 단추 밖 의뢰자용을 함께 둔다 */
export default async function CroDocs({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim().slice(0, 60) : "";
  const all = dbReady() ? await listDocs(org.id) : [];
  // 검색은 견적번호 · 의뢰자 · 제목 · 단추 요청 번호 (시안 검토판 c-docs)
  const needle = q.toLowerCase();
  const list = needle ? all.filter((d) => `${d.docNo} ${d.client} ${d.title} ${d.rfqNo ?? ""}`.toLowerCase().includes(needle)) : all;
  return (
    <>
      <div className="ph">
        <div>
          <h1>견적서</h1>
        </div>
        <div className="ph__actions">
          {all.length > 0 && (
            <form action="/cro/docs" role="search" className="qlist__search">
              <input name="q" defaultValue={q} className="inp" placeholder="견적번호·의뢰자" aria-label="견적번호·의뢰자 검색" />
            </form>
          )}
          <Link href="/cro/docs/style" className="b2 bsm">견적서 양식</Link>
          <Link href="/cro/docs/new" className="b1 bsm">새 견적서</Link>
        </div>
      </div>
      {all.length === 0 ? (
        <EmptyState title="아직 견적서가 없어요" action={<Link href="/cro/docs/new" className="b1 bsm">새 견적서</Link>} />
      ) : list.length === 0 ? (
        <EmptyState kind="filtered" title={`'${q}'와 맞는 견적서가 없어요`} action={<Link href="/cro/docs" className="b2 bsm">검색 지우기</Link>} />
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
                  <td data-label="공급가액" className="r tnum">{d.supply.toLocaleString("ko-KR")}</td>
                  <td data-label="수정일" className="tnum">{mmdd(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
