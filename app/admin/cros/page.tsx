import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listCroOrgs } from "@/lib/data";
import { mmdd } from "@/lib/format";
import { captureError } from "@/lib/observe";
import { SearchBox } from "@/components/admin/SearchBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { ManagedBadge } from "@/components/admin/ManagedBadge";
import { ManagedOrgForm } from "@/components/admin/ManagedOrgForm";
import { FilterChips } from "@/components/admin/Blocks";
import { LoadError } from "@/components/admin/LoadError";
import { particle } from "@/components/admin/act";

export const dynamic = "force-dynamic";

const ST: Record<string, [string, string]> = { pending: ["승인 대기", "pill--warn"], approved: ["참여 중", "pill--ok"], rejected: ["반려", "pill--err"], suspended: ["중지", "pill--err"] };
const TABS: [string, string][] = [["", "전체"], ["pending", "승인 대기"], ["approved", "참여 중"]];

/**
 * 기관 (시안 검토판 a-cros). 제목 줄 탭(전체 · 승인 대기 · 참여 중, 숫자) + 검색 + "기관 추가", 아래 표 하나.
 * 승인 · 반려는 기관 상세에서 확인창으로 한다. 승인 전 기관에는 참여 안내가 가지 않는다.
 */
export default async function AdminCros({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireSession("admin");
  const { status: st = "", q = "" } = await searchParams;
  const status = TABS.some(([k]) => k === st) || ST[st] ? st : "";
  // 탭 숫자를 같이 세려고 검색어로만 한 번 읽고 상태는 여기서 거른다
  const all = dbReady() ? await listCroOrgs(undefined, q || undefined).catch((e: unknown) => { captureError(e, "admin:cros"); return null; }) : [];
  const list = all ? (status ? all.filter((o) => o.status === status) : all) : [];
  const n = (k: string) => (all ?? []).filter((o) => !k || o.status === k).length;
  const href = (k: string, query = q) => {
    const sp = new URLSearchParams({ ...(k ? { status: k } : {}), ...(query ? { q: query } : {}) });
    return sp.size ? `/admin/cros?${sp}` : "/admin/cros";
  };

  return (
    <>
      <div className="ph">
        <div><h1>기관</h1></div>
        <div className="ph__actions"><ManagedOrgForm /></div>
      </div>
      <div className="adm-bar">
        <FilterChips label="기관 상태" items={TABS.map(([k, label]) => ({ href: href(k), label, n: all ? n(k) : undefined, on: status === k }))} />
        <div className="adm-bar__end"><SearchBox q={q} placeholder="기관명 · 대표 이메일 · 사업자번호" keep={{ status }} /></div>
      </div>
      {!all ? (
        <LoadError title="기관 목록을 불러오지 못했어요" />
      ) : list.length === 0 ? (
        q
          ? <EmptyState kind="filtered" title={`'${q}'${particle(q, "과", "와")} 맞는 기관이 없어요`} action={<Link href={href(status, "")} className="b2 bsm">검색 지우기</Link>} />
          : status
            ? <EmptyState kind="filtered" title={`${ST[status]?.[0] ?? "이 상태"} 기관이 없어요`} action={<Link href="/admin/cros" className="b2 bsm">전체 보기</Link>} />
            : <EmptyState title="기관이 없어요" />
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl tbl--stack">
            <thead>
              <tr><th>기관</th><th>상태</th><th>수행 분야</th><th>담당자</th><th className="num">신청일</th><th><span className="sr-only">상세</span></th></tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/cros/${o.id}`} className="strong">{o.name}</Link>{o.managed && <ManagedBadge />}<span className="sub">{o.contact_email}</span></td>
                  <td data-label="상태"><span className={`pill ${ST[o.status][1]}`}>{ST[o.status][0]}</span></td>
                  <td data-label="수행 분야" className="adm-small">{o.categories.join(" · ") || "-"}</td>
                  <td data-label="담당자" className="adm-small">{o.contact_name || "-"}</td>
                  <td className="num tnum" data-label="신청일">{mmdd(o.created_at)}</td>
                  <td className="tbl__act"><Link href={`/admin/cros/${o.id}`} className="b2 bsm">상세</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
