import { needsCda, confidentialAccess } from "@/lib/request-policy";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { countBy, dbReady, listAllRequests } from "@/lib/data";
import { STAGES, statusLabel, statusTone } from "@/lib/status";
import { StatusPill } from "@/components/app/ui";
import { dday, md, ymd } from "@/lib/format";
import { missingProdEnv } from "@/lib/env";
import { readSchemaStatus } from "@/lib/schema-version";
import { sentryEnabled } from "@/lib/observe";
import { SearchBox } from "@/components/admin/SearchBox";
import { Pager } from "@/components/admin/Pager";
import { OptInTransition, type TransitionRow } from "@/components/admin/OptInTransition";
import { planOptInTransition } from "@/lib/opt-in-transition";
import { getSupabaseAdmin } from "@/lib/supabase";
import { todaySeoul } from "@/lib/format";
import { captureError } from "@/lib/observe";

export const dynamic = "force-dynamic";

// 필터 이름은 진행 단계 이름(lib/status.ts STAGES)과 같게. 끝에 "기한 지남"은 운영자가 정리할 요청
const FILTERS: [string, string][] = [["", "전체"], ["received", "접수"], ["distributed", "참여 안내"], ["quoted", "견적 도착"], ["compared", "비교표 공개"], ["selected", "기관 선택"], ["contracting", "계약 진행"], ["closed", "종료"], ["cancelled", "취소"], ["overdue", "기한 지남"]];

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireSession("admin");
  const { status = "", q = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  if (!dbReady()) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const [{ list, hasMore }, counts, schema] = await Promise.all([listAllRequests(status || undefined, q || undefined, page), countBy(), readSchemaStatus()]);
  const href = (p: number) => `/admin?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;
  const transition = schema.ok ? await transitionRows() : [];
  const missingEnv = missingProdEnv();
  const noSentry = process.env.NODE_ENV === "production" && !sentryEnabled();
  const todo = {
    receive: counts.rfq.received ?? 0,
    quoted: counts.rfq.quoted ?? 0,
    pendingOrg: counts.org.pending ?? 0,
    contracting: counts.rfq.contracting ?? 0,
    overdue: counts.overdue,
  };

  return (
    <>
      {(missingEnv.length > 0 || noSentry || !schema.ok) && (
        <div className="note note--warn" role="alert" style={{ marginBottom: 16 }}>
          <b>운영 설정 확인</b>
          {!schema.ok && <div>{schema.message} 배포(기관에 요청 보내기)가 멈춰 있습니다. README의 배포 순서대로 마이그레이션을 적용한 뒤 npm run check:schema 로 확인해 주세요.</div>}
          {missingEnv.length > 0 && <div>환경변수 누락: {missingEnv.join(", ")}. 접수·메일·예약 작업이 제대로 동작하지 않습니다. Vercel → Settings → Environment Variables 에 넣고 다시 배포해 주세요.</div>}
          {noSentry && <div>오류 모니터링(SENTRY_DSN)이 꺼져 있습니다. 서버 오류가 어디에도 기록되지 않습니다.</div>}
        </div>
      )}
      {transition.length > 0 && <OptInTransition rows={transition} />}
      <div className="ph">
        <div>
          <h1>접수 현황</h1>
        </div>
      </div>

      {/* 아래 숫자 칸이 곧 할 일 목록이라 같은 숫자를 위 설명 줄에 되풀이하지 않는다 */}
      <div className="tiles4" style={{ marginBottom: 20 }}>
        {[
          ["안내 전 접수", todo.receive, "/admin?status=received"],
          ["기한 지남 · 정리 필요", todo.overdue, "/admin?status=overdue"],
          ["기관 승인 대기", todo.pendingOrg, "/admin/cros?status=pending"],
          ["계약 진행", todo.contracting, "/admin/awards"],
        ].map(([label, n, href]) => (
          <Link key={String(label)} href={String(href)} className="card tile card--link">
            <span>{label}</span>
            <span className="tnum" style={{ color: Number(n) ? "var(--brand)" : undefined }}>{n}</span>
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
      <div className="seg" style={{ flexWrap: "wrap", height: "auto" }}>
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={k ? `/admin?status=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}` : q ? `/admin?q=${encodeURIComponent(q)}` : "/admin"} role="button" aria-pressed={status === k} style={{ height: 36, display: "inline-flex", alignItems: "center", padding: "0 14px", fontSize: 14, background: status === k ? "var(--ink)" : "var(--wh)", color: status === k ? "var(--wh)" : "var(--ink)", fontWeight: status === k ? 600 : 400 }}>
            {label}{k ? ` ${k === "overdue" ? counts.overdue : counts.rfq[k] ?? 0}` : ""}
          </Link>
        ))}
      </div>
      <SearchBox q={q} placeholder="번호 · 회사 · 시험물질 · 이메일" keep={{ status }} />
      </div>

      {list.length === 0 ? (
        <div className="empty"><b>{q ? `"${q}"에 맞는 요청이 없습니다` : "요청이 없습니다"}</b></div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl tbl--stack">
            <thead>
              <tr>
                <th>번호</th>
                <th>의뢰자</th>
                <th>시험물질 · 항목</th>
                <th>상태</th>
                <th>회신</th>
                <th>회신 기한</th>
                <th>접수일</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}><Link href={`/admin/r/${r.rfq_no}`} className="tnum" style={{ fontWeight: 700 }}>{r.rfq_no}</Link></td>
                  <td data-label="의뢰자">
                    <div style={{ fontWeight: 600 }}>{r.company}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.contact_name} · {r.email}</div>
                  </td>
                  <td data-label="시험물질 · 항목">
                    <div style={{ fontWeight: 600 }}>{r.substance}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.categories.join(" · ")}{needsCda(r.confidentiality) ? " · CDA" : ""}</div>
                  </td>
                  <td data-label="상태"><StatusPill tone={statusTone(r.status)}>{statusLabel(r.status, r.outcome)}</StatusPill></td>
                  <td className="tnum" data-label="회신">{r.invites ? `${r.submitted}/${r.invites}` : "-"}</td>
                  <td className="tnum" data-label="회신 기한" style={{ whiteSpace: "nowrap" }}>
                    {r.reply_by ? md(r.reply_by) : "-"}
                    {r.reply_by && ["received", "distributed", "quoted"].includes(r.status) && dday(r.reply_by).n < 0 && <div style={{ fontSize: 12, color: "var(--err)" }}>기한 지남</div>}
                  </td>
                  <td className="tnum" data-label="접수일">{ymd(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} hasMore={hasMore} href={href} />
      <p style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>단계: {STAGES.map((s) => s.label).join(" → ")}</p>
    </>
  );
}

/** 참여 선택형 전환이 남은 열린 요청 (0023 적용 뒤 한 번 실행, lib/opt-in-transition.ts). 읽지 못하면 카드를 숨기고 오류만 남긴다 */
async function transitionRows(): Promise<TransitionRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const plan = await planOptInTransition(sb, todaySeoul());
    return plan.requests.map((r) => ({ rfqNo: r.rfqNo, replyBy: r.replyBy, joinBy: new Date(r.joinBy).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }), offers: r.offers.map((o) => o.croName) }));
  } catch (e) {
    captureError(e, "admin:opt-in-transition");
    return [];
  }
}
