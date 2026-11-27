import { requireSession } from "@/lib/auth";
import { dbReady, listCroOrgs, listProfiles } from "@/lib/data";
import { UserRow } from "@/components/admin/UserRow";
import { SearchBox } from "@/components/admin/SearchBox";
import { Pager } from "@/components/admin/Pager";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadError } from "@/components/admin/LoadError";
import { particle } from "@/components/admin/act";
import { captureError } from "@/lib/observe";

export const dynamic = "force-dynamic";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const s = await requireSession("admin");
  const { q = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  // 못 읽으면 검색칸은 그대로 두고 표 자리에만 알린다 (시안 a-users~err)
  const got = dbReady() ? await Promise.all([listProfiles(q || undefined, page), listCroOrgs()]).catch((e: unknown) => { captureError(e, "admin:users"); return null; }) : ([{ list: [], hasMore: false }, []] as const);
  const [{ list: users, hasMore }, orgs] = got ?? [{ list: [], hasMore: false }, []];
  return (
    <>
      <div className="ph">
        <div>
          <h1>사용자</h1>
        </div>
        <div className="ph__actions"><SearchBox q={q} placeholder="이메일 · 이름 · 회사" /></div>
      </div>
      {!got ? (
        <LoadError title="사용자를 불러오지 못했어요" />
      ) : users.length === 0 ? (
        q
          ? <EmptyState kind="filtered" title={`'${q}'${particle(q, "과", "와")} 맞는 사용자가 없어요`} action={<Link href="/admin/users" className="b2 bsm">검색 지우기</Link>} />
          : <EmptyState title="사용자가 없어요" />
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
