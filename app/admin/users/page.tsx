import { requireSession } from "@/lib/auth";
import { dbReady, listCroOrgs, listProfiles } from "@/lib/data";
import { UserRow } from "@/components/admin/UserRow";
import { SearchBox } from "@/components/admin/SearchBox";
import { Pager } from "@/components/admin/Pager";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const s = await requireSession("admin");
  const { q = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const [{ list: users, hasMore }, orgs] = dbReady() ? await Promise.all([listProfiles(q || undefined, page), listCroOrgs()]) : [{ list: [], hasMore: false }, []];
  return (
    <>
      <div className="ph">
        <div>
          <h1>사용자</h1>
          <p>이 페이지: 의뢰자 {users.filter((u) => u.role === "requester").length} · CRO {users.filter((u) => u.role === "cro").length} · 운영자 {users.filter((u) => u.role === "admin").length}</p>
        </div>
        <div className="ph__actions"><SearchBox q={q} placeholder="이메일 · 이름 · 회사" /></div>
      </div>
      {users.length === 0 ? (
        q
          ? <EmptyState kind="filtered" title={`"${q}"에 맞는 사용자가 없습니다`} clearHref="/admin/users">이메일, 이름, 회사 중 하나로 다시 찾아 주세요.</EmptyState>
          : <EmptyState title="사용자가 없습니다">가입한 계정이 여기에 나타납니다.</EmptyState>
      ) : (
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>이름 · 이메일</th><th>회사 · 기관</th><th>역할</th><th>기관 연결</th><th><span className="sr-only">저장</span></th><th><span className="sr-only">삭제</span></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} self={u.id === s.userId} />
            ))}
          </tbody>
        </table>
      </div>
      )}
      <Pager page={page} hasMore={hasMore} href={(p) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`} />
    </>
  );
}
