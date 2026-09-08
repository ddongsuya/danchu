import { requireSession } from "@/lib/auth";
import { dbReady, listAwardsForOrg } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { ContractReport } from "@/components/cro/ContractReport";
import { ymd, won } from "@/lib/format";

export const dynamic = "force-dynamic";

const NEXT = [
  ["의뢰자와 계약 협의", "단추는 조건에 관여하지 않습니다. 직접 진행하세요."],
  ["계약 체결 보고", "체결일·계약금액을 아래에 입력 (수수료 정산 기준)"],
  ["시험물질 수령", "회신에 적은 필요량·시점 기준"],
];

export default async function CroAwards() {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} />;
  const list = dbReady() ? await listAwardsForOrg(org.id) : [];

  return (
    <>
      <div className="ph">
        <div>
          <h1>수주</h1>
          <p>의뢰자가 우리 기관을 선택한 요청입니다. 연락처가 공개되어 있습니다.</p>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <b>아직 수주가 없습니다</b>
          의뢰자가 선택하면 알림과 함께 여기에 연락처가 표시됩니다.
        </div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {list.map((a) => (
            <div key={a.id} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>{a.rfq?.rfq_no} · 선정 {ymd(a.awarded_at)}</span>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{a.rfq?.substance}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>{(a.rfq?.categories ?? []).join(" · ")}</div>
                </div>
                <span className={`pill ${a.contract_reported_at ? "pill--ok" : "pill--tint"}`} style={{ alignSelf: "flex-start" }}>{a.contract_reported_at ? `계약 체결 · ${won(a.contract_amount ?? 0)}` : "계약 진행"}</span>
              </div>

              <div className="note note--tint" style={{ flexDirection: "column", gap: 6 }}>
                <b style={{ fontWeight: 600 }}>의뢰자 연락처</b>
                <span>
                  {a.rfq?.company} · {a.rfq?.contact_name} · <a href={`mailto:${a.rfq?.email}`}>{a.rfq?.email}</a>
                  {a.rfq?.phone ? <> · <a href={`tel:${a.rfq.phone}`}>{a.rfq.phone}</a></> : null}
                </span>
              </div>

              {!a.contract_reported_at && (
                <div className="grid2" style={{ alignItems: "start" }}>
                  <div className="stack" style={{ gap: 10 }}>
                    {NEXT.map(([t, d], i) => (
                      <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{ flex: "none", width: 24, height: 24, borderRadius: "50%", background: i === 1 ? "var(--brand)" : "transparent", border: i === 1 ? 0 : "1.5px solid var(--iline)", color: i === 1 ? "var(--onbrand)" : "var(--muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                        <div style={{ fontSize: 14 }}>
                          <b style={{ fontWeight: 600 }}>{t}</b>
                          <small style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{d}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <ContractReport awardId={a.id} />
                </div>
              )}
              {a.contract_reported_at && (
                <div className="kv" style={{ padding: 0, fontSize: 13 }}>
                  <span className="kv__k">보고</span>
                  <span className="kv__v" style={{ fontWeight: 500 }}>
                    체결일 {a.contract_date} · {won(a.contract_amount ?? 0)}{a.contract_note ? ` · ${a.contract_note}` : ""}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
