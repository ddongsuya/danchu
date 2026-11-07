import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { ImportFlow } from "@/components/cro/crm/ImportFlow";
import { loadCtx } from "@/components/cro/crm/load";
import "@/components/cro/crm/crm.css";

export const dynamic = "force-dynamic";

/** 엑셀 가져오기 (시안 v5 6번) */
export default async function CroImport() {
  const s = await requireSession("cro");
  const got = await loadCtx(s);
  if (!got) return <><div className="ph"><div><h1>엑셀 가져오기</h1></div></div><PendingOrg org={s.org} pendingOrg={s.pendingOrg} /></>;
  const { data, paths, me } = got.c;
  return (
    <div className="cx">
      <header className="cx-ph">
        <div>
          <h1>엑셀 가져오기</h1>
          <p className="cx-ph__sub">지금 쓰는 고객·안건 엑셀을 한 번에 옮겨요. 열 이름을 보고 칸을 맞추고, 확인할 것만 노랗게 남겨요.</p>
        </div>
        <div className="cx-ph__acts"><Link href={paths.deals} className="btxt">취소</Link></div>
      </header>
      <ImportFlow
        companies={data.companies.map((c) => ({ id: c.id, name: c.name, aliases: c.aliases, biz_no: c.biz_no }))}
        members={data.members} me={me} paths={{ deals: paths.deals, clients: paths.clients }}
      />
    </div>
  );
}
