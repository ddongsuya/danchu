import { AttachmentRetry } from "@/components/app/AttachmentRetry";
import { OutcomeForm } from "@/components/app/OutcomeForm";
import { needsCda, confidentialAccess } from "@/lib/request-policy";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { STAGES, stageIndex, statusLabel, statusTone, INVITE_LABEL } from "@/lib/status";
import { CheckMark, Crumb, StatusPill } from "@/components/app/ui";
import { md, mdhm, ymd } from "@/lib/format";
import { labelMap } from "@/lib/rfq-schema";

export const dynamic = "force-dynamic";

export default async function RequestDetail({ params }: { params: Promise<{ no: string }> }) {
  const s = await requireSession("requester");
  const { no } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin")) notFound();
  const d = await getRfqDetail(rfq);
  const idx = stageIndex(rfq.status);
  const submitted = d.invites.filter((i) => i.status === "submitted").length;
  const canCompare = !!rfq.compared_at && submitted > 0;
  const p = rfq.payload;
  const labels = labelMap();
  const chips = [
    ...(Array.isArray(p.authority) ? (p.authority as string[]) : []),
    rfq.cro_count ? `CRO ${rfq.cro_count}` : "",
    needsCda(rfq.confidentiality) ? "CDA 필요" : "",
  ].filter(Boolean);

  // 진행 이력: 상태 단계 + 이벤트 시각
  const eventAt = (kind: string) => d.events.filter((e) => e.kind === kind).at(-1)?.created_at;
  const whenOf: Record<string, string | undefined> = {
    received: rfq.created_at,
    distributed: rfq.distributed_at ?? eventAt("distributed"),
    quoted: eventAt("quote_submitted"),
    compared: rfq.compared_at ?? undefined,
    selected: d.award?.awarded_at,
    contracting: d.award?.contract_reported_at ?? undefined,
    closed: rfq.closed_at ?? undefined,
  };

  return (
    <>
      <Crumb href="/app" label="내 요청" />
      <div className="ph">
        <div>
          <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", letterSpacing: ".04em" }}>{rfq.rfq_no}</span>
          <h1>{rfq.substance}</h1>
          <p>{rfq.categories.join(" · ")}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <StatusPill tone={statusTone(rfq.status)}>{statusLabel(rfq.status)}</StatusPill>
            {chips.map((c) => (
              <span key={c} className="tag">{c}</span>
            ))}
          </div>
        </div>
        <div className="ph__actions"><Link href={`/app/support?rfq=${rfq.rfq_no}`} className="b2">이 요청 문의하기</Link>
          {canCompare && <Link href={`/app/r/${rfq.rfq_no}/compare`} className="b1">견적 {submitted}건 비교</Link>}
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card" style={{ padding: "20px 20px 8px" }}>
          <h2 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>진행 상태</h2>
          <div className="tl">
            {STAGES.map((st, i) => {
              const state = i < idx ? 2 : i === idx ? 1 : 0;
              const when = whenOf[st.key];
              return (
                <div key={st.key} className="tl__row">
                  <div className="tl__rail">
                    <span className={`tl__dot${state === 2 ? " tl__dot--done" : state === 1 ? " tl__dot--now" : ""}`}>{state === 2 && <CheckMark size={12} />}</span>
                    {i < STAGES.length - 1 && <span className={`tl__line${state === 2 ? " tl__line--done" : ""}`} />}
                  </div>
                  <div className="tl__body">
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span className={`tl__t${state ? "" : " tl__t--off"}`}>{st.label}</span>
                      {state === 1 && <span className="tl__d">{st.desc}</span>}
                      {st.key === "quoted" && state >= 1 && d.invites.length > 0 && <span className="tl__d">{submitted}/{d.invites.length}곳 회신</span>}
                    </div>
                    <span className="tl__when tnum">{when ? mdhm(when) : state === 1 && st.key === "quoted" && rfq.reply_by ? `기한 ${md(rfq.reply_by)}` : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="stack">
          <div className="card" style={{ padding: 18 }}>
            <div className="sec-title" style={{ margin: "0 0 10px" }}>
              <h2>회신 현황</h2>
              <span>{rfq.reply_by ? `회신 기한 ${md(rfq.reply_by)}` : ""}</span>
            </div>
            {d.invites.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--muted)" }}>아직 전달된 기관이 없습니다. 시험 분야가 맞는 기관을 확인하고 있습니다.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {d.invites.map((i) => (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--sf)", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: i.status === "submitted" ? "var(--brand)" : "var(--dash)" }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{rfq.compared_at || i.status !== "submitted" ? i.cro_name : "회신 CRO"}</span>
                    </div>
                    <span style={{ fontSize: 13, color: i.status === "submitted" ? "var(--ink)" : "var(--muted)" }}>{INVITE_LABEL[i.status] ?? i.status}</span>
                  </div>
                ))}
              </div>
            )}
            {submitted > 0 && !rfq.compared_at && (
              <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>회신 기한이 지난 뒤 비교표가 공개됩니다. 공개되면 앱 안의 알림으로 알려 드립니다.</p>
            )}
          </div>

          {!d.award && !rfq.selected_quote_id && ["received", "distributed", "quoted", "compared"].includes(rfq.status) && <OutcomeForm no={rfq.rfq_no} compared={canCompare} />}
          {!d.award && rfq.outcome && (
            <div className="note" style={{ flexDirection: "column", gap: 4 }}>
              <b>선정 없이 마무리 · {rfq.outcome}{rfq.outcome_at ? ` · ${ymd(rfq.outcome_at)}` : ""}</b>
              {rfq.outcome_note && <span>{rfq.outcome_note}</span>}
            </div>
          )}
          {d.award && (
            <div className="note note--ok" style={{ flexDirection: "column", gap: 4 }}>
              <b>{d.award.cro_name} 선택 · {ymd(d.award.awarded_at)}</b>
              <span>
                {d.award.contract_reported_at
                  ? `계약 체결 보고 · ${d.award.contract_date ? ymd(d.award.contract_date) : ""}`
                  : "선택한 기관에 연락처를 전달했습니다. 계약은 기관과 직접 진행합니다."}
              </span>
            </div>
          )}

          <div className="card card--rows">
            <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>요청 내용</div>
            {[
              ["의뢰 목적", rfq.purpose],
              ["요청 성격", rfq.intent],
              ["개발 분야", p.devField],
              ["희망 착수", p.start],
              ["예산", rfq.budget],
              ["기밀 등급", rfq.confidentiality],
              ["접수일", ymd(rfq.created_at)],
              ["상세 입력", rfq.submitted_step === 2 ? "완료" : "기본 정보만"],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={String(k)} className="kv">
                  <span className="kv__k">{k}</span>
                  <span className="kv__v">{String(v)}</span>
                </div>
              ))}
            {d.files.length > 0 && (
              <div className="kv" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                <span className="kv__k">첨부</span>
                {d.files.map((f) => (
                  <a key={f.id} href={`/api/files/${f.id}`} style={{ fontSize: 14 }}>
                    {f.file_name} <span style={{ color: "var(--muted)" }}>· {(f.size_bytes / 1024 / 1024).toFixed(1)}MB</span>
                    {!f.uploaded_at && <span className="pill pill--warn" style={{ marginLeft: 6 }}>업로드 안 됨</span>}
                  </a>
                ))}
              </div>
            )}
          </div>

          {!["closed", "cancelled"].includes(rfq.status) && <div className="card card--pad"><AttachmentRetry no={rfq.rfq_no} /></div>}
          <details className="card" style={{ padding: "0 18px" }}>
            <summary style={{ padding: "14px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>입력한 전체 항목 보기</summary>
            <div className="card--rows" style={{ padding: "0 0 8px" }}>
              {Object.entries(labels)
                .filter(([id]) => {
                  const v = p[id];
                  return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v;
                })
                .map(([id, label]) => (
                  <div key={id} className="kv" style={{ fontSize: 13 }}>
                    <span className="kv__k">{label}</span>
                    <span className="kv__v" style={{ fontWeight: 500 }}>{Array.isArray(p[id]) ? (p[id] as string[]).join(", ") : String(p[id])}</span>
                  </div>
                ))}
            </div>
          </details>
        </div>
      </div>

      {canCompare && (
        <div className="cta">
          <Link href={`/app/r/${rfq.rfq_no}/compare`} className="b1 blg bfull">도착한 견적 {submitted}건 비교하기</Link>
        </div>
      )}
    </>
  );
}
