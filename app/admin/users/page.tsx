import { requireSession } from "@/lib/auth";
import { dbReady, listCroOrgs, listProfiles } from "@/lib/data";
import { UserRow } from "@/components/admin/UserRow";

export const dynamic = "force-dynamic";

export default async function AdminUsers() {
  const s = await requireSession("admin");
  const [users, orgs] = dbReady() ? await Promise.all([listProfiles(), listCroOrgs()]) : [[], []];
  return (
    <>
      <div className="ph">
        <div>
          <h1>사용자</h1>
          <p>의뢰자 {users.filter((u) => u.role === "requester").length} · CRO {users.filter((u) => u.role === "cro").length} · 운영자 {users.filter((u) => u.role === "admin").length}</p>
        </div>
      </div>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>이름 · 이메일</th><th>회사 · 기관</th><th>역할</th><th>CRO 기관 연결</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} self={u.id === s.userId} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
