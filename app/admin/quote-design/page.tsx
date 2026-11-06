import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { listDesignRequests } from "@/lib/quote-doc-db";
import { ymd } from "@/lib/format";
import { DesignRequestRow } from "@/components/admin/DesignRequestRow";

export const dynamic = "force-dynamic";

/** 운영자: 기관의 견적서 양식 제작 요청 (0036). 첨부를 내려받아 양식을 만들고 단계를 바꾼다 */
export default async function AdminQuoteDesign() {
  await requireSession("admin");
  const list = dbReady() ? await listDesignRequests(null) : [];
  const ids = [...new Set(list.map((r) => r.orgId))];
  const { data: orgs } = ids.length ? await getSupabaseAdmin()!.from("cro_orgs").select("id, name").in("id", ids) : { data: [] as { id: string; name: string }[] };
  const name = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  return (
    <>
      <div className="ph">
        <div>
          <h1>견적서 양식 요청</h1>
          <p>기관이 올린 견적서 파일로 양식을 만들고 단계를 바꿔요. 답은 기관의 견적서 양식 화면에 보여요.</p>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="empty"><b>받은 요청이 없어요</b>기관이 견적서 양식 화면에서 제작을 요청하면 여기에 쌓여요.</div>
      ) : (
        <div className="card card--rows">
          {list.map((r) => (
            <DesignRequestRow key={r.id} id={r.id} org={name.get(r.orgId) ?? "기관"} date={ymd(r.createdAt)} status={r.status} note={r.note} reply={r.reply} files={r.files.map((f) => ({ name: f.name, size: f.size }))} />
          ))}
        </div>
      )}
    </>
  );
}
