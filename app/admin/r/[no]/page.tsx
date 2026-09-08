import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, listCroOrgs } from "@/lib/data";
import { INVITE_LABEL, statusLabel, statusTone } from "@/lib/status";
import { Crumb, StatusPill } from "@/components/app/ui";
import { DistributePanel } from "@/components/admin/DistributePanel";
import { AdminActions } from "@/components/admin/AdminActions";
import { labelMap } from "@/lib/rfq-schema";
import { quoteRowsFromPayload } from "@/lib/quote-items";
import { addBusinessDays, nowSeoul } from "@/lib/dates";
import { md, mdhm, won, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminRfq({ params }: { params: Promise<{ no: string }> }) {
  await requireSession("admin");
  const { no } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq) notFound();
  const [d, orgs] = await Promise.all([getRfqDetail(rfq), listCroOrgs("approved")]);
  const p = rfq.payload;
  const labels = labelMap();
  const submitted = d.invites.filter((i) => i.status === "submitted");
  const defaultReplyBy = rfq.reply_by || addBusinessDays(nowSeoul(), 7).toLocaleDateString("sv-SE");
  const invitedOrgIds = new Set(d.invites.map((i) => i.cro_org_id).filter(Boolean));
  const rows = quoteRowsFromPayload(p);

  return (
    <>
      <Crumb href="/admin" label="접수 현황" />
      <div className="ph">
        <div>
          <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>{rfq.rfq_no} · 접수 {ymd(rfq.created_at)}</span>
          <h1>{rfq.substance} · {rfq.company}</h1>
          <p>{rfq.categories.join(" · ")} · {rfq.purpose ?? "—"} · {rfq.confidentiality ?? "일반"} · CRO {rfq.cro_count ?? "—"}</p>
          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <StatusPill tone={statusTone(rfq.status)}>{statusLabel(rfq.status)}</StatusPill>
            {rfq.submitted_step === 2 && <span className="tag">상세 입력</span>}
            {d.files.length > 0 && <span className="tag">첨부 {d.files.length}</span>}
          </div>
        </div>
        <div className="ph__actions">
          <Link href={`/app/r/${rfq.rfq_no}`} className="b2 bsm">의뢰자 화면으로 보기</Link>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>배포</h2>
            {rfq.status === "cancelled" || rfq.status === "closed" ? (
              <p style={{ fontSize: 14, color: "var(--muted)" }}>종료된 요청입니다.</p>
            ) : (
              <DistributePanel
                no={rfq.rfq_no}
                categories={rfq.categories}
                defaultReplyBy={defaultReplyBy}
                orgs={orgs.map((o) => ({ id: o.id, name: o.name, categories: o.categories, glp: o.glp_certs, email: o.contact_email, members: o.members, invited: invitedOrgIds.has(o.id) }))}
              />
            )}
          </div>

          <div className="card card--pad">
            <div className="sec-title" style={{ margin: "0 0 10px" }}>
              <h2>회신 현황 {submitted.length}/{d.invites.length}</h2>
              <span>{rfq.reply_by ? `기한 ${md(rfq.reply_by)}` : ""}</span>
            </div>
            {d.invites.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--muted)" }}>아직 배포하지 않았습니다.</p>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl" style={{ minWidth: 520 }}>
                  <thead>
                    <tr><th>CRO</th><th>상태</th><th>열람</th><th>총액 · 기간</th><th>링크</th></tr>
                  </thead>
                  <tbody>
                    {d.invites.map((i) => {
                      const q = d.quotes.find((x) => x.invite_id === i.id);
                      return (
                        <tr key={i.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{i.cro_name}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>{i.cro_email} · 기한 {i.reply_by}</div>
                          </td>
                          <td>
                            <span className={`pill ${i.status === "submitted" ? "pill--ok" : i.status === "declined" ? "pill--err" : i.status === "draft" ? "pill--warn" : "pill--sf"}`}>{INVITE_LABEL[i.status] ?? i.status}</span>
                            {i.decline_reason && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{i.decline_reason}</div>}
                          </td>
                          <td className="tnum" style={{ fontSize: 12 }}>{i.opened_at ? mdhm(i.opened_at) : "—"}</td>
                          <td className="tnum">{q?.status === "submitted" ? `${won(q.total_amount ?? 0)} · ${q.total_weeks ?? "—"}주` : "—"}{q?.pdf_path && <> · <a href={`/api/quotes/${q.id}/pdf`}>PDF</a></>}</td>
                          <td><a href={`/q/${i.token}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>회신 링크</a></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>진행 관리</h2>
            <AdminActions
              no={rfq.rfq_no}
              status={rfq.status}
              submitted={submitted.length}
              compared={!!rfq.compared_at}
              note={rfq.admin_note ?? ""}
              award={d.award ? { cro: d.award.cro_name, at: ymd(d.award.awarded_at), contract: d.award.contract_reported_at ? `${d.award.contract_date} · ${won(d.award.contract_amount ?? 0)}` : "" } : null}
            />
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card card--rows">
            <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>의뢰자</div>
            {[["회사", rfq.company], ["담당자", `${rfq.contact_name}${p.dept ? ` · ${p.dept}` : ""}`], ["이메일", rfq.email], ["전화", rfq.phone ?? "—"], ["기관 유형", rfq.org_type ?? "—"], ["계정", rfq.user_id ? "연결됨" : "미가입"]].map(([k, v]) => (
              <div key={k} className="kv"><span className="kv__k">{k}</span><span className="kv__v">{v}</span></div>
            ))}
          </div>

          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>회신 표 행 {rows.length}</h2>
            <div className="stack" style={{ gap: 6 }}>
              {rows.map((r) => (
                <div key={r.seq} style={{ padding: "8px 12px", background: "var(--sf)", borderRadius: 10, fontSize: 13 }}>
                  <b style={{ fontWeight: 600 }}>{r.name}</b> <span style={{ color: "var(--brand)" }}>{r.category}</span>
                  {r.cond && <div style={{ color: "var(--muted)" }}>{r.cond}</div>}
                </div>
              ))}
            </div>
          </div>

          {d.files.length > 0 && (
            <div className="card card--rows">
              <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>첨부</div>
              {d.files.map((f) => (
                <div key={f.id} className="kv"><a href={`/api/files/${f.id}`}>{f.file_name}</a><span className="tnum" style={{ fontSize: 12, color: "var(--muted)" }}>{(f.size_bytes / 1024 / 1024).toFixed(1)}MB</span></div>
              ))}
            </div>
          )}

          <details className="card" style={{ padding: "0 18px" }}>
            <summary style={{ padding: "14px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>입력한 전체 항목</summary>
            <div className="card--rows" style={{ padding: "0 0 8px" }}>
              {Object.entries(labels)
                .filter(([id]) => { const v = p[id]; return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v; })
                .map(([id, label]) => (
                  <div key={id} className="kv" style={{ fontSize: 13 }}>
                    <span className="kv__k">{label}</span>
                    <span className="kv__v" style={{ fontWeight: 500 }}>{Array.isArray(p[id]) ? (p[id] as string[]).join(", ") : String(p[id])}</span>
                  </div>
                ))}
            </div>
          </details>

          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>이력</h2>
            <div className="stack" style={{ gap: 8 }}>
              {d.events.length === 0 && <span style={{ fontSize: 13, color: "var(--muted)" }}>없음</span>}
              {[...d.events].reverse().map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                  <span><b style={{ fontWeight: 600 }}>{e.title}</b>{e.body ? <span style={{ color: "var(--muted)" }}> · {e.body}</span> : null}</span>
                  <span className="tnum" style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{mdhm(e.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
