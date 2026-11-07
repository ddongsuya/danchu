import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImportFlow } from "@/components/cro/crm/ImportFlow";
import { Frame } from "../frame";
import { CPATHS, ME, previewCtx, previewEnabled } from "../fixtures";
import "@/components/cro/crm/crm.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "엑셀 가져오기 검토 · 단추", robots: { index: false, follow: false } };

export default function CrmImportPreview() {
  if (!previewEnabled()) notFound();
  const { data } = previewCtx();
  return (
    <Frame>
      <div className="cx">
        <header className="cx-ph"><div><h1>엑셀 가져오기</h1><p className="cx-ph__sub">지금 쓰는 고객·안건 엑셀을 한 번에 옮겨요. 열 이름을 보고 칸을 맞추고, 확인할 것만 노랗게 남겨요.</p></div></header>
        <ImportFlow companies={data.companies.map((c) => ({ id: c.id, name: c.name, aliases: c.aliases, biz_no: c.biz_no }))} members={data.members} me={ME} paths={{ deals: CPATHS.deals, clients: CPATHS.clients }} />
      </div>
    </Frame>
  );
}
