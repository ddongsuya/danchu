import { AttachmentRetry } from "@/components/app/AttachmentRetry";
import { OutcomeForm } from "@/components/app/OutcomeForm";
import { ContractConfirm, ReopenRequest, StartNow } from "@/components/app/RequestActions";
import { needsCda, REOPEN_DAYS } from "@/lib/request-policy";
import { getSupabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { STAGES, stageIndex, statusLabel, statusTone, INVITE_LABEL } from "@/lib/status";
import { CheckMark, Crumb, StatusPill } from "@/components/app/ui";
import { md, mdhm, won, ymd } from "@/lib/format";
import { labelMap } from "@/lib/rfq-schema";

export const dynamic = "force-dynamic";

export default async function RequestDetail({ params }: { params: Promise<{ no: string }> }) {
  const s = await requireSession("requester");
  const { no } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin")) notFound();
  const d = await getRfqDetail(rfq);
  const idx = stageIndex(rfq.status);
  // 운영자가 취소한 초대는 목록과 숫자에서 뺀다
  const invites = d.invites.filter((i) => i.status !== "expired" || ["closed", "cancelled"].includes(rfq.status));
  const active = d.invites.filter((i) => i.status !== "expired");
  const submitted = d.invites.filter((i) => i.status === "submitted").length;
  // 기관 이름은 비교표가 열린 뒤에만. 그 전에는 순서 번호로 (어느 기관이 회신하지 않는지도 미리 알리지 않는다)
  const named = !!rfq.compared_at;
  const canCompare = !!rfq.compared_at && submitted > 0;
  const p = rfq.payload;
  const labels = labelMap();
  // 선정한 기관의 연락처 (선정 순간 서로 주고받는다)
  let croContact: { name: string; email: string; phone: string } | null = null;
  if (d.award?.cro_org_id) {
    const { data: org } = await getSupabaseAdmin()!.from("cro_orgs").select("contact_name, contact_email, contact_phone").eq("id", d.award.cro_org_id).maybeSingle();
    if (org && (org.contact_email || org.contact_phone)) croContact = { name: org.contact_name ?? "", email: org.contact_email ?? "", phone: org.contact_phone ?? "" };
  }
  const reported = d.award?.contract_reported_at ?? null;
  const needsConfirm = !!(d.award && reported && !d.award.requester_confirmed_at && !d.award.requester_disputed_at && rfq.status === "contracting");
  const autoOn = reported ? ymd(new Date(new Date(reported).getTime() + 7 * 864e5).toISOString()) : "";
  const reopenUntil = rfq.outcome === "보류" && rfq.status === "closed" && rfq.outcome_at && submitted > 0 && Date.now() - new Date(rfq.outcome_at).getTime() <= REOPEN_DAYS * 864e5 ? ymd(new Date(new Date(rfq.outcome_at).getTime() + REOPEN_DAYS * 864e5).toISOString()) : "";
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
                      {st.key === "quoted" && state >= 1 && active.length > 0 && <span className="tl__d">{active.length}곳 중 {submitted}곳 회신</span>}
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
            {invites.length === 0 ? (
              <div style={{ fontSize: 14, color: "var(--muted)" }}>
                {!rfq.started_at ? (
                  <>
                    아직 기관에 보내지 않았습니다. 첨부를 다시 올린 뒤 보내거나, 지금 있는 첨부로 바로 보낼 수 있습니다.
                    {rfq.status === "received" && <StartNow no={rfq.rfq_no} />}
                  </>
                ) : (
                  "요청 분야에 바로 맞는 참여 기관이 없어 운영자가 직접 전달 기관을 정하고 있습니다. 보통 영업일 1~2일 안에 결과를 알려 드립니다."
                )}
              </div>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {invites.map((i, n) => (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--sf)", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: i.status === "submitted" ? "var(--brand)" : "var(--dash)" }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{named ? i.cro_name : `기관 ${n + 1}`}</span>
                    </div>
                    <span style={{ fontSize: 13, color: i.status === "submitted" ? "var(--ink)" : "var(--muted)" }}>{INVITE_LABEL[i.status] ?? i.status}</span>
                  </div>
                ))}
              </div>
            )}
            {invites.length > 0 && !rfq.compared_at && !["closed", "cancelled"].includes(rfq.status) && (
              <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
                {rfq.reply_by ? `비교표는 ${md(rfq.reply_by)} 회신 마감 다음 날 오전 9시에 열립니다. ` : ""}모든 기관이 회신하면 바로 열립니다. 기관 이름은 비교표에서 함께 보입니다.
              </p>
            )}
          </div>

          {!d.award && !rfq.selected_quote_id && ["received", "distributed", "quoted", "compared"].includes(rfq.status) && <OutcomeForm no={rfq.rfq_no} compared={canCompare} />}
          {!d.award && rfq.outcome && (
            <div className="note" style={{ flexDirection: "column", gap: 4 }}>
              <b>선정 없이 마무리 · {rfq.outcome}{rfq.outcome_at ? ` · ${ymd(rfq.outcome_at)}` : ""}</b>
              {rfq.outcome_note && <span>{rfq.outcome_note}</span>}
              {reopenUntil && <ReopenRequest no={rfq.rfq_no} until={reopenUntil} />}
            </div>
          )}
          {d.award && (
            <div className="note note--ok" style={{ flexDirection: "column", gap: 4 }}>
              <b>{d.award.cro_name} 선정 · {ymd(d.award.awarded_at)}</b>
              <span>
                {d.award.requester_confirmed_at
                  ? `계약 체결 · ${d.award.contract_date ? ymd(d.award.contract_date) : ""} · ${won(d.award.contract_amount ?? 0)}${d.award.confirmed_auto ? " (보고 7일 뒤 자동 확정)" : ""}`
                  : d.award.requester_disputed_at
                    ? "계약 보고에 남기신 의견을 운영자가 기관과 확인하고 있습니다."
                    : reported
                      ? "기관이 계약 체결을 보고했습니다. 아래에서 내용을 확인해 주세요."
                      : "서로 연락처를 주고받았습니다. 계약은 기관과 직접 진행합니다."}
              </span>
              {croContact && (
                <span>
                  기관 담당 {[croContact.name, croContact.email, croContact.phone].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
          )}
          {needsConfirm && d.award && (
            <ContractConfirm
              no={rfq.rfq_no}
              cro={d.award.cro_name}
              date={d.award.contract_date ? ymd(d.award.contract_date) : "-"}
              amount={won(d.award.contract_amount ?? 0)}
              autoOn={autoOn}
            />
          )}

          <div className="card card--rows">
            <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>요청 내용</div>
            {[
              ["의뢰 목적", rfq.purpose],
              ["요청 성격", rfq.intent],
              ["개발 분야", p.devField],
              ["희망 착수", p.start],
              ["예산", rfq.budget],
              ["지명 기관", Array.isArray(p.nominees) && p.nominees.length ? (p.nominees as string[]).join(", ") : ""],
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
