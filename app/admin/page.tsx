import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { countBy, dbReady, listAllRequests } from "@/lib/data";
import { STAGES, statusLabel, statusTone } from "@/lib/status";
import { StatusPill } from "@/components/app/ui";
import { md, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const FILTERS: [string, string][] = [["", "전체"], ["received", "접수"], ["distributed", "배포"], ["quoted", "견적 도착"], ["compared", "비교표"], ["selected", "선택"], ["contracting", "계약"], ["closed", "종료"]];

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireSession("admin");
  const { status = "" } = await searchParams;
  if (!dbReady()) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const [list, counts] = await Promise.all([listAllRequests(status || undefined), countBy()]);
  const todo = {
    receive: counts.rfq.received ?? 0,
    quoted: counts.rfq.quoted ?? 0,
    pendingOrg: counts.org.pending ?? 0,
    contracting: counts.rfq.contracting ?? 0,
  };

  return (
    <>
      <div className="ph">
        <div>
          <h1>접수 현황</h1>
          <p>배포 대기 {todo.receive} · 비교표 대기 {todo.quoted} · CRO 승인 대기 {todo.pendingOrg} · 계약 진행 {todo.contracting}</p>
        </div>
      </div>

      <div className="tiles4" style={{ marginBottom: 20 }}>
        {[
          ["배포 대기", todo.receive, "/admin?status=received"],
          ["비교표 대기", todo.quoted, "/admin?status=quoted"],
          ["CRO 승인 대기", todo.pendingOrg, "/admin/cros?status=pending"],
          ["계약 진행", todo.contracting, "/admin/awards"],
        ].map(([label, n, href]) => (
          <Link key={String(label)} href={String(href)} className="card tile card--link">
            <span>{label}</span>
            <span className="tnum" style={{ color: Number(n) ? "var(--brand)" : undefined }}>{n}</span>
          </Link>
        ))}
      </div>

      <div className="seg" style={{ marginBottom: 14, flexWrap: "wrap", height: "auto" }}>
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={k ? `/admin?status=${k}` : "/admin"} role="button" aria-pressed={status === k} style={{ height: 36, display: "inline-flex", alignItems: "center", padding: "0 14px", fontSize: 14, background: status === k ? "var(--ink)" : "var(--wh)", color: status === k ? "var(--wh)" : "var(--ink)", fontWeight: status === k ? 600 : 400 }}>
            {label}{k ? ` ${counts.rfq[k] ?? 0}` : ""}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="empty"><b>요청이 없습니다</b></div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl">
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
                  <td><Link href={`/admin/r/${r.rfq_no}`} className="tnum" style={{ fontWeight: 700 }}>{r.rfq_no}</Link></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.company}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.contact_name} · {r.email}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.substance}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.categories.join(" · ")}{r.confidentiality?.startsWith("CDA") ? " · CDA" : ""}</div>
                  </td>
                  <td><StatusPill tone={statusTone(r.status)}>{statusLabel(r.status)}</StatusPill></td>
                  <td className="tnum">{r.invites ? `${r.submitted}/${r.invites}` : "—"}</td>
                  <td className="tnum">{r.reply_by ? md(r.reply_by) : "—"}</td>
                  <td className="tnum">{ymd(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>단계: {STAGES.map((s) => s.label).join(" → ")}</p>
    </>
  );
}
